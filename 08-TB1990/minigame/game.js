/**
 * game.js - 微信小游戏入口
 * 与网页预览共用 preview/js 下的同一份源码（由 tools/build_minigame.sh 同步）。
 * 微信平台能力（createCanvas / onTouchStart / 系统 API）均按官方文档使用；
 * 本工程为单机玩法，不涉及登录/支付等需要额外资质的接口。
 */
/* eslint-disable */
GameGlobal.__isTouch = true;

require('./js/platform.js');
require('./js/config.js');
require('./js/sprites.js');
require('./js/audio.js');
require('./js/input.js');
require('./js/level.js');
require('./js/entities.js');
require('./js/game.js');
require('./js/ui.js');

var CFG = GameGlobal.CFG, UI = GameGlobal.UI, Sfx = GameGlobal.Sfx;
var Input = GameGlobal.Input, Platform = GameGlobal.Platform, ST = GameGlobal.GAME_ST;

var info = Platform.getSystemInfo();
var canvas = wx.createCanvas(); // 第一次调用创建主画布（官方文档）
GameGlobal.__mainCanvas = canvas;
var ctx = canvas.getContext('2d');

var dpr = info.pixelRatio || 2;
canvas.width = Math.floor(info.windowWidth * dpr);
canvas.height = Math.floor(info.windowHeight * dpr);

GameGlobal.Sprites.init();
UI.init();

var game = new Game();
GameGlobal.__game = game;

/* ---------- 触摸操作：左半屏滑动 = 方向，右半屏点按 = 射击 ---------- */
var TH = 14; // 方向判定阈值（px）
function setVDir(d) {
  ['up', 'down', 'left', 'right'].forEach(function (k) { Input.setVirtual(k, false); });
  if (d) Input.setVirtual(d.toLowerCase(), true);
}

var dirTouchId = null, fireTouchId = null, touchStart = null;

wx.onTouchStart(function (res) {
  Sfx.unlock();
  if (res.touches.length === 0) return;
  var t = res.touches[0];
  if (game.state === ST.PAUSED) { game.togglePause(); return; }
  if (game.state !== ST.PLAYING) { game.confirm(); return; }
  if (t.clientX < info.windowWidth / 2) {
    if (dirTouchId === null) { dirTouchId = t.identifier; touchStart = { x: t.clientX, y: t.clientY }; }
  } else {
    if (fireTouchId === null) { fireTouchId = t.identifier; Input.setVirtual('fire', true); }
  }
});

wx.onTouchMove(function (res) {
  for (var i = 0; i < res.changedTouches.length; i++) {
    var t = res.changedTouches[i];
    if (t.identifier === dirTouchId && touchStart) {
      var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.abs(dx) > TH || Math.abs(dy) > TH) {
        setVDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
      }
    }
  }
});

function onTouchEnd(res) {
  for (var i = 0; i < res.changedTouches.length; i++) {
    var t = res.changedTouches[i];
    if (t.identifier === dirTouchId) { dirTouchId = null; touchStart = null; setVDir(null); }
    if (t.identifier === fireTouchId) { fireTouchId = null; Input.setVirtual('fire', false); }
  }
}
wx.onTouchEnd(onTouchEnd);
wx.onTouchCancel(onTouchEnd);

/* ---------- 主循环（letterbox 居中适配） ---------- */
var last = 0;
function frame() {
  var now = Date.now() / 1000;
  var dt = last ? Math.min(0.05, now - last) : 0.016;
  last = now;
  game.update(dt);

  var s = Math.min(canvas.width / CFG.W, canvas.height / CFG.H);
  var tx = (canvas.width - CFG.W * s) / 2;
  var ty = (canvas.height - CFG.H * s) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, tx, ty);
  UI.draw(ctx, game);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
