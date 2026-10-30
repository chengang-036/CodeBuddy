/**
 * tools/dump-tank.js - 把坦克精灵导出成 ASCII 字符画
 * 用 mock canvas 记录每次 fillRect，直接看清 32x32 网格里到底画了什么，
 * 避免"看图猜代码"。
 * 运行：node tools/dump-tank.js
 */
const path = require('path');
const JS = '/Users/tiger/WorkBuddy/2026-10-26-19-12-20/tank1990/preview/js';

const COLOR = {
  '#141418': 'K',   // 外描边黑
  '#ffe066': 'L',   // 亮（炮塔/炮管）
  '#f0a800': 'M',   // 中间色（车体）
  '#8a5c00': 'D',   // 暗（履带/尾部阴影）
  '#ffffff': 'W'    // 炮口高光
};

const canvases = [];

function makeCanvas(w, h) {
  const cv = { width: w, height: h, _w: w, _h: h };
  cv._grid = Array.from({ length: h }, () => Array(w).fill('.'));
  cv.getContext = () => {
    const ctx = {
      imageSmoothingEnabled: false,
      fillStyle: '',
      fillRect(x, y, fw, fh) {
        const ch = COLOR[String(this.fillStyle).toLowerCase()] || '?';
        for (let yy = y; yy < y + fh; yy++) {
          for (let xx = x; xx < x + fw; xx++) {
            if (yy >= 0 && yy < cv._h && xx >= 0 && xx < cv._w) cv._grid[yy][xx] = ch;
          }
        }
      },
      clearRect() {}, drawImage() {}, save() {}, restore() {}, translate() {},
      rotate() {}, scale() {}, setTransform() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
      fillText() {}, strokeText() {}, measureText: () => ({ width: 10 })
    };
    cv._ctx = ctx;
    return ctx;
  };
  canvases.push(cv);
  return cv;
}

globalThis.Platform = {
  isMiniGame: false,
  global: globalThis,
  createCanvas: makeCanvas,
  getStorage: () => '0', setStorage() {}, vibrate() {},
  onPointerDown() {}, createAudioContext: () => null, getSystemInfo: () => ({})
};

require(path.join(JS, 'config.js'));
require(path.join(JS, 'sprites.js'));
globalThis.Sprites.init();

function print(cv, label) {
  console.log('\n=== ' + label + ' (' + cv._w + 'x' + cv._h + ') ===');
  console.log('    ' + Array.from({ length: cv._w }, (_, i) => (i % 10)).join(''));
  cv._grid.forEach((row, i) => {
    console.log(String(i).padStart(3, ' ') + ' ' + row.join(''));
  });
}

// 找出所有 32x32 且不是全空的画布（第一个就是朝上的 p1 帧 0）
const tanks = canvases.filter(c => c._w === 32 && c._h === 32 &&
  c._grid.some(r => r.some(ch => ch !== '.')));
print(tanks[0], '玩家坦克 · 朝上 · 帧0');
console.log('\n图例：K=黑描边  L=亮  M=中  D=暗  W=白（炮口高光）  .=透明');
console.log('说明：整块 K 是底板，透明区才是真正的剪影之外。');
