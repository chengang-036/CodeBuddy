/**
 * tools/test-coop.js - 双人合作（P1）无浏览器测试
 *
 * 覆盖：
 *   1. 单/双人敌人表
 *   2. 双人开局：两辆坦克、两套席位、配色区分
 *   3. 输入双通道互不串味（含单人模式合并键位）
 *   4. 生命独立结算：一人出局不影响队友，两人出局才失败
 *   5. 无友伤
 *   6. 道具归属拾取者
 *   7. 敌人 AI 追最近的玩家
 *   8. 确定性：同 seed + 同输入序列 → 逐帧状态哈希一致
 *   9. 过关 / 失败流程
 *  10. 双人长时间稳定性
 *
 * 运行：node tools/test-coop.js
 */
'use strict';
const path = require('path');
const g = globalThis;

/* ---------- mock 平台（无 DOM） ---------- */
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
  getSystemInfo: () => ({ pixelRatio: 2, windowWidth: 390, windowHeight: 844 })
};
g.Sfx = { unlock() {}, play() {}, setMuted() {}, toggle() { return false; }, isMuted() { return false; } };
g.__isTouch = true;

/* ---------- 加载源码（顺序与 index.html 一致） ---------- */
const dir = path.join(__dirname, '..', 'client', 'js');
require(path.join(__dirname, '..', 'shared', 'hash.js'));
['prng.js', 'rng.js', 'config.js', 'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js']
  .forEach(f => { require(path.join(dir, f)); });

const CFG = g.CFG, Level = g.Level, Game = g.Game, UI = g.UI, ST = g.GAME_ST, Input = g.Input, RNG = g.RNG;

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { failed++; console.log('  ✗ ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}
function section(t) { console.log('\n[' + t + ']'); }

g.Sprites.init();
UI.init();

/* ================= 1. 单/双人敌人数 ================= */
section('1. 敌人数量按模式区分');
check('单人每关 20 辆', Level.mixFor(5, CFG.MODE_SINGLE).length === 20);
check('双人每关 28 辆', Level.mixFor(5, CFG.MODE_COOP).length === 28);
check('双人敌人类型合法',
  Level.mixFor(3, CFG.MODE_COOP).every(t => ['basic', 'fast', 'power', 'armor'].includes(t)));

/* ================= 2. 双人开局 ================= */
section('2. 双人开局');
const g1 = new Game();
g1.setMode(CFG.MODE_COOP);
g1.startNewGame(20261101);
check('席位 2 个', g1.seats.length === 2, g1.seats.length);
check('两辆玩家坦克都在场', !!g1.players[0] && !!g1.players[1]);
check('两名玩家出生点不同',
  g1.players[0].x !== g1.players[1].x || g1.players[0].y !== g1.players[1].y);
check('pid 分别是 0 / 1', g1.players[0].pid === 0 && g1.players[1].pid === 1);
check('两人精灵配色不同（黄 / 绿）',
  g1.players[0].spriteKey() === 'p1' && g1.players[1].spriteKey() === 'q1',
  g1.players[0].spriteKey() + ' vs ' + g1.players[1].spriteKey());
check('每人各 3 条命', g1.seats[0].lives === 3 && g1.seats[1].lives === 3);
check('开局进入过场', g1.state === ST.INTRO);

const gSingle = new Game();
gSingle.setMode(CFG.MODE_SINGLE);
gSingle.startNewGame(7);
check('单人模式只有 1 席 1 车',
  gSingle.seats.length === 1 && gSingle.players.length === 1 && !!gSingle.players[0]);

/* ================= 3. 输入双通道 ================= */
section('3. 输入双通道互不串味');
Input.reset();
Input.setMode(2);

Input.setStickDir(0, 'LEFT');
check('P1 推左 → 只有 P1 收到 LEFT',
  Input.pickDir(0) === 'LEFT' && Input.pickDir(1) === null,
  Input.pickDir(0) + ' / ' + Input.pickDir(1));

Input.setStickDir(1, 'DOWN');
check('P2 推下 → 两人方向各自独立',
  Input.pickDir(0) === 'LEFT' && Input.pickDir(1) === 'DOWN');

Input.setStickDir(1, null);
check('P2 松手不影响 P1', Input.pickDir(0) === 'LEFT' && Input.pickDir(1) === null);

Input.reset();
Input.setVirtual(1, 'fire', true);
check('P2 开火键只点亮 P2', Input.isDown('fire', 1) && !Input.isDown('fire', 0));
check('边沿只在 P2 通道', Input.consumeFire(1) === true && Input.consumeFire(0) === false);
Input.setVirtual(1, 'fire', false);

Input.reset();
Input.setVirtual(0, 'fire', true);
Input.setVirtual(1, 'fire', true);
check('两人同时开火互不覆盖', Input.isDown('fire', 0) && Input.isDown('fire', 1));
Input.reset();

// 单人模式：方向键（P2 通道）并入 P1
Input.setMode(1);
Input.setStickDir(1, 'UP');
check('单人模式下 P2 键位并入 P1', Input.pickDir(0) === 'UP', Input.pickDir(0));
Input.setVirtual(1, 'fire', true);
check('单人模式下空格（P2 通道）也能让 P1 开火', Input.isDown('fire', 0));
Input.reset();
Input.setMode(2);

/* ================= 4. 生命独立结算 ================= */
section('4. 生命独立结算');
const g2 = new Game();
g2.setMode(CFG.MODE_COOP);
g2.startNewGame(555);
g2.state = ST.PLAYING;
g2.introT = 0;

function killOnce(game, pid) {
  const p = game.players[pid];
  if (!p) return false;
  p.shield = 0;
  game.hitPlayer(p, { owner: 'enemy', x: p.x, y: p.y });
  return true;
}

killOnce(g2, 0);
check('P1 被打掉一条命', g2.seats[0].lives === 2, g2.seats[0].lives);
check('P2 生命不受影响', g2.seats[1].lives === 3, g2.seats[1].lives);
check('P1 进入重生等待', g2.players[0] === null && g2.respawnT[0] > 0);
check('P2 仍在场上', !!g2.players[1]);
check('此时游戏未结束', g2.state === ST.PLAYING);

// 让 P1 的命全部耗尽
for (let i = 0; i < 6 && g2.seats[0].lives > 0; i++) {
  if (!g2.players[0]) { g2.spawnPlayer(0, true); g2.players[0].shield = 0; }
  killOnce(g2, 0);
}
check('P1 三条命耗尽后出局', g2.seats[0].lives === 0 && g2.players[0] === null);
check('P1 出局后不会重生', (function () {
  for (let i = 0; i < 120; i++) g2.update(1 / 60);
  return g2.players[0] === null;
})());
check('P2 还活着，游戏继续', g2.state === ST.PLAYING && !!g2.players[1], 'state=' + g2.state);

// P2 也打光 → 才 GAMEOVER
for (let i = 0; i < 6 && g2.seats[1].lives > 0; i++) {
  if (!g2.players[1]) { g2.spawnPlayer(1, true); if (g2.players[1]) g2.players[1].shield = 0; }
  if (g2.players[1]) killOnce(g2, 1);
}
check('两人全部出局 → GAME OVER', g2.state === ST.GAMEOVER, 'state=' + g2.state);

/* ================= 5. 无友伤 ================= */
section('5. 玩家子弹不伤队友');
const g3 = new Game();
g3.setMode(CFG.MODE_COOP);
g3.startNewGame(99);
g3.state = ST.PLAYING;
g3.introT = 0;
g3.enemies = [];
g3.bullets = [];

const p2t = g3.players[1];
p2t.shield = 0;
p2t.spawnT = 0;
// 从 P2 左侧造一颗玩家子弹，正对 P2 射过去
const friendly = new g.Bullet({
  x: p2t.x - CFG.BULLET - 2,
  y: p2t.y + CFG.TANK / 2 - CFG.BULLET / 2,
  dir: 'RIGHT', speed: 200, owner: 'player', power: false
});
g3.bullets.push(friendly);
for (let i = 0; i < 30 && friendly.alive; i++) friendly.update(1 / 60, g3);
check('队友子弹穿过 P2 不扣命', g3.seats[1].lives === 3, g3.seats[1].lives);
check('队友子弹也不会把 P2 打消失', !!g3.players[1]);

/* ================= 6. 道具归属 ================= */
section('6. 道具作用于拾取者');
const g4 = new Game();
g4.setMode(CFG.MODE_COOP);
g4.startNewGame(321);
g4.state = ST.PLAYING;
const l0 = g4.seats[0].lives, l1 = g4.seats[1].lives;
g4.applyPowerUp('tank', g4.players[0]);
check('P1 捡加命 → 只加 P1', g4.seats[0].lives === l0 + 1 && g4.seats[1].lives === l1,
  g4.seats[0].lives + '/' + g4.seats[1].lives);
g4.applyPowerUp('star', g4.players[1]);
check('P2 捡升级 → 只升 P2', g4.players[1].level === 2 && g4.players[0].level === 1,
  g4.players[1].level + '/' + g4.players[0].level);
g4.applyPowerUp('helmet', g4.players[1]);
check('P2 捡头盔 → 只护 P2', g4.players[1].shield > 0 && g4.players[0].shield <= CFG.PLAYER.spawnShield);
const beforeEnemies = g4.enemies.length;
g4.enemies.push(new g.Tank({ x: 100, y: 100, type: 'basic' }));
g4.applyPowerUp('bomb', g4.players[0]);
check('炸弹是全场效果（合作模式共享）', g4.enemies.length === 0, g4.enemies.length);

/* ================= 7. 敌人追最近的玩家 ================= */
section('7. 敌人 AI 选择最近玩家');
const g5 = new Game();
g5.setMode(CFG.MODE_COOP);
g5.startNewGame(4242);
g5.state = ST.PLAYING;
const dummy = new g.Tank({ x: 0, y: 0, type: 'basic' });
g5.players[0].spawnT = 0;
g5.players[1].spawnT = 0;
g5.players[0].x = 32; g5.players[0].y = 32;
g5.players[1].x = 320; g5.players[1].y = 320;
dummy.x = 48; dummy.y = 48;
check('离 P1 近时锁定 P1', g5.nearestPlayer(dummy) === g5.players[0]);
dummy.x = 300; dummy.y = 300;
check('离 P2 近时锁定 P2', g5.nearestPlayer(dummy) === g5.players[1]);
g5.players[0] = null;
check('P1 出局后只锁 P2', g5.nearestPlayer(dummy) === g5.players[1]);
dummy.x = 48; dummy.y = 48;
check('唯一的玩家在远处也照样锁定', g5.nearestPlayer(dummy) === g5.players[1]);

/* ================= 8. 确定性（同 seed 同输入） ================= */
section('8. 确定性：同 seed + 同输入 → 状态哈希一致');

function hashGame(game) {
  const H = new g.HASH.Hash();
  H.int(game.stage).int(game.score).int(game.queue.length).int(game.enemies.length);
  H.bool(game.baseAlive).int(Math.round(game.freezeT * 16)).int(Math.round(game.shovelT * 16));
  // 敌人队列的类型顺序也要入哈希，否则「数量一样但顺序不同」会被漏掉
  for (let i = 0; i < game.queue.length; i++) H.str(game.queue[i]);
  for (let i = 0; i < game.seats.length; i++) H.int(game.seats[i].lives).int(game.seats[i].level);
  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    if (!p) { H.int(-1); continue; }
    H.int(p.pid).fixed(p.x).fixed(p.y).str(p.dir).int(p.level)
      .fixed(p.shield).int(p.spawnT > 0 ? 1 : 0).fixed(p.fireTimer);
  }
  for (let i = 0; i < game.enemies.length; i++) {
    const e = game.enemies[i];
    H.str(e.type).fixed(e.x).fixed(e.y).str(e.dir).int(e.hp).fixed(e.fireTimer);
  }
  for (let i = 0; i < game.bullets.length; i++) {
    const b = game.bullets[i];
    H.fixed(b.x).fixed(b.y).str(b.dir).str(b.owner);
  }
  for (let i = 0; i < game.powerups.length; i++) {
    const u = game.powerups[i];
    H.fixed(u.x).fixed(u.y).str(u.type);
  }
  for (let r = 0; r < CFG.GRID; r++) for (let c = 0; c < CFG.GRID; c++) H.int(game.grid[r][c]);
  H.int(RNG.state().count);      // 随机数消耗位置也必须一致
  return H.value();
}

const DIRS = ['UP', 'RIGHT', 'DOWN', 'LEFT', null];
function driveInput(frame) {
  const a = Math.floor(frame / 20) % 5;
  Input.setStickDir(0, DIRS[a]);
  Input.setStickDir(1, DIRS[(a + 2) % 5]);
  Input.setVirtual(0, 'fire', (frame % 7) < 4);
  Input.setVirtual(1, 'fire', (frame % 11) < 5);
  if ((frame % 13) === 0) Input.setVirtual(0, 'fire', true);
}

function runSim(seed, frames) {
  Input.reset();
  const game = new Game();
  game.setMode(CFG.MODE_COOP);
  game.startNewGame(seed);
  const hashes = [];
  for (let f = 0; f < frames; f++) {
    driveInput(f);
    game.update(1 / 60);
    if (f % 30 === 0) hashes.push(hashGame(game));
  }
  return { hashes, game };
}

const A = runSim(20261101, 900);
const B = runSim(20261101, 900);
let firstDiff = -1;
for (let i = 0; i < Math.min(A.hashes.length, B.hashes.length); i++) {
  if (A.hashes[i] !== B.hashes[i]) { firstDiff = i * 30; break; }
}
check('900 帧内逐帧哈希完全一致（' + A.hashes.length + ' 个采样点）', firstDiff < 0,
  firstDiff >= 0 ? '第 ' + firstDiff + ' 帧开始分叉' : '');
check('两次模拟最终分数相同', A.game.score === B.game.score, A.game.score + ' / ' + B.game.score);

const C = runSim(777, 900);
// 注意：开局前 96 帧是 INTRO 过场（1.6s），场上只有两辆静止的坦克，
// 不同 seed 在这些采样点必然相同。所以要比较整串，而不是取前几个点。
check('换 seed 会产生不同局面（说明随机确实生效）',
  C.hashes.some((h, i) => h !== A.hashes[i]), '两串哈希完全相同，随机没生效');

/* ================= 9. 过关 / 失败 ================= */
section('9. 过关与失败流程');
const g6 = new Game();
g6.setMode(CFG.MODE_COOP);
g6.startNewGame(2024);
g6.state = ST.PLAYING;
g6.queue = [];
g6.enemies = [];
let cleared = false;
for (let i = 0; i < 400; i++) { g6.update(1 / 60); if (g6.state === ST.CLEAR) { cleared = true; break; } }
check('双人清场后进入结算', cleared, 'state=' + g6.state);
for (let i = 0; i < 60 * 6; i++) g6.update(1 / 60);
check('结算后进入下一关', g6.stage === 2, 'stage=' + g6.stage);
check('新一关两人都重新出场', !!g6.players[0] && !!g6.players[1]);

const g7 = new Game();
g7.setMode(CFG.MODE_COOP);
g7.startNewGame(11);
g7.state = ST.PLAYING;
g7.destroyBase();
check('基地被毁 → GAME OVER（即使两人都活着）',
  g7.state === ST.GAMEOVER && !g7.baseAlive && g7.seats[0].lives > 0);
check('失败原因文案正确', g7.overReason === '基地被摧毁', g7.overReason);

/* ================= 10. 稳定性 ================= */
section('10. 双人长时间稳定性');
const g8 = new Game();
g8.setMode(CFG.MODE_COOP);
g8.startNewGame(8888);
let err = null, drawErr = null;
try {
  for (let f = 0; f < 60 * 90; f++) {
    driveInput(f);
    g8.update(1 / 60);
  }
} catch (e) { err = e; }
try { UI.draw(mockCtx(), g8); } catch (e) { drawErr = e; }
check('模拟 90 秒无异常', !err, err && err.message);
check('双人 HUD 绘制无异常', !drawErr, drawErr && drawErr.message);
check('状态合法',
  [ST.TITLE, ST.INTRO, ST.PLAYING, ST.PAUSED, ST.CLEAR, ST.GAMEOVER, ST.WIN].includes(g8.state),
  g8.state);
check('玩家坐标未越界', g8.players.every(p => !p ||
  (p.x >= 0 && p.x <= CFG.FIELD - CFG.TANK && p.y >= 0 && p.y <= CFG.FIELD - CFG.TANK)));
check('子弹数量没有失控', g8.bullets.length < 80, g8.bullets.length);
check('敌人数量不超过同屏上限', g8.enemies.length <= CFG.ENEMY.maxAliveCoop, g8.enemies.length);

/* ================= 11. 标题页点击命中 ================= */
section('11. 标题页 1P / 2P 按钮命中');
const L = UI.titleLayout();
function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
check('点 P1 按钮返回 p1', UI.titleHit(center(L.p1).x, center(L.p1).y) === 'p1');
check('点 P2 按钮返回 p2', UI.titleHit(center(L.p2).x, center(L.p2).y) === 'p2');
check('点空白处不命中', UI.titleHit(256, 470) === null);
check('两个按钮不重叠', L.p1.x + L.p1.w < L.p2.x);
check('按钮都在画布内',
  L.p2.x + L.p2.w <= CFG.W && L.start.y + L.start.h <= CFG.H);

console.log('\n————————————————————');
console.log(failed === 0 ? '全部通过 ✓' : failed + ' 项未通过 ✗');
process.exit(failed === 0 ? 0 : 1);
