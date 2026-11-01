/**
 * main.js - 网页端入口：画布适配、固定步长主循环、双人输入绑定
 *
 * 相比单机版的三处关键差异：
 *   1. 固定步长 60Hz 累加（原先是变 dt）。手机掉帧时逻辑不再跟着变，
 *      这是 P2 联机帧同步的前提——否则两台设备的 dt 序列永不相同。
 *   2. 两套独立摇杆 + 两套独立开火键，靠 pid 区分通道。
 *   3. 标题页可选 1 人 / 2 人，选择结果直接决定 game.mode。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG, UI = g.UI, Input = g.Input, Sfx = g.Sfx, Platform = g.Platform;

  var STEP = 1 / 60;          // 逻辑帧固定 16.667ms
  var MAX_CATCHUP = 8;        // 一次最多补 8 帧，防止切后台回来一路追帧

  function boot() {
    var canvas = document.getElementById('game');
    if (!canvas) return;
    g.__mainCanvas = canvas;
    var ctx = canvas.getContext('2d');

    // 触摸设备判定（决定提示文案与是否显示虚拟摇杆）
    // 加 ?touch=1 可在桌面浏览器强制进入手机模式，便于本地预览调试
    var forceTouch = /[?&]touch=1(&|$)/.test(window.location.search);
    var isTouch = forceTouch || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    g.__isTouch = isTouch;
    document.body.classList.add(isTouch ? 'is-touch' : 'is-desktop');

    // ?mode=1 强制单人，?mode=2 强制双人（便于分享固定链接）
    var qMode = /[?&]mode=(\d)/.exec(window.location.search);
    var bootMode = qMode ? parseInt(qMode[1], 10) : CFG.DEFAULT_MODE;

    g.Sprites.init();
    UI.init();

    var game = new g.Game();
    g.__game = game;

    function setMode(m) {
      if (game.state !== g.GAME_ST.TITLE) return;
      if (game.mode === m) return;
      game.setMode(m);
    }
    game.setMode(bootMode);
    g.__setMode = setMode;

    /* ==================== 联机（房间码 + 帧同步） ====================
     * 两条循环互斥：
     *   本地局   —— 由 rAF 按固定步长驱动（一个人或两个人挤一台机器）
     *   联机局   —— 由 NetPlay 的 lockstep 驱动，必须收齐双方输入才走一帧
     * 绝不能两种同时驱动，否则两端必然分叉。
     */
    var PROTO = g.PROTOCOL;
    var online = false;              // 会话中（等待 / 对战 / 断线都算）
    var wasPaused = false;           // 是否因掉线暂停过（用于「接上了」提示，避免开局误报）

    // 联机时 game 的输入源换成「网络传来的帧掩码」，接口与 g.Input 一致
    var netSrc = g.NetInput.create(PROTO);

    /** 退出联机：把「联机态」相关的 UI 全部还原，避免下次进本地局还顶着绿按钮 */
    function clearOnlineUI() {
      online = false;
      document.body.classList.remove('is-online');
      document.body.classList.remove('slot-2');
      var tag = document.querySelector('#btn-fire-1 .fire-tag');
      if (tag) tag.textContent = 'P1';
    }

    /** 采样本地输入 → 1 字节掩码。每人只操作自己手机上的摇杆，两条通道都读。 */
    function sampleMask() {
      var m = 0;
      if (Input.isDown('up', 0) || Input.isDown('up', 1)) m |= PROTO.MASK.UP;
      if (Input.isDown('down', 0) || Input.isDown('down', 1)) m |= PROTO.MASK.DOWN;
      if (Input.isDown('left', 0) || Input.isDown('left', 1)) m |= PROTO.MASK.LEFT;
      if (Input.isDown('right', 0) || Input.isDown('right', 1)) m |= PROTO.MASK.RIGHT;
      if (Input.isDown('fire', 0) || Input.isDown('fire', 1)) m |= PROTO.MASK.FIRE;
      return m;
    }

    g.NetPlay.init({
      sampleMask: sampleMask,
      hash: function () { return g.StateHash.of(game); },
      step: function (frame, masks) {
        netSrc.setMasks(masks);
        game.update(STEP);
      },
      onStart: function (info) {
        // 两端必须用同一个 seed 起同一局，且都切成双人模式
        game.setMode(CFG.MODE_COOP);
        game.inputSource = netSrc;
        game.startNewGame(info.seed);
        online = true;
        wasPaused = false;
        document.body.classList.add('is-online');
        // 控件跟着自己的坦克配色：P2 是绿的，别让人看着黄色按钮开绿坦克
        document.body.classList.toggle('slot-2', info.slot === 1);
        var tag = document.querySelector('#btn-fire-1 .fire-tag');
        if (tag) tag.textContent = info.slot === 1 ? 'P2' : 'P1';
        g.NetUI.waiting(info.code, info.slot);
        g.NetUI.starting();
        // 注意用 hide 而不是 close：close 会触发 onClose → leave，等于刚开局就退房
        setTimeout(function () { g.NetUI.hide(); }, 600);
      },
      onStatus: function (s, info) {
        switch (s) {
          case 'waiting':
            g.NetUI.waiting(info.code, info.slot);
            if (info.peer) g.NetUI.peerJoined();
            break;
          case 'stall':
            break;                     // 卡帧不弹面板，避免打断操作
          case 'reconnecting':
            wasPaused = true;
            g.NetUI.reconnecting({ tries: g.NetPlay.debug().retryTries, code: g.NetPlay.code() });
            break;
          case 'peer-offline':
            wasPaused = true;
            g.NetUI.peerOffline({ code: g.NetPlay.code() });
            break;
          case 'playing':
            // 只有「从暂停里回来」才提示，开局首次进入 playing 不走这里
            if (online && wasPaused) { wasPaused = false; g.NetUI.resumed(); }
            break;
          case 'peerleft':
            g.NetUI.peerLeft();
            break;
          case 'error':
            g.NetUI.error(info.msg);
            clearOnlineUI();
            break;
          default: break;
        }
      },
      onDesync: function (frame) {
        g.NetUI.error('两端画面不同步（第 ' + frame + ' 帧），这一局作废了。请关掉面板重开一局');
        clearOnlineUI();
      }
    });

    g.NetUI.init({
      onCreate: function () { g.NetPlay.createRoom(); g.NetUI.waiting('....', 0); },
      onJoin: function (code) { g.NetPlay.joinRoom(code); g.NetUI.waiting(code, 1); },
      onClose: function () {
        g.NetPlay.leave();
        if (online) {
          clearOnlineUI();
          game.inputSource = null;
          game.state = g.GAME_ST.TITLE;
          game.setMode(bootMode);
        }
      }
    });

    /* ---------- 画布适配 ---------- */
    function resize() {
      var wrap = document.getElementById('stage-wrap');
      var availW = wrap.clientWidth, availH = wrap.clientHeight;
      var scale = Math.min(availW / CFG.W, availH / CFG.H);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      var cssW = Math.floor(CFG.W * scale), cssH = Math.floor(CFG.H * scale);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(canvas.width / CFG.W, 0, 0, canvas.height / CFG.H, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.textBaseline = 'alphabetic';
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 140); });

    /* ---------- 输入 ---------- */
    Input.initKeyboard(window);

    Input.on('pause', function () {
      Sfx.unlock();
      // 联机中不能本地暂停：一方停了另一方还在跑，状态立刻分叉
      if (online) return;
      if (game.state === g.GAME_ST.PLAYING || game.state === g.GAME_ST.PAUSED) game.togglePause();
    });
    Input.on('confirm', function () {
      Sfx.unlock();
      if (online) return;
      game.confirm();
    });

    // 标题页：左右键 / 数字键切换人数
    window.addEventListener('keydown', function (e) {
      if (game.state !== g.GAME_ST.TITLE) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') setMode(CFG.MODE_SINGLE);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit2') setMode(CFG.MODE_COOP);
    });

    // 空格在双人模式里是 P2 的开火键，所以不能让它无条件当确认键；
    // 但在菜单/结算页仍然保留"空格 = 确认"的老习惯。
    window.addEventListener('keydown', function (e) {
      if (e.code !== 'Space') return;
      Sfx.unlock();
      if (online) return;                             // 联机中空格不能触发重开
      if (game.state === g.GAME_ST.PLAYING) return;   // 战斗中空格归 P2 开火
      game.confirm();
    });

    // 画布点击：标题页命中「1 人 / 2 人 / 在线联机」按钮则切换，点其它地方开始
    Platform.onPointerDown(function (ev) {
      Sfx.unlock();
      if (g.NetUI.isOpen()) return;   // 面板开着时点画布不做事（面板盖住画布本来也点不到）
      if (online) return;             // 联机中不响应画布，避免误触重开导致两端分叉
      if (game.state === g.GAME_ST.TITLE) {
        var r = canvas.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && typeof ev.clientX === 'number') {
          var lx = ((ev.clientX - r.left) / r.width) * CFG.W;
          var ly = ((ev.clientY - r.top) / r.height) * CFG.H;
          var hit = UI.titleHit(lx, ly);
          if (hit === 'p1') { setMode(CFG.MODE_SINGLE); return; }
          if (hit === 'p2') { setMode(CFG.MODE_COOP); return; }
          if (hit === 'online') { g.NetUI.open(); return; }
        }
        game.confirm();
        return;
      }
      if (game.state === g.GAME_ST.PAUSED) game.togglePause();
      else if (game.state !== g.GAME_ST.PLAYING && game.state !== g.GAME_ST.INTRO) game.confirm();
    });

    /* ---------- 两套开火键 ---------- */
    function bindFire(pid, elId) {
      var el = document.getElementById(elId);
      if (!el) return;
      function down(e) { e.preventDefault(); Sfx.unlock(); Input.setVirtual(pid, 'fire', true); }
      function up(e) { e.preventDefault(); Input.setVirtual(pid, 'fire', false); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    bindFire(0, 'btn-fire-1');
    bindFire(1, 'btn-fire-2');

    /* ---------- 两套虚拟摇杆 ----------
     * 浮动原点：手指按下的位置就是圆心，不要求精确按在摇杆中心；
     * 拖动超过死区后按「主导轴」判定四方向（坦克是四向移动，不做八向）；
     * 松手立即复位并清方向，避免"粘键"。
     * 两位玩家用不同 pid，绝不复用同一个 origin / pointerId。
     */
    function bindStickPad(pid, ids) {
      var zone = document.getElementById(ids.zone);
      var base = document.getElementById(ids.base);
      var knob = document.getElementById(ids.knob);
      if (!zone || !base || !knob) return;

      var DEAD = 14;                 // 死区半径（px），measure 时按底盘大小调整
      var baseSize = 100, knobR = 20, maxR = 30;
      var home = { x: 5, y: 5 };
      var origin = null;             // 手指按下点（zone 局部坐标）
      var activeId = null;           // 当前摇杆占用的 pointerId

      function measure() {
        var br = base.getBoundingClientRect();
        var kr = knob.getBoundingClientRect();
        baseSize = br.width || 100;
        knobR = (kr.width || 40) / 2;
        maxR = Math.max(14, baseSize / 2 - knobR - 2);
        DEAD = Math.max(10, Math.round(baseSize * 0.14));
        home = {
          x: Math.max(0, (zone.clientWidth - baseSize) / 2),
          y: Math.max(0, (zone.clientHeight - baseSize) / 2)
        };
        if (!origin) base.style.transform = 'translate(' + home.x + 'px,' + home.y + 'px)';
      }

      function local(e) {
        var r = zone.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      function reset() {
        Input.setStickDir(pid, null);
        base.classList.remove('active');
        base.removeAttribute('data-dir');
        base.style.transform = 'translate(' + home.x + 'px,' + home.y + 'px)';
        knob.style.transform = 'translate(0px,0px)';
        origin = null; activeId = null;
      }

      function apply(p) {
        if (!origin) return;
        var dx = p.x - origin.x, dy = p.y - origin.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var kx = dx, ky = dy;
        if (d > maxR) { kx = dx / d * maxR; ky = dy / d * maxR; }
        knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';

        if (d < DEAD) {                       // 死区内：不动
          Input.setStickDir(pid, null);
          base.removeAttribute('data-dir');
          return;
        }
        var dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'RIGHT' : 'LEFT')
          : (dy > 0 ? 'DOWN' : 'UP');
        Input.setStickDir(pid, dir);
        base.setAttribute('data-dir', dir);
      }

      zone.addEventListener('pointerdown', function (e) {
        if (activeId !== null) return;        // 这个摇杆已有手指在操作
        e.preventDefault();
        Sfx.unlock();
        activeId = e.pointerId;
        try { zone.setPointerCapture(activeId); } catch (err) { }

        var p = local(e);
        var half = baseSize / 2;
        // 限制圆心落在 zone 内，避免底盘跑出可视区域
        origin = {
          x: Math.min(Math.max(p.x, half), Math.max(half, zone.clientWidth - half)),
          y: Math.min(Math.max(p.y, half), Math.max(half, zone.clientHeight - half))
        };
        base.style.transition = 'none';
        base.style.transform = 'translate(' + (origin.x - half) + 'px,' + (origin.y - half) + 'px)';
        base.classList.add('active');
        knob.style.transform = 'translate(0px,0px)';
        apply(p);
      });

      zone.addEventListener('pointermove', function (e) {
        if (e.pointerId !== activeId || !origin) return;
        e.preventDefault();
        apply(local(e));
      });

      function end(e) {
        if (e.pointerId !== activeId) return;
        base.style.transition = '';
        reset();
      }
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', function () { setTimeout(measure, 160); });
      measure();
    }

    bindStickPad(0, { zone: 'stick-zone-1', base: 'stick-base-1', knob: 'stick-knob-1' });
    bindStickPad(1, { zone: 'stick-zone-2', base: 'stick-base-2', knob: 'stick-knob-2' });

    // 顶部按钮
    var btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', function () {
      Sfx.unlock();
      // 联机中暂停 = 让对手干等，所以这个按钮改成「打开菜单」（能看房号、能退出）
      if (online) { g.NetUI.inGame(g.NetPlay.code()); return; }
      if (game.state === g.GAME_ST.PLAYING || game.state === g.GAME_ST.PAUSED) game.togglePause();
    });
    var btnSound = document.getElementById('btn-sound');
    if (btnSound) btnSound.addEventListener('click', function () {
      var muted = Sfx.toggle();
      btnSound.classList.toggle('off', muted);
      var img = btnSound.querySelector('img');
      if (img) img.src = 'assets/' + (muted ? 'icon_sound_off.svg' : 'icon_sound_on.svg');
    });

    /* ---------- 主循环：固定步长 60Hz ---------- */
    var last = 0, acc = 0;
    function frame(ts) {
      // 联机局完全交给帧同步内核驱动：收不齐双方输入就不推进，宁可等也不抢先跑
      if (online) {
        // 面板打开时暂停推进，免得在看房号的时候被敌人打穿
        if (!g.NetUI.isOpen()) {
          var nowNet = (typeof ts === 'number' && ts > 0)
            ? ts
            : (typeof performance !== 'undefined' ? performance.now() : Date.now());
          g.NetPlay.tick(nowNet);
        }
        last = 0; acc = 0;          // 退出联机时重新计秒，别把等待的时间补进去
        UI.draw(ctx, game);
        requestAnimationFrame(frame);
        return;
      }

      var now = (ts || 0) / 1000;
      if (!last) last = now;
      var dt = now - last;
      last = now;
      if (dt < 0) dt = 0;
      if (dt > 0.25) dt = 0.25;     // 切后台回来不要一次性补太多
      acc += dt;

      var n = 0;
      while (acc >= STEP && n < MAX_CATCHUP) {
        game.update(STEP);
        acc -= STEP;
        n++;
      }
      if (acc >= STEP) acc = 0;     // 追不上就丢弃积压，宁可慢一点也不要雪崩

      UI.draw(ctx, game);
      requestAnimationFrame(frame);
    }

    resize();

    // 联机状态探针：自动化验证与排查用，正常游玩不受影响
    g.__netInfo = function () {
      if (!online) return null;
      return { code: g.NetPlay.code(), slot: g.NetPlay.slot(), rtt: g.NetPlay.rtt() };
    };
    g.__net = function () {
      return {
        status: g.NetPlay.status(),
        frame: g.NetPlay.frame(),
        slot: g.NetPlay.slot(),
        code: g.NetPlay.code(),
        desync: g.NetPlay.desyncFrame(),
        rtt: g.NetPlay.rtt(),
        dbg: g.NetPlay.debug()
      };
    };

    // ?net=create 自动建房 / ?net=join=XXXX 自动进房（便于自动化验证与分享固定链接）
    var qs = window.location.search;
    if (/[?&]net=create(&|$)/.test(qs)) {
      g.NetUI.open();
      setTimeout(function () { g.NetPlay.createRoom(); g.NetUI.waiting('....', 0); }, 120);
    } else {
      var qJoin = /[?&]net=join=?([0-9A-Za-z]{0,4})/.exec(qs);
      if (qJoin) {
        var jc = (qJoin[1] || '').toUpperCase();
        g.NetUI.open();
        setTimeout(function () { g.NetPlay.joinRoom(jc); g.NetUI.waiting(jc, 1); }, 120);
      }
    }

    // ?auto=1 直接开局进入战斗（便于截图核对画面与自动化验证，不影响正常游玩）
    // ?fast=N  同步快进 N 个逻辑帧 —— headless 浏览器里 rAF 的推进不可控，
    //          要复现"打到第 6 秒"这种画面必须自己推帧，不能靠虚拟时间预算
    if (/[?&]auto=1(&|$)/.test(window.location.search)) {
      var qSeed = /[?&]seed=(\d+)/.exec(window.location.search);
      game.startNewGame(qSeed ? parseInt(qSeed[1], 10) : 20261101);
      game.state = g.GAME_ST.PLAYING;
      game.introT = 0;
      var qFast = /[?&]fast=(\d+)/.exec(window.location.search);
      if (qFast) {
        var steps = Math.min(36000, parseInt(qFast[1], 10) || 0);
        for (var fi = 0; fi < steps; fi++) game.update(STEP);
      }
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
