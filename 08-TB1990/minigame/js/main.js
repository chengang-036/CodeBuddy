/**
 * main.js - 网页端入口：画布适配、主循环、输入绑定
 * 说明：网页预览中所有 wx.* 能力均由 platform.js 的 mock 分支替代，打开即玩。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG, UI = g.UI, Input = g.Input, Sfx = g.Sfx, Platform = g.Platform;

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

    g.Sprites.init();
    UI.init();

    var game = new g.Game();
    g.__game = game;

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
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

    /* ---------- 输入 ---------- */
    Input.initKeyboard(window);

    Input.on('pause', function () {
      Sfx.unlock();
      if (game.state === g.GAME_ST.PLAYING || game.state === g.GAME_ST.PAUSED) game.togglePause();
    });
    Input.on('confirm', function () { Sfx.unlock(); game.confirm(); });

    // 空格在非游戏中也作为确认键
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && game.state !== g.GAME_ST.PLAYING) {
        Sfx.unlock();
        game.confirm();
      }
    });

    // 画布点击（移动端确认 / 暂停恢复）
    Platform.onPointerDown(function () {
      Sfx.unlock();
      if (game.state === g.GAME_ST.PAUSED) game.togglePause();
      else if (game.state !== g.GAME_ST.PLAYING && game.state !== g.GAME_ST.INTRO) game.confirm();
    });

    // 开火键（按住连发由射速冷却节流）
    (function bindFire() {
      var el = document.getElementById('btn-fire');
      if (!el) return;
      function down(e) { e.preventDefault(); Sfx.unlock(); Input.setVirtual('fire', true); }
      function up(e) { e.preventDefault(); Input.setVirtual('fire', false); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    })();

    /* ---------- 虚拟摇杆 ----------
     * 浮动原点：手指按下的位置就是圆心，不要求精确按在摇杆中心；
     * 拖动超过死区后按「主导轴」判定四方向（坦克是四向移动，不做八向）；
     * 松手立即复位并清方向，避免"粘键"。
     */
    (function bindStick() {
      var zone = document.getElementById('stick-zone');
      var base = document.getElementById('stick-base');
      var knob = document.getElementById('stick-knob');
      if (!zone || !base || !knob) return;

      var DEAD = 14;                 // 死区半径（px）
      var baseSize = 132, knobR = 31;
      var maxR = 34;                 // 摇杆帽可动半径（= 底盘半径 - 帽半径，防止推出底盘）
      var home = { x: 18, y: 18 };
      var origin = null;             // 手指按下点（zone 局部坐标）
      var pid = null;                // 当前摇杆的 pointerId

      function measure() {
        var br = base.getBoundingClientRect();
        var kr = knob.getBoundingClientRect();
        baseSize = br.width || 132;
        knobR = (kr.width || 62) / 2;
        maxR = Math.max(18, baseSize / 2 - knobR - 2);
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
        Input.setStickDir(null);
        base.classList.remove('active');
        base.removeAttribute('data-dir');
        base.style.transform = 'translate(' + home.x + 'px,' + home.y + 'px)';
        knob.style.transform = 'translate(0px,0px)';
        origin = null; pid = null;
      }

      function apply(p) {
        if (!origin) return;
        var dx = p.x - origin.x, dy = p.y - origin.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var kx = dx, ky = dy;
        if (d > maxR) { kx = dx / d * maxR; ky = dy / d * maxR; }
        knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';

        if (d < DEAD) {                       // 死区内：不动
          Input.setStickDir(null);
          base.removeAttribute('data-dir');
          return;
        }
        var dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'RIGHT' : 'LEFT')
          : (dy > 0 ? 'DOWN' : 'UP');
        Input.setStickDir(dir);
        base.setAttribute('data-dir', dir);
      }

      zone.addEventListener('pointerdown', function (e) {
        if (pid !== null) return;             // 已有手指在操作摇杆
        e.preventDefault();
        Sfx.unlock();
        pid = e.pointerId;
        try { zone.setPointerCapture(pid); } catch (err) { }

        var p = local(e);
        // 限制圆心落在 zone 内，避免底盘跑出可视区域
        var half = baseSize / 2;
        origin = {
          x: Math.min(Math.max(p.x, half), zone.clientWidth - half),
          y: Math.min(Math.max(p.y, half), zone.clientHeight - half)
        };
        base.style.transition = 'none';
        base.style.transform = 'translate(' + (origin.x - half) + 'px,' + (origin.y - half) + 'px)';
        base.classList.add('active');
        knob.style.transform = 'translate(0px,0px)';
        apply(p);
      });

      zone.addEventListener('pointermove', function (e) {
        if (e.pointerId !== pid || !origin) return;
        e.preventDefault();
        apply(local(e));
      });

      function end(e) {
        if (e.pointerId !== pid) return;
        base.style.transition = '';
        reset();
      }
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', function () { setTimeout(measure, 150); });
      measure();
    })();

    // 顶部按钮
    var btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', function () {
      Sfx.unlock();
      if (game.state === g.GAME_ST.PLAYING || game.state === g.GAME_ST.PAUSED) game.togglePause();
    });
    var btnSound = document.getElementById('btn-sound');
    if (btnSound) btnSound.addEventListener('click', function () {
      var muted = Sfx.toggle();
      btnSound.classList.toggle('off', muted);
      var img = btnSound.querySelector('img');
      if (img) img.src = 'assets/' + (muted ? 'icon_sound_off.svg' : 'icon_sound_on.svg');
    });

    /* ---------- 主循环 ---------- */
    var last = 0;
    function frame(ts) {
      var now = (ts || 0) / 1000;
      var dt = last ? Math.min(0.05, now - last) : 0.016;
      last = now;
      game.update(dt);
      UI.draw(ctx, game);
      requestAnimationFrame(frame);
    }

    resize();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
