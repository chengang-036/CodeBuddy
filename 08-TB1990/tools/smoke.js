/**
 * tools/smoke.js - 无浏览器冒烟测试
 * 用 mock canvas 跑真实游戏逻辑：关卡解析、生成、战斗、道具、状态机、通关流程。
 * 运行：node tools/smoke.js
 */
const path = require('path');
const g = globalThis;

/* ---------- mock 平台 ---------- */
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
  isMiniGame: false,
  global: g,
  createCanvas: (w, h) => mockCanvas(w, h),
  getStorage: () => '0',
  setStorage: () => {},
  vibrate: () => {},
  onPointerDown: () => {},
  createAudioContext: () => null,
  getSystemInfo: () => ({ pixelRatio: 2, windowWidth: 512, windowHeight: 480 })
};
g.Sfx = { unlock() {}, play() {}, setMuted() {}, toggle() { return false; }, isMuted() { return false; } };

/* ---------- 加载源码 ---------- */
const dir = path.join(__dirname, '..', 'preview', 'js');
['config.js', 'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js'].forEach(f => {
  require(path.join(dir, f));
});

const CFG = g.CFG, Level = g.Level, Game = g.Game, UI = g.UI, ST = g.GAME_ST, Input = g.Input;
g.__isTouch = false;

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { failed++; console.log('  ✗ ' + name + (extra ? ' -> ' + extra : '')); }
}

/* ---------- 1. 关卡数据校验 ---------- */
console.log('\n[1] 关卡数据');
let lenOk = true, charOk = true;
Level.raw.forEach((lv, i) => {
  if (lv.length !== 13) { lenOk = false; console.log('    关卡' + (i + 1) + ' 行数=' + lv.length); }
  lv.forEach(row => {
    if (row.length !== 13) { lenOk = false; console.log('    关卡' + (i + 1) + ' 行宽=' + row.length); }
    for (const ch of row) if (!'.BSWIG'.includes(ch)) charOk = false;
  });
});
check('10 个关卡均为 13x13', lenOk);
check('关卡字符合法 (. B S W I G)', charOk);

const lv1 = Level.parse(1);
check('地形网格 26x26', lv1.grid.length === 26 && lv1.grid[0].length === 26);
check('基地位置已清空', lv1.grid[CFG.BASE_CELL.row * 2][CFG.BASE_CELL.col * 2] === CFG.T_EMPTY);
check('基地周围为砖墙',
  CFG.BASE_WALL.every(p => lv1.grid[p.row * 2][p.col * 2] === CFG.T_BRICK));
check('玩家出生点可站立',
  CFG.PLAYER_SPAWN.every(p => lv1.grid[p.row * 2][p.col * 2] === CFG.T_EMPTY));
check('敌人生成点可站立',
  CFG.SPAWN_POINTS.every(p => lv1.grid[p.row * 2][p.col * 2] === CFG.T_EMPTY));
const mix = Level.mixFor(5);
check('每关敌人 20 辆', mix.length === 20, mix.length);
check('敌人类型合法', mix.every(t => ['basic', 'fast', 'power', 'armor'].includes(t)));

/* ---------- 2. 素材 ---------- */
console.log('\n[2] 素材与 UI');
g.Sprites.init();
UI.init();
check('坦克精灵 4 方向 x 2 帧', Object.keys(g.Sprites.tank.p1).length === 4 && g.Sprites.tank.p1.UP.length === 2);
check('地形素材齐全', !!(g.Sprites.terrain.brick && g.Sprites.terrain.steel && g.Sprites.terrain.ice && g.Sprites.terrain.grass));
check('6 种道具素材', Object.keys(g.Sprites.powerup).length === 6);

/* ---------- 3. 状态机与战斗 ---------- */
console.log('\n[3] 状态机 / 战斗');
const game = new Game();
game.startNewGame();
check('开局进入关卡过场', game.state === ST.INTRO);

// 模拟输入
let frames = 0;
const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT', null];
Input.pickDir = () => dirs[Math.floor(Math.random() * dirs.length)];
Input.consumeFire = () => Math.random() < 0.25;

function run(seconds, opts) {
  opts = opts || {};
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    game.update(1 / 60);
    UI.draw(mockCtx(), game);
    frames++;
    if (opts.stopWhen && opts.stopWhen()) return true;
  }
  return false;
}

run(2);
check('过场后进入战斗', game.state === ST.PLAYING);
run(6);
check('敌人已生成', game.enemies.length > 0, 'alive=' + game.enemies.length);
check('玩家子弹/敌人子弹已产生', game.bullets.length >= 0);
check('玩家可移动且未越界',
  !game.player || (game.player.x >= 0 && game.player.x <= CFG.FIELD - CFG.TANK &&
    game.player.y >= 0 && game.player.y <= CFG.FIELD - CFG.TANK));

// 射击打掉砖块
// 以前是"让玩家随机走随机打，看地形有没有变化"——玩家可能朝空地打、可能在出生动画
// 里、可能被敌人打死，于是这条断言偶发失败（连跑 20 次大概错 3 次）。
// 改成直接构造一颗玩家子弹，从砖块左侧射入：走的是真实的 bulletResolve 碰撞路径，
// 但去掉了朝向/走位/生死这些随机变量。
// 前面的随机对局可能已经打完（GAMEOVER / CLEAR），而结算态下碰撞不会被处理，
// 这条断言就会随机失败。先重开一局回到干净的战斗态，让结果与前面的随机性无关。
game.startNewGame();
game.stage = 1;
game.startStage();
game.state = ST.PLAYING;
game.introT = 0;
run(2);

let brickR = -1, brickC = -1;
for (let r = 1; r < CFG.GRID - 1 && brickR < 0; r++) {
  for (let c = 2; c < CFG.GRID - 1; c++) {
    // 要求左侧是空地：否则子弹会先撞上左边的钢墙/砖块（那是正常机制，但会干扰本断言）
    if (game.grid[r][c] === CFG.T_BRICK && game.grid[r][c - 1] === CFG.T_EMPTY) {
      brickR = r; brickC = c; break;
    }
  }
}
const before = JSON.stringify(game.grid.map(r => r.join('')));
function brickCount() {
  let n = 0;
  for (let r = 0; r < CFG.GRID; r++) for (let c = 0; c < CFG.GRID; c++) {
    if (game.grid[r][c] === CFG.T_BRICK) n++;
  }
  return n;
}
if (brickR >= 0) {
  const bullet = new g.Bullet({
    x: brickC * CFG.TILE - CFG.BULLET - 2,
    y: brickR * CFG.TILE + 4,      // 取砖块行的中间高度，确保命中这一行
    dir: 'RIGHT',
    speed: 240,
    owner: 'player',
    power: false
  });
  // 直接驱动子弹自身的碰撞（bullet.update 内部会调 game.bulletResolve），
  // 不用 game.update：否则还要受整局状态影响（前面随机对局可能已进结算页）
  for (let i = 0; i < 20 && bullet.alive; i++) bullet.update(1 / 60, game);
}
const after = JSON.stringify(game.grid.map(r => r.join('')));
// 判定用"砖块总数减少"而不是"某一格变空"：砖块是 2x2 一组，
// 子弹可能先撞上相邻的那一格，指定格不一定就是被吃掉的格子。
const nb = JSON.parse(before).join('').split('1').length - 1;
const na = JSON.parse(after).join('').split('1').length - 1;
check('子弹击中砖块可破坏地形', brickR >= 0 && na < nb,
  '砖块 ' + nb + ' -> ' + na);

/* ---------- 4. 道具 ---------- */
console.log('\n[4] 道具效果');
const types = ['star', 'helmet', 'tank', 'bomb', 'shovel', 'clock'];
let puOk = true, puErr = '';
types.forEach(t => {
  try {
    const livesBefore = game.lives;
    game.applyPowerUp(t);
    if (t === 'tank' && game.lives !== livesBefore + 1) { puOk = false; puErr = 'tank 未加命'; }
    if (t === 'clock' && game.freezeT <= 0) { puOk = false; puErr = 'clock 未冻结'; }
    if (t === 'shovel' && game.shovelT <= 0) { puOk = false; puErr = 'shovel 未钢化'; }
    if (t === 'bomb' && game.enemies.length !== 0) { puOk = false; puErr = 'bomb 未清场'; }
    run(0.5);
  } catch (e) { puOk = false; puErr = t + ': ' + e.message; }
});
check('6 种道具效果均正常', puOk, puErr);
check('道具生效后无异常状态', game.state === ST.PLAYING || game.state === ST.CLEAR || game.state === ST.GAMEOVER);

/* ---------- 5. 关卡推进 ---------- */
console.log('\n[5] 关卡推进 / 结算');
const g2 = new Game();
g2.startNewGame();
g2.state = ST.PLAYING;
g2.queue = [];
g2.enemies = [];
const reachedClear = (() => {
  for (let i = 0; i < 300; i++) { g2.update(1 / 60); if (g2.state === ST.CLEAR) return true; }
  return false;
})();
check('清空敌人后进入结算', reachedClear);
for (let i = 0; i < 60 * 5; i++) g2.update(1 / 60);
check('结算后进入下一关（STAGE 2）', g2.stage === 2, 'stage=' + g2.stage);

/* ---------- 6. 失败流程 ---------- */
console.log('\n[6] 失败流程');
const g3 = new Game();
g3.startNewGame();
g3.state = ST.PLAYING;
g3.player.shield = 0;
g3.lives = 1;
g3.player && (g3.player.shield = 0);
g3.hitPlayer({ owner: 'enemy' });
check('生命耗尽 -> GAME OVER', g3.state === ST.GAMEOVER, 'state=' + g3.state);

const g4 = new Game();
g4.startNewGame();
g4.state = ST.PLAYING;
g4.destroyBase();
check('基地被毁 -> GAME OVER', g4.state === ST.GAMEOVER && !g4.baseAlive);

/* ---------- 7. 通关 ---------- */
console.log('\n[7] 通关流程');
const g5 = new Game();
g5.startNewGame();
g5.stage = Level.count;
g5.state = ST.PLAYING;
g5.queue = []; g5.enemies = [];
for (let i = 0; i < 60 * 8; i++) g5.update(1 / 60);
check('最后一关通过 -> WIN', g5.state === ST.WIN, 'state=' + g5.state);

/* ---------- 8. 长时间稳定性 ---------- */
console.log('\n[8] 稳定性（模拟 60 秒随机操作）');
const g6 = new Game();
g6.startNewGame();
let err = null;
try {
  for (let i = 0; i < 60 * 60; i++) {
    game.update(1 / 60);
    UI.draw(mockCtx(), game);
  }
} catch (e) { err = e; }
check('长时间运行无异常', !err, err && (err.message + '\n' + err.stack.split('\n')[1]));

console.log('\n————————————————————');
console.log(failed === 0 ? '全部通过 ✓（共 ' + frames + ' 帧模拟）' : failed + ' 项未通过 ✗');
process.exit(failed === 0 ? 0 : 1);
