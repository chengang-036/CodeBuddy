/**
 * tools/test-online.js - 联机一致性测试（无浏览器，但跑的是客户端真实代码）
 *
 * 关键设计：两个玩家各跑在**独立的 vm 上下文**里。
 * 这不是过度设计——客户端有一批模块级单例（RNG / Sprites / Config），
 * 如果在同一个 Node 进程里共用，两端的随机序列会互相污染，
 * 测出来的「不一致」全是假的（我第一版就踩了这个坑，白查半小时）。
 * 两台手机本来就是两个独立 JS 环境，用 vm 隔开才等价于真机。
 *
 * 场景：
 *   1. 理想网络（0 延迟）
 *   2. 真实网络（单程 33ms + 抖动）
 *   3. 高延迟（单程 100ms）
 *   4. 一端短时卡顿（验证补帧不会死锁）
 *   5. 输入归属（P1 左 / P2 右 各走各的）
 *   6. 反例（一端多消耗一次随机数 → 必须被哈希检出）
 *
 * 运行：node tools/test-online.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CLIENT_JS = path.join(__dirname, '..', 'client', 'js');
const Rooms = require('../server/rooms').Rooms;

const FILES = ['prng.js', 'hash.js', 'protocol.js', 'lockstep.js', 'rng.js', 'config.js',
  'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js',
  'netinput.js', 'statehash.js'];
const SOURCES = FILES.map((f) => ({ name: f, code: fs.readFileSync(path.join(CLIENT_JS, f), 'utf8') }));

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { failed++; console.log('  ✗ ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n[' + t + ']'); }

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

/** 造一个「设备」：独立全局、独立 RNG、独立游戏对象 */
function makeDevice() {
  const sandbox = { console, __isTouch: false };
  sandbox.globalThis = sandbox;
  sandbox.Platform = {
    isMiniGame: false, global: sandbox,
    createCanvas: (w, h) => ({ width: w, height: h, getContext: mockCtx }),
    getStorage: () => '0', setStorage: () => {}, vibrate: () => {}, onPointerDown: () => {},
    createAudioContext: () => null,
    getSystemInfo: () => ({ pixelRatio: 2, windowWidth: 390, windowHeight: 844 })
  };
  sandbox.Sfx = { unlock() {}, play() {}, setMuted() {}, toggle() { return false; }, isMuted() { return false; } };
  vm.createContext(sandbox);
  for (const s of SOURCES) vm.runInContext(s.code, sandbox, { filename: s.name });
  sandbox.Sprites.init();
  sandbox.UI.init();
  return sandbox;
}

const STEP = 1 / 60;
const BUFFER = 4, MAX_AHEAD = 2;   // 必须与 net.js 保持一致

function makePeer(dev, slot, seed) {
  const game = new dev.Game();
  game.setMode(dev.CFG.MODE_COOP);
  const src = dev.NetInput.create(dev.PROTOCOL);
  game.inputSource = src;
  game.startNewGame(seed);

  const ls = new dev.LOCKSTEP.LockStep({
    players: 2, localSlot: slot, bufferFrames: BUFFER, timeoutMs: 400, maxCatchUp: 10
  });
  return { dev, slot, game, src, ls, hashes: new Map(), frames: 0, peerAck: -1 };
}

/**
 * 场景主循环，与 net.js 的 _tickOnce 一一对应：
 *   采样（缓冲未满才采）→ 从对端 ack 起批量补发 → 投递 → 推进 → 逐帧比对
 */
function runScenario(opts) {
  opts = opts || {};
  const ticks = opts.ticks || 900;
  const latency = opts.latency === undefined ? 2 : opts.latency;   // 单程帧数
  const jitter = opts.jitter || 0;
  const freezeAt = opts.freezeAt === undefined ? -1 : opts.freezeAt;
  const maskFn = opts.maskFn || defaultMask;

  const rooms = new Rooms({ now: () => 0 });
  const ra = rooms.create({ closed: false, meta: {}, send() {} });
  const rb = rooms.join({ closed: false, meta: {}, send() {} }, ra.code);

  const devA = makeDevice(), devB = makeDevice();
  const peers = [makePeer(devA, ra.slot, ra.seed), makePeer(devB, rb.slot, rb.seed)];

  let rndSeed = 12345;
  const rnd = (n) => { rndSeed = (rndSeed * 1103515245 + 12345) & 0x7FFFFFFF; return rndSeed % (n + 1); };

  const inflight = [];
  let compared = 0, firstDiff = -1;

  for (let tick = 0; tick < ticks; tick++) {
    for (const p of peers) {
      const frozen = freezeAt >= 0 && p.slot === 0 && tick >= freezeAt && tick < freezeAt + 6;
      const ls = p.ls;

      if (!frozen && ls.writeFrame - ls.frame < BUFFER + MAX_AHEAD) {
        ls.pushLocal(maskFn(p.slot, tick));
      }

      const list = [];
      for (let f = Math.max(0, p.peerAck); f < ls.writeFrame && list.length < 12; f++) {
        const m = ls.localInput(f);
        if (m !== undefined) list.push([f, m]);
      }
      if (list.length) {
        inflight.push({ due: tick + latency + (jitter ? rnd(jitter) : 0), to: 1 - p.slot, frames: list, a: ls.lastDone() });
      }
    }

    for (let i = inflight.length - 1; i >= 0; i--) {
      if (inflight[i].due <= tick) {
        const m = inflight.splice(i, 1)[0];
        const to = peers[m.to];
        if (m.a + 1 > to.peerAck) to.peerAck = m.a + 1;
        for (const [f, mask] of m.frames) to.ls.onRemoteInput(f, 1 - m.to, mask);
      }
    }

    // 与 net.js 一致：只追到「这个时刻本该执行到的帧」，不做无限 catch-up
    for (const p of peers) {
      let guard = 0;
      while (guard++ < 8 && p.ls.frame < tick) {
        const n = p.ls.advance((frame, masks) => {
          p.src.setMasks(masks);
          p.game.update(STEP);
          p.hashes.set(frame, p.dev.StateHash.of(p.game));
          p.frames++;
          if (opts.postFrame) opts.postFrame(p, frame);
        }, 1);
        if (!n) break;
      }
    }

    const [a, b] = peers;
    const f = Math.min(a.ls.frame, b.ls.frame) - 1;
    if (f >= 0 && a.hashes.has(f) && b.hashes.has(f)) {
      compared++;
      if (firstDiff < 0 && a.hashes.get(f) !== b.hashes.get(f)) firstDiff = f;
    }
  }

  return {
    code: ra.code, seed: ra.seed, slots: [ra.slot, rb.slot],
    frames: [peers[0].ls.frame, peers[1].ls.frame],
    compared, firstDiff, peers, devA, devB
  };
}

/** 每 20 tick 换方向、每 17 tick 开一枪；两端相位错开 */
function defaultMask(slot, tick) {
  const dirs = [0x1, 0x4, 0x2, 0x8];   // UP LEFT DOWN RIGHT（与 protocol 一致）
  let m = dirs[(Math.floor(tick / 20) + (slot === 1 ? 2 : 0)) % 4];
  if (tick % 17 === 5) m |= 0x10;      // FIRE
  return m;
}

/* ================= 1. 理想网络 ================= */
section('1. 理想网络（0 延迟）');
const R1 = runScenario({ ticks: 900, latency: 0, jitter: 0 });
check('两端拿到同一个 seed', R1.seed > 0, R1.seed);
check('槽位分别是 0 / 1', R1.slots[0] === 0 && R1.slots[1] === 1, R1.slots);
check('房号是 4 位合法码', /^[2-9A-Z]{4}$/.test(R1.code), R1.code);
check('两端推进帧数一致', R1.frames[0] === R1.frames[1], R1.frames);
check('推进节奏正常（≈60 帧/秒，不暴走）', Math.min(...R1.frames) > 850 && Math.max(...R1.frames) < 1080, R1.frames);
check('逐帧哈希完全一致', R1.firstDiff < 0, { firstDiff: R1.firstDiff, compared: R1.compared });

/* ================= 2. 真实网络 ================= */
section('2. 真实网络（单程 33ms + 抖动 2 帧）');
const R2 = runScenario({ ticks: 900, latency: 2, jitter: 2 });
check('逐帧哈希完全一致', R2.firstDiff < 0, { firstDiff: R2.firstDiff, compared: R2.compared });
check('掉帧可接受（推进 > 700 帧）', Math.min(...R2.frames) > 700, R2.frames);
check('两端帧号差 ≤ 3', Math.abs(R2.frames[0] - R2.frames[1]) <= 3, R2.frames);

/* ================= 3. 高延迟 ================= */
section('3. 高延迟（单程 100ms）');
const R3 = runScenario({ ticks: 900, latency: 6, jitter: 3 });
check('高延迟下仍然完全一致', R3.firstDiff < 0, { firstDiff: R3.firstDiff, compared: R3.compared });
check('只是变慢，没有停下（推进 > 400 帧）', Math.min(...R3.frames) > 400, R3.frames);

/* ================= 4. 一端卡顿 ================= */
section('4. 一端短时卡顿（连续 6 tick 不采样）');
const R4 = runScenario({ ticks: 600, latency: 2, jitter: 1, freezeAt: 300 });
check('卡顿后没死锁（两边都还在推进）', Math.min(...R4.frames) > 400, R4.frames);
check('卡顿过程中也没分叉', R4.firstDiff < 0, { firstDiff: R4.firstDiff });

/* ================= 5. 输入归属 ================= */
section('5. 输入归属（P1 一直按左，P2 一直按右）');
const R5 = runScenario({
  ticks: 260, latency: 0, jitter: 0,
  maskFn: (slot) => (slot === 0 ? 0x4 : 0x8)     // LEFT / RIGHT
});
const ga = R5.peers[0].game, gb = R5.peers[1].game;
check('P1 的坦克朝向 LEFT', ga.players[0] && ga.players[0].dir === 'LEFT', ga.players[0] && ga.players[0].dir);
check('P2 的坦克朝向 RIGHT', gb.players[1] && gb.players[1].dir === 'RIGHT', gb.players[1] && gb.players[1].dir);
check('两端对 P1 朝向的认知一致', ga.players[0] && gb.players[0] && ga.players[0].dir === gb.players[0].dir);
check('两辆坦克位置不同（各走各的）',
  ga.players[0] && ga.players[1] && Math.abs(ga.players[0].x - ga.players[1].x) > 8,
  ga.players[0] && ga.players[1] && [ga.players[0].x, ga.players[1].x]);

/* ================= 6. 反例 ================= */
section('6. 反例：一端偷偷多消耗一次随机数');
{
  const R6 = runScenario({ ticks: 60, latency: 0, jitter: 0 });
  const p0 = R6.peers[0], p1 = R6.peers[1];
  // 从此刻起，1 号端每帧多取一次随机数（真实场景就是漏改一处 Math.random）
  const orig = p1.dev.RNG.rand;
  p1.dev.RNG.rand = function () { const v = orig.call(p1.dev.RNG); return v; };
  let diffFound = -1;
  for (let i = 0; i < 200; i++) {
    if (p0.ls.writeFrame - p0.ls.frame < 6) {
      const w0 = p0.ls.pushLocal(0x1);
      p1.ls.onRemoteInput(w0.frame, 0, w0.mask);
      const w1 = p1.ls.pushLocal(0x2);
      p0.ls.onRemoteInput(w1.frame, 1, w1.mask);
    }
    p0.ls.advance((f, m) => { p0.src.setMasks(m); p0.game.update(STEP); }, 1);
    p1.ls.advance((f, m) => {
      p1.src.setMasks(m); p1.game.update(STEP);
      p1.dev.RNG.rand();               // ← 只有这一端多取
    }, 1);
    const f = Math.min(p0.ls.frame, p1.ls.frame) - 1;
    if (f >= 0 && diffFound < 0 && p0.dev.StateHash.of(p0.game) !== p1.dev.StateHash.of(p1.game)) diffFound = f;
  }
  p1.dev.RNG.rand = orig;
  check('一端多消耗随机数 → 哈希一定检出分歧', diffFound >= 0, { diffFound });
}

/* ================= 汇总 ================= */
console.log('\n' + '='.repeat(54));
console.log(failed === 0 ? '全部通过' : '失败 ' + failed + ' 项');
console.log('推进帧数  理想 ' + R1.frames.join('/') +
  ' ｜ 真实网络 ' + R2.frames.join('/') +
  ' ｜ 高延迟 ' + R3.frames.join('/') +
  ' ｜ 卡顿 ' + R4.frames.join('/'));
process.exit(failed === 0 ? 0 : 1);
