/**
 * tools/test-hold-fire.js - 验证「按住开火键 = 连发」与「点按 = 单发」
 * 运行：node tools/test-hold-fire.js
 */
const path = require('path');
const g = globalThis;

function mockCtx() {
  const noop = () => {};
  return {
    imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillRect: noop, strokeRect: noop, clearRect: noop, drawImage: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, stroke: noop, fill: noop, arc: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 10 })
  };
}
function mockCanvas(w, h) { return { width: w, height: h, getContext: () => mockCtx() }; }

g.Platform = {
  isMiniGame: false, global: g,
  createCanvas: (w, h) => mockCanvas(w, h),
  getStorage: () => '0', setStorage: () => {},
  vibrate: () => {}, onPointerDown: () => {},
  createAudioContext: () => null, getSystemInfo: () => ({})
};
g.Sfx = { unlock() {}, play() {}, setMuted() {}, toggle() { return false; }, isMuted() { return false; } };
g.__isTouch = true;

const dir = path.join(__dirname, '..', 'preview', 'js');
['config.js', 'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js']
  .forEach(f => require(path.join(dir, f)));

g.Sprites.init();
g.UI.init();

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ✓ ' + name); pass++; }
  else { console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); fail++; }
}

/* 场景 A：按住开火键 2 秒，应连续发射多发 */
g.Input.reset();
const gameA = new g.Game();
gameA.startNewGame();
gameA.state = g.GAME_ST.PLAYING;
gameA.introT = 0;
gameA.player.spawnT = 0;
// 清空敌人，避免干扰与误伤
gameA.enemies.length = 0;

let firedA = 0;
const origFire = gameA.fire.bind(gameA);
gameA.fire = function (t) { const r = origFire(t); if (r !== false) firedA++; return r; };

g.Input.setVirtual('fire', true);   // 手指按下，之后不再触发任何事件
for (let i = 0; i < 120; i++) gameA.update(1 / 60);   // 2 秒
g.Input.setVirtual('fire', false);

check('按住开火 2 秒可打出多发（连发生效）', firedA >= 3, '实际 ' + firedA + ' 发');

/* 场景 B：只点一下（按下后立即抬起），应只发 1 发 */
g.Input.reset();
const gameB = new g.Game();
gameB.startNewGame();
gameB.state = g.GAME_ST.PLAYING;
gameB.introT = 0;
gameB.player.spawnT = 0;
gameB.enemies.length = 0;

let firedB = 0;
const origFireB = gameB.fire.bind(gameB);
gameB.fire = function (t) { const r = origFireB(t); if (r !== false) firedB++; return r; };

g.Input.setVirtual('fire', true);
gameB.update(1 / 60);            // 按下的那一帧
g.Input.setVirtual('fire', false);
for (let i = 0; i < 60; i++) gameB.update(1 / 60);   // 抬起后 1 秒

check('点按一次只发 1 发（不会漏按也不会连喷）', firedB === 1, '实际 ' + firedB + ' 发');

/* 场景 C：按住不超过射速上限（2 秒内不应超过理论最大发数） */
const maxByRate = Math.floor(2 / g.CFG.PLAYER.fireCd[1]) + 1;
check('连发受射速冷却约束（不越界）', firedA <= maxByRate, '实际 ' + firedA + ' 发，理论上限 ' + maxByRate);

console.log('\n' + (fail === 0 ? '按住连发验证全部通过 ✓' : '存在失败项 ✗') + '  pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
