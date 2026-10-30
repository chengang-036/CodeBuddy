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

    // 虚拟按键
    var vmap = {
      'btn-up': 'up', 'btn-down': 'down', 'btn-left': 'left', 'btn-right': 'right', 'btn-fire': 'fire'
    };
    Object.keys(vmap).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var act = vmap[id];
      function down(e) { e.preventDefault(); Sfx.unlock(); Input.setVirtual(act, true); }
      function up(e) { e.preventDefault(); Input.setVirtual(act, false); }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

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
