/**
 * net.js - 房间码联机（帧同步客户端）
 *
 * 一句话原理：服务器只转发「谁在哪一帧按了什么键」，两台手机各自跑同一份游戏逻辑。
 * 所以客户端这边最核心的不是网络，而是「按帧推进」——逻辑帧只能由
 * LockStep 允许时才走，绝不能由 requestAnimationFrame 自己走。
 *
 * 三条硬规则（破坏任意一条就会不同步或卡死）：
 *   1. 每个逻辑帧都必须收齐双方输入才执行（lockstep.js 保证）
 *   2. 采样本地输入写的是 frame + buffer，不是当前帧（给网络抖动留缓冲）
 *   3. 游戏状态里不许有 Math.random / Date.now（rng.js 保证）
 *
 * 对外接口：
 *   NetPlay.init({ url, sampleMask, step, hash, onStatus, onStart, onDesync })
 *   NetPlay.createRoom()  NetPlay.joinRoom(code)  NetPlay.leave()
 *   NetPlay.tick(nowMs)   NetPlay.isPlaying()
 */
(function (g) {
  'use strict';

  var TICK_MS = 1000 / 60;
  var BUFFER = 4;        // 输入提前量 4 帧 ≈ 67ms，覆盖常见网络抖动
  var MAX_AHEAD = 2;     // 写指针最多再额外领先 2 帧，卡顿后延迟不会累积
  var HASH_EVERY = 30;   // 每 0.5 秒比对一次状态哈希
  var STALL_MS = 400;    // 超过这么久没推进就提示「等待对方」
  // 重连退避：先快后慢。前几次几乎立刻重试（切后台回来往往是瞬断），
  // 之后拉到 4 秒，避免弱网下把手机电量耗在无意义的握手上。
  var RETRY_DELAYS = [400, 900, 1600, 2800, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000];

  var opt = {};
  var st = {
    ws: null,
    want: null,          // 'create' | 'join' | 'resume'
    wantCode: '',
    code: '',
    slot: 0,
    seed: 0,
    tok: '',             // 重连票据（服务器发的，丢了就不能回原座位）
    status: 'idle',      // idle|connecting|waiting|playing|stall|reconnecting|peer-offline|peerleft|error
    playing: false,
    paused: false,       // 暂停推进：掉线或队友掉线时为 true，帧号原地不动
    pauseAt: 0,
    pausedBy: '',        // 'self' | 'peer'
    retryTries: 0,
    retryTimer: 0,
    ls: null,
    acc: 0,
    lastTick: 0,
    rtt: 0,
    peerJoined: false,
    desyncFrame: -1,
    myHashes: {},
    peerHashes: {},
    pingTimer: 0,
    lastAdvanceAt: 0,
    peerAck: -1,
    startedAt: 0,        // 开局时刻（ms），推帧节奏的时间锚
    startFrame: 0        // 开局帧号
  };

  function nowMs() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  function defaultUrl() {
    if (typeof location === 'undefined') return 'ws://127.0.0.1:3000/ws';
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return proto + location.host + '/ws';
  }

  function setStatus(s, info) {
    st.status = s;
    if (opt.onStatus) opt.onStatus(s, info || {});
  }

  function wsSend(obj) {
    if (st.ws && st.ws.readyState === 1) {
      try { st.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
    }
    return false;
  }

  /* ==================== 暂停 / 恢复 ==================== */

  /*
   * 掉线了怎么办：整局「暂停」，不是「残局继续」。
   *
   * 帧同步的前提是每个逻辑帧都要收齐双方输入。一方掉线后如果让另一方继续跑，
   * 帧号就分叉了，回来只能从头再来。两人合作游戏没有别人看，暂停是最干净的选择：
   * 帧号原地不动，谁也没吃亏，重连后接着打。
   */
  function pause(reason) {
    if (!st.playing) return;
    if (!st.paused) {
      st.paused = true;
      st.pauseAt = nowMs();
      st.pausedBy = reason;
    }
    setStatus(reason === 'peer' ? 'peer-offline' : 'reconnecting', { slot: st.slot });
  }

  /*
   * 恢复时最容易踩的坑：暂停期间真实时间一直在走，
   * 而推帧节奏锚在 startedAt 上（expected = startFrame + elapsed / 16.67），
   * 直接恢复会让 expected 一下暴涨几千帧，游戏瞬间快进或卡死追帧。
   * 正确做法是把时间锚整体后移「这次暂停的时长」，从原来的节奏接着走。
   */
  function resume() {
    if (!st.paused) return;
    st.startedAt += nowMs() - st.pauseAt;
    st.paused = false;
    st.pausedBy = '';
    st.acc = 0;
    st.lastTick = 0;
    st.lastAdvanceAt = nowMs();
    setStatus('playing', { slot: st.slot });
  }

  /** 向对端要「从我还没执行的那一帧起」的输入（掉线期间漏掉的） */
  function requestFrames() {
    if (!st.ls) return;
    wsSend({ t: 'resync', from: st.ls.frame });
  }

  function scheduleReconnect() {
    if (st.retryTimer) return;
    var i = st.retryTries++;
    if (i >= RETRY_DELAYS.length) {
      setStatus('error', { msg: '连不回对局了（网络断了太久）' });
      st.playing = false;
      return;
    }
    var d = RETRY_DELAYS[i];
    st.retryTimer = setTimeout(function () {
      st.retryTimer = 0;
      st.want = 'resume';
      open();
    }, d);
  }

  function cancelReconnect() {
    if (st.retryTimer) { clearTimeout(st.retryTimer); st.retryTimer = 0; }
    st.retryTries = 0;
  }

  /* ==================== 连接 ==================== */

  function open() {
    var url = opt.url || defaultUrl();
    if (st.want !== 'resume') setStatus('connecting', { url: url });
    var ws;
    try { ws = new WebSocket(url); }
    catch (e) { setStatus('error', { msg: '无法建立连接' }); return; }

    st.ws = ws;

    ws.onopen = function () {
      if (st.want === 'create') wsSend({ t: 'create' });
      else if (st.want === 'join') wsSend({ t: 'join', code: st.wantCode });
      // 重连：报房号 + 槽位 + 票据，三者都对才准回原座位
      else if (st.want === 'resume') wsSend({ t: 'rejoin', code: st.code, slot: st.slot, token: st.tok });
    };

    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      handle(m);
    };

    ws.onclose = function () {
      stopPing();
      st.ws = null;
      // 对局中掉线：不判死，先暂停再自动重连（server 那边给 60 秒保留期）
      if (st.playing && st.want !== null) {
        pause('self');
        scheduleReconnect();
        return;
      }
      if (st.status === 'idle') return;
      setStatus('error', { msg: '连接已断开' });
      st.playing = false;
    };

    ws.onerror = function () {
      if (st.status !== 'playing' && st.want !== 'resume') setStatus('error', { msg: '连不上联机服务' });
    };
  }

  function handle(m) {
    switch (m.t) {
      case 'hello':
        break;

      case 'room':
        st.code = m.code;
        st.slot = m.slot | 0;
        st.seed = m.seed >>> 0;
        st.tok = m.token || '';
        setStatus('waiting', { code: st.code, slot: st.slot });
        break;

      /* ---- 掉线后成功回到原座位 ---- */
      case 'resumed':
        cancelReconnect();
        st.code = m.code || st.code;
        st.slot = (m.slot === undefined ? st.slot : m.slot | 0);
        resume();
        requestFrames();     // 掉线这段时间对方跑在前面的输入要补回来
        break;

      /* ---- 队友掉线：我方立刻停止推进，等他回来 ---- */
      case 'peer-offline':
        pause('peer');
        break;

      /* ---- 队友回来了：不必重建 LockStep，接着推 ---- */
      case 'peer-online':
        if (st.status === 'peer-offline') resume();
        break;

      /* ---- 对端要补帧（它刚从掉线里回来） ---- */
      case 'resync': {
        if (!st.ls) break;
        var rfrom = Math.max(0, m.from | 0);
        // 对方需要的帧可能比我们记录的 ack 还早，必须把重发窗口倒回去
        if (st.peerAck < 0 || rfrom < st.peerAck) st.peerAck = rfrom;
        var rlist = [];
        for (var rf = rfrom; rf < st.ls.writeFrame && rlist.length < 24; rf++) {
          var rm = st.ls.localInput(rf);
          if (rm !== undefined) rlist.push([rf, rm]);
        }
        if (rlist.length) wsSend({ t: 'in', a: st.ls.lastDone(), f: rlist });
        break;
      }

      case 'peer':
        st.peerJoined = true;
        setStatus('waiting', { code: st.code, slot: st.slot, peer: true });
        break;

      case 'go':
        begin(m.seed >>> 0 || st.seed);
        break;

      case 'in': {
        if (!st.ls) break;
        // 对方已执行到 m.a，之前的帧不用再补发
        if (typeof m.a === 'number' && m.a + 1 > st.peerAck) st.peerAck = m.a + 1;
        var frames = m.f || [];
        for (var i = 0; i < frames.length; i++) {
          st.ls.onRemoteInput(frames[i][0] | 0, m.s | 0, frames[i][1] | 0);
        }
        break;
      }

      case 'hash': {
        st.peerHashes[m.f | 0] = m.h;
        var mine = st.myHashes[m.f | 0];
        if (mine && mine !== m.h && st.desyncFrame < 0) {
          st.desyncFrame = m.f | 0;
          if (opt.onDesync) opt.onDesync(st.desyncFrame);
        }
        break;
      }

      case 'desync':
        if (st.desyncFrame < 0) {
          st.desyncFrame = m.f | 0;
          if (opt.onDesync) opt.onDesync(st.desyncFrame);
        }
        break;

      case 'peerleft':
        cancelReconnect();
        st.playing = false;
        st.paused = false;
        setStatus('peerleft', { code: st.code });
        break;

      case 'err':
        if (st.want === 'resume') {
          // 票据过期 / 房间已回收：别再退了，退下去也回不来
          cancelReconnect();
          st.playing = false;
          st.paused = false;
          setStatus('error', { msg: '这局已经结束了，回不到对局里' });
          break;
        }
        setStatus('error', {
          msg: m.code === 'ROOM_FULL' ? '这个房间已经满员了'
            : (m.code === 'ROOM_NOT_FOUND' ? '房号不存在，确认一下是不是输错了' : '联机出错：' + m.code)
        });
        break;

      case 'pong':
        st.rtt = Math.round(nowMs() - (m.ts || 0));
        break;

      default: break;
    }
  }

  /* ==================== 帧同步驱动 ==================== */

  function begin(seed) {
    st.ls = new g.LOCKSTEP.LockStep({
      players: 2,
      localSlot: st.slot,
      bufferFrames: BUFFER,
      timeoutMs: STALL_MS,
      maxCatchUp: 10
    });
    st.playing = true;
    st.paused = false;
    st.pausedBy = '';
    st.retryTries = 0;
    st.acc = 0;
    st.lastTick = 0;
    st.myHashes = {};
    st.peerHashes = {};
    st.desyncFrame = -1;
    st.peerAck = -1;
    st.lastAdvanceAt = nowMs();
    st.startedAt = st.lastAdvanceAt;
    st.startFrame = st.ls.frame;

    if (opt.onStart) opt.onStart({ slot: st.slot, seed: seed, code: st.code });
    setStatus('playing', { slot: st.slot, seed: seed });
    startPing();
  }

  function startPing() {
    stopPing();
    st.pingTimer = setInterval(function () {
      wsSend({ t: 'ping', ts: nowMs() });
    }, 2000);
  }
  function stopPing() {
    if (st.pingTimer) { clearInterval(st.pingTimer); st.pingTimer = 0; }
  }

  /**
   * 采样并上行。
   *
   * 关键：不能「只发刚采的这一个帧」。开局第 0~buffer 帧的输入是 lockstep 构造函数
   * 预填的（0 = 什么都没按），如果只发新帧，对端永远收不到 0~3 帧的输入 → 永久卡死。
   * 所以每次都从「对端还没执行到的第一帧」开始批量补发，最多 12 帧。
   * WebSocket 是有序可靠传输，多发的几帧只是几十字节，换来的是绝不死锁。
   */
  function sendInputs() {
    var ls = st.ls;
    if (!ls) return;
    // peerAck 的语义是「对端还需要的第一帧」，初值 -1 表示还不知道，从 0 开始发。
    // 这里**不能再 +1**：加了就会漏掉第 0 帧，先到的一方永远等不到，整局卡死。
    var from = Math.max(0, st.peerAck);
    var list = [];
    for (var f = from; f < ls.writeFrame && list.length < 12; f++) {
      var m = ls.localInput(f);
      if (m !== undefined) list.push([f, m]);
    }
    if (list.length) wsSend({ t: 'in', a: ls.lastDone(), f: list });
  }

  function sampleAndSend() {
    var ls = st.ls;
    // 缓冲够深就不再往前塞，否则网络一慢延迟会越积越大
    if (ls.writeFrame - ls.frame < BUFFER + MAX_AHEAD) {
      var mask = opt.sampleMask ? opt.sampleMask(st.slot) : 0;
      ls.pushLocal(mask);
    }
    sendInputs();
  }

  function NetPlay() { }

  NetPlay = {
    init: function (o) { opt = o || {}; return this; },

    createRoom: function () {
      st.want = 'create'; st.wantCode = ''; st.peerJoined = false;
      open();
    },

    joinRoom: function (code) {
      st.want = 'join'; st.wantCode = String(code || '').toUpperCase().trim(); st.peerJoined = false;
      open();
    },

    leave: function () {
      wsSend({ t: 'leave' });
      cancelReconnect();
      st.playing = false;
      st.paused = false;
      st.want = null;
      stopPing();
      if (st.ws) { try { st.ws.close(); } catch (e) { } st.ws = null; }
      st.status = 'idle';
      st.ls = null;
      st.code = ''; st.slot = 0; st.seed = 0; st.tok = '';
      st.myHashes = {}; st.peerHashes = {}; st.desyncFrame = -1;
    },

    isPlaying: function () { return st.playing && !!st.ls; },
    isPaused: function () { return st.paused; },

    /**
     * 仅供测试：模拟一次网络中断（真机上等价于切飞行模式 / 进电梯）。
     * 主动 close 而不是等它自己断，是为了让用例能确定性地触发。
     */
    _simulateDrop: function () {
      if (st.ws) { try { st.ws.close(); } catch (e) { } st.ws = null; }
    },
    status: function () { return st.status; },
    code: function () { return st.code; },
    slot: function () { return st.slot; },
    rtt: function () { return st.rtt; },
    frame: function () { return st.ls ? st.ls.frame : 0; },
    desyncFrame: function () { return st.desyncFrame; },

    /** 内部状态探针（排查卡帧用，正常逻辑不依赖它） */
    debug: function () {
      var ls = st.ls;
      return {
        playing: st.playing,
        status: st.status,
        paused: st.paused,
        pausedBy: st.pausedBy,
        retryTries: st.retryTries,
        wsReady: st.ws ? st.ws.readyState : -1,
        frame: ls ? ls.frame : -1,
        writeFrame: ls ? ls.writeFrame : -1,
        peerAck: st.peerAck,
        localN: ls ? Object.keys(ls.localInputs).length : -1,
        remoteN: ls ? Object.keys(ls.remoteInputs).length : -1,
        remoteFrames: ls ? Object.keys(ls.remoteInputs).slice(0, 6).join(',') : '',
        acc: Math.round(st.acc),
        lastTick: Math.round(st.lastTick),
        startedAt: Math.round(st.startedAt)
      };
    },

    /** 每帧渲染循环调用一次；只有这里能推进游戏逻辑 */
    tick: function (now) {
      if (!st.playing || !st.ls) return;
      now = now || nowMs();
      if (!st.lastTick) { st.lastTick = now; return; }

      // 暂停期间只更新时间戳，绝不动帧号：一帧都不许走，否则两边对不上
      if (st.paused) { st.lastTick = now; st.acc = 0; return; }

      var dt = now - st.lastTick;
      st.lastTick = now;
      if (dt < 0) dt = 0;
      if (dt > 250) dt = 250;      // 切后台回来别一次性补几百帧
      st.acc += dt;

      var guard = 0;
      while (st.acc >= TICK_MS && guard < 6) {
        st.acc -= TICK_MS;
        guard++;
        this._tickOnce(now);
      }
      if (st.acc >= TICK_MS) st.acc = 0;
    },

    _tickOnce: function (now) {
      var ls = st.ls;
      sampleAndSend();

      /*
       * 节奏必须锚在真实时间上，不能「能推多少推多少」。
       * 早期写法直接 advance(maxCatchUp:10)，结果一帧内把缓冲里的输入全吃掉，
       * 游戏跑到 5 倍速（实测 900 tick 推了 4500 帧）。
       * 正确做法：算出「到这个时刻本该执行到第几帧」，只追到那里为止。
       */
      var expected = st.startFrame + Math.floor((now - st.startedAt) / TICK_MS);

      var moved = 0, guard = 0;
      while (guard++ < 8 && ls.frame < expected) {
        var n = ls.advance(function (frame, masks) {
          if (opt.step) opt.step(frame, masks);
          if (frame % HASH_EVERY === 0 && opt.hash) {
            var h = opt.hash();
            st.myHashes[frame] = h;
            wsSend({ t: 'hash', f: frame, h: h });
            if (st.peerHashes[frame] && st.peerHashes[frame] !== h && st.desyncFrame < 0) {
              st.desyncFrame = frame;
              if (opt.onDesync) opt.onDesync(frame);
            }
          }
        }, 1);
        if (!n) break;                 // 输入还没到齐，等下一 tick
        moved += n;
      }

      if (moved > 0) {
        st.lastAdvanceAt = now;
        if (st.status === 'stall') setStatus('playing', { slot: st.slot });
      } else {
        // 没推进 = 在等对方输入
        if (now - st.lastAdvanceAt > STALL_MS && st.status === 'playing') {
          setStatus('stall', { waitMs: Math.round(now - st.lastAdvanceAt) });
        }
      }

      // 已比对过的哈希不用留着，避免长时间对局内存增长
      if (ls.frame % 300 === 0) {
        var cut = ls.frame - 600;
        for (var k in st.myHashes) if (+k < cut) delete st.myHashes[k];
        for (var k2 in st.peerHashes) if (+k2 < cut) delete st.peerHashes[k2];
      }
    }
  };

  g.NetPlay = NetPlay;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
