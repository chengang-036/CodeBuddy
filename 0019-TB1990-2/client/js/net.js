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

  var opt = {};
  var st = {
    ws: null,
    want: null,          // 'create' | 'join'
    wantCode: '',
    code: '',
    slot: 0,
    seed: 0,
    status: 'idle',      // idle|connecting|waiting|playing|stall|peerleft|error
    playing: false,
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

  /* ==================== 连接 ==================== */

  function open() {
    var url = opt.url || defaultUrl();
    setStatus('connecting', { url: url });
    var ws;
    try { ws = new WebSocket(url); }
    catch (e) { setStatus('error', { msg: '无法建立连接' }); return; }

    st.ws = ws;

    ws.onopen = function () {
      if (st.want === 'create') wsSend({ t: 'create' });
      else if (st.want === 'join') wsSend({ t: 'join', code: st.wantCode });
    };

    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      handle(m);
    };

    ws.onclose = function () {
      if (st.status === 'playing' || st.status === 'stall') {
        setStatus('error', { msg: '连接已断开' });
      } else if (st.status !== 'error' && st.status !== 'idle') {
        setStatus('error', { msg: '连接已断开' });
      }
      st.playing = false;
      stopPing();
    };

    ws.onerror = function () {
      if (st.status !== 'playing') setStatus('error', { msg: '连不上联机服务' });
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
        setStatus('waiting', { code: st.code, slot: st.slot });
        break;

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
        st.playing = false;
        setStatus('peerleft', { code: st.code });
        break;

      case 'err':
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
      st.playing = false;
      st.want = null;
      stopPing();
      if (st.ws) { try { st.ws.close(); } catch (e) { } st.ws = null; }
      st.status = 'idle';
      st.ls = null;
      st.code = ''; st.slot = 0; st.seed = 0;
      st.myHashes = {}; st.peerHashes = {}; st.desyncFrame = -1;
    },

    isPlaying: function () { return st.playing && !!st.ls; },
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
