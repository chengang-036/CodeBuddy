/**
 * tools/test-stick.js - 虚拟摇杆方向逻辑测试（无浏览器）
 * 验证 Input.setStickDir 的互斥语义：摇杆同一时刻只应有一个方向生效，
 * 且换向/松手后不能残留上一次的方向（否则会出现"粘键"——松手后坦克还在走）。
 * 运行：node tools/test-stick.js
 */
'use strict';

var path = require('path');
var g = globalThis;

function mockCtx() {
  var n = function () { };
  return {
    imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    globalCompositeOperation: '', fillRect: n, strokeRect: n, clearRect: n,
    drawImage: n, save: n, restore: n, translate: n, rotate: n, scale: n,
    setTransform: n, beginPath: n, closePath: n, moveTo: n, lineTo: n,
    stroke: n, fill: n, arc: n, fillText: n, strokeText: n,
    measureText: function () { return { width: 10 }; }
  };
}

g.Platform = {
  isMiniGame: false, global: g,
  createCanvas: function (w, h) { return { width: w, height: h, getContext: mockCtx }; },
  getStorage: function () { return '0'; }, setStorage: function () { },
  vibrate: function () { }, onPointerDown: function () { },
  createAudioContext: function () { return null; }, getSystemInfo: function () { return {}; }
};
g.Sfx = { unlock: function () { }, play: function () { }, setMuted: function () { }, toggle: function () { return false; }, isMuted: function () { return false; } };

var dir = path.join(__dirname, '..', 'preview', 'js');
['config.js', 'sprites.js', 'input.js'].forEach(function (f) {
  require(path.join(dir, f));
});

var Input = g.Input;
var pass = 0, fail = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

console.log('\n[1] 单方向生效');
Input.setStickDir('UP');
ok('推向 UP -> pickDir 返回 UP', Input.pickDir() === 'UP');
ok('推向 UP -> 只有 up 处于按下', Input.isDown('up') && !Input.isDown('down') && !Input.isDown('left') && !Input.isDown('right'));

console.log('\n[2] 换向不残留（这条是"粘键"的关键）');
Input.setStickDir('LEFT');
ok('UP 换 LEFT -> pickDir 返回 LEFT', Input.pickDir() === 'LEFT');
ok('UP 换 LEFT -> up 已释放', !Input.isDown('up'));
ok('UP 换 LEFT -> 只有一个方向按下', Input.isDown('left') && !Input.isDown('right') && !Input.isDown('down'));

console.log('\n[3] 松手清空');
Input.setStickDir(null);
ok('松手 -> pickDir 返回 null', Input.pickDir() === null);
ok('松手 -> hasDir 为 false', Input.hasDir() === false);

console.log('\n[4] 不影响开火键');
Input.setVirtual('fire', true);
Input.setStickDir('RIGHT');
ok('推摇杆不会清掉开火', Input.isDown('fire') === true);
ok('推摇杆同时开火 -> 方向与开火都在', Input.pickDir() === 'RIGHT' && Input.isDown('fire'));

console.log('\n[5] anyKey 事件在换向时触发（用于停止待机动画）');
var hits = [];
Input.on('anyKey', function (d) { hits.push(d); });
Input.setStickDir('DOWN');
Input.setStickDir('DOWN');   // 同方向重复设置不应重复触发
Input.setStickDir('UP');
ok('换向触发 2 次 anyKey（重复同向不触发）',
  hits.length === 2 && hits[0] === 'down' && hits[1] === 'up');

Input.setVirtual('fire', false);

console.log('\n————————————————————');
if (fail === 0) console.log('摇杆方向逻辑全部通过 ✓  pass=' + pass + ' fail=0');
else console.log('存在失败项 ✗  pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
