const path = require('path'); const g = globalThis;
function mockCtx() { const n = () => {}; return { imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, globalCompositeOperation: '', fillRect: n, strokeRect: n, clearRect: n, drawImage: n, save: n, restore: n, translate: n, rotate: n, scale: n, setTransform: n, beginPath: n, closePath: n, moveTo: n, lineTo: n, stroke: n, fill: n, arc: n, fillText: n, strokeText: n, measureText: () => ({ width: 10 }) }; }
g.Platform = { isMiniGame: false, global: g, createCanvas: (w, h) => ({ width: w, height: h, getContext: () => mockCtx() }), getStorage: () => '0', setStorage: () => {}, vibrate: () => {}, onPointerDown: () => {}, createAudioContext: () => null, getSystemInfo: () => ({}) };
g.Sfx = { unlock() {}, play() {}, setMuted() {}, toggle() { return false; }, isMuted() { return false; } };
const dir = path.join(__dirname, '..', 'preview', 'js');
['config.js', 'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js'].forEach(f => require(path.join(dir, f)));
g.__isTouch = false; g.Sprites.init(); g.UI.init();
const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT', null];
g.Input.pickDir = () => dirs[Math.floor(Math.random() * dirs.length)];
g.Input.consumeFire = () => Math.random() < 0.25;
const game = new g.Game(); game.startNewGame();
for (let i = 0; i < 60 * 8; i++) {
  game.update(1 / 60);
  if (game.player && (isNaN(game.player.x) || isNaN(game.player.y))) { console.log('PLAYER NaN frame', i, JSON.stringify({ x: game.player.x, y: game.player.y, dir: game.player.dir, spawnT: game.player.spawnT, slideV: game.player.slideV, speed: game.player.speed })); process.exit(0); }
  for (const e of game.enemies) { if (isNaN(e.x) || isNaN(e.y)) { console.log('ENEMY NaN frame', i, JSON.stringify({ type: e.type, x: e.x, y: e.y, dir: e.dir, spawnT: e.spawnT, slideV: e.slideV, speed: e.speed, moving: e.moving, frozen: e.frozen })); process.exit(0); } }
}
console.log('done, state=', game.state, 'enemies=', game.enemies.length, 'player=', game.player && game.player.x, game.player && game.player.y);
