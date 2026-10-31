/**
 * sim-lockstep.js - 帧同步一致性模拟器（P0 验收工具）
 *
 * 做什么：
 *   在 Node 里模拟两台手机 —— 各自的输入采样、各自的逻辑帧推进、中间一条
 *   有延迟 / 抖动 / 丢包 / 乱序的网络，跑 900 帧（15 秒），逐帧比对两端状态哈希。
 *
 * 验收标准：
 *   正常模式下两端**逐帧哈希完全一致**（0 分歧），证明确定性内核成立。
 *
 * 反例模式（--broken）：
 *   故意把随机源换回 Math.random（模拟"漏改一处随机"），应当能检测到分歧，
 *   用来证明校验机制真的有效，而不是永远绿灯。
 *
 * 用法：
 *   node tools/sim-lockstep.js             # 正常：必须 0 分歧
 *   node tools/sim-lockstep.js --broken    # 反例：必须检测到分歧
 *   node tools/sim-lockstep.js --loss 30   # 改丢包率（%）压测
 */
'use strict';

const path = require('path');
const SHARED = path.join(__dirname, '..', 'shared');
require(path.join(SHARED, 'prng.js'));
require(path.join(SHARED, 'protocol.js'));
require(path.join(SHARED, 'hash.js'));
require(path.join(SHARED, 'lockstep.js'));

const PRNG = globalThis.PRNG;
const PROTOCOL = globalThis.PROTOCOL;
const HASH = globalThis.HASH;
const LOCKSTEP = globalThis.LOCKSTEP;

const args = process.argv.slice(2);
const BROKEN = args.includes('--broken');
const LOSS_ARG = args.indexOf('--loss');
const LOSS = LOSS_ARG >= 0 ? Number(args[LOSS_ARG + 1]) / 100 : 0.08;

/* ============ 1. 一个极简的"坦克战场"，只保留会影响确定性的要素 ============ */

const UNIT = 16;              // 定点：1px = 16 单位
const FIELD = 512;            // 场地宽（px）
const SPEED = 2 * UNIT;       // 每逻辑帧 2px

function createState(seed) {
  return {
    rng: new PRNG.Rng(seed),
    broken: BROKEN,
    frame: 0,
    tanks: [
      { slot: 0, x: 96 * UNIT, y: 420 * UNIT, dir: 0, hp: 3, cd: 0, shots: 0 },
      { slot: 1, x: 384 * UNIT, y: 420 * UNIT, dir: 0, hp: 3, cd: 0, shots: 0 }
    ],
    bullets: [],
    enemyCd: 40,
    enemyShots: 0
  };
}

function fireBullet(state, slot, t) {
  state.bullets.push({ owner: slot, x: t.x, y: t.y, dir: t.dir });
  t.shots++;
}

function step(state, masks) {
  state.frame++;

  // --- 坦克移动：整数运算，无浮点 ---
  for (let s = 0; s < state.tanks.length; s++) {
    const t = state.tanks[s], m = masks[s];
    if (m & PROTOCOL.MASK.UP) { t.dir = 0; t.y -= SPEED; }
    else if (m & PROTOCOL.MASK.DOWN) { t.dir = 2; t.y += SPEED; }
    else if (m & PROTOCOL.MASK.LEFT) { t.dir = 3; t.x -= SPEED; }
    else if (m & PROTOCOL.MASK.RIGHT) { t.dir = 1; t.x += SPEED; }

    const maxX = (FIELD - 32) * UNIT, maxY = (FIELD - 32) * UNIT;
    if (t.x < 0) t.x = 0; else if (t.x > maxX) t.x = maxX;
    if (t.y < 0) t.y = 0; else if (t.y > maxY) t.y = maxY;

    if (t.cd > 0) t.cd--;
    if ((m & PROTOCOL.MASK.FIRE) && t.cd === 0) {
      fireBullet(state, s, t);
      t.cd = 18;
    }
  }

  // --- 子弹推进 ---
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.dir === 0) b.y -= 6 * UNIT;
    else if (b.dir === 2) b.y += 6 * UNIT;
    else if (b.dir === 3) b.x -= 6 * UNIT;
    else b.x += 6 * UNIT;
    if (b.x < -16 * UNIT || b.x > (FIELD + 16) * UNIT ||
        b.y < -16 * UNIT || b.y > (FIELD + 16) * UNIT) {
      state.bullets.splice(i, 1);
    }
  }

  // --- 敌人 AI 的随机行为（对应现有 game.js 里那些 Math.random） ---
  state.enemyCd--;
  if (state.enemyCd <= 0) {
    // 反例模式下故意退回 Math.random，模拟"漏改一处随机"
    const r1 = state.broken ? Math.random() : state.rng.rand();
    const r2 = state.broken ? Math.random() : state.rng.rand();
    const ex = Math.floor(r1 * 13) * 32 + 16;
    state.bullets.push({ owner: 9, x: ex * UNIT, y: 20 * UNIT, dir: 2 });
    state.enemyShots++;
    state.enemyCd = 45 + Math.floor(r2 * 45);
  }
}

/** 状态哈希：字段顺序固定，全部整数入哈希 */
function hashState(state) {
  const h = new HASH.Hash();
  h.int(state.frame);
  h.int(state.tanks.length);
  for (let i = 0; i < state.tanks.length; i++) {
    const t = state.tanks[i];
    h.int(t.slot); h.int(t.x); h.int(t.y); h.int(t.dir);
    h.int(t.hp); h.int(t.cd); h.int(t.shots);
  }
  h.int(state.bullets.length);
  for (let i = 0; i < state.bullets.length; i++) {
    const b = state.bullets[i];
    h.int(b.owner); h.int(b.x); h.int(b.y); h.int(b.dir);
  }
  h.int(state.enemyCd);
  h.int(state.enemyShots);
  return h.value();
}

/* ============ 2. 网络模拟：延迟 + 抖动 + 丢包 + 乱序 ============ */

function createNet(latency, jitter, loss, seed) {
  const rng = new PRNG.Rng(seed);   // 网络自己的随机源，不影响游戏状态
  const queue = [];
  const handlers = {};
  const stats = { sent: 0, dropped: 0, delivered: 0, duplicate: 0 };

  return {
    stats,
    onReceive(to, fn) { handlers[to] = fn; },
    send(from, to, payload, now) {
      stats.sent++;
      if (rng.rand() < loss) { stats.dropped++; return; }
      const delay = Math.max(8, latency + rng.range(-jitter, jitter));
      queue.push({ at: now + delay, to, payload });
    },
    pump(now) {
      // 按到达时间排序 → 天然产生乱序（不同包延迟不同）
      queue.sort((a, b) => a.at - b.at);
      while (queue.length && queue[0].at <= now) {
        const m = queue.shift();
        stats.delivered++;
        handlers[m.to](m.payload);
      }
    },
    pending() { return queue.length; }
  };
}

/* ============ 3. 玩家端：输入脚本 + 帧同步内核 + 状态 ============ */

function createPeer(slot, seed, opts) {
  return {
    slot,
    state: createState(seed),
    ls: new LOCKSTEP.LockStep(opts),
    inputRng: new PRNG.Rng((seed ^ (slot * 7919)) >>> 0),  // 输入脚本用独立随机源
    held: 0,
    nextChange: 0,
    hashAt: new Map(),
    ticksAdvanced: 0,
    oppAck: -1        // 对方已执行到第几帧（从对方的 ack 学到），决定重传起点
  };
}

const DIRS = [
  PROTOCOL.MASK.UP, PROTOCOL.MASK.DOWN,
  PROTOCOL.MASK.LEFT, PROTOCOL.MASK.RIGHT
];

/** 确定性输入脚本：每隔 8~28 帧换方向，35% 概率同时开火 */
function sampleMask(peer, tick) {
  if (tick >= peer.nextChange) {
    peer.held = peer.inputRng.pick(DIRS) | (peer.inputRng.chance(0.35) ? PROTOCOL.MASK.FIRE : 0);
    peer.nextChange = tick + peer.inputRng.int(8, 28);
  }
  return peer.held;
}

/* ============ 4. 跑起来 ============ */

function run() {
  const SEED = 20261031;
  const START_FRAME = 0;
  const BUFFER = 4;            // 输入提前量 4 帧 ≈ 67ms
  const TOTAL_TICKS = 900;     // 15 秒
  const STEP_MS = 1000 / 60;

  const net = createNet(30, 18, LOSS, 777);
  const peers = [
    createPeer(0, SEED, { localSlot: 0, players: 2, startFrame: START_FRAME, bufferFrames: BUFFER, timeoutMs: 200 }),
    createPeer(1, SEED, { localSlot: 1, players: 2, startFrame: START_FRAME, bufferFrames: BUFFER, timeoutMs: 200 })
  ];

  // 网络送达 → 学对方的进度（用于裁剪重传）+ 喂给本地帧同步内核
  function receiver(peer) {
    return (pkg) => {
      if (pkg.ack > peer.oppAck) peer.oppAck = pkg.ack;
      for (let i = 0; i < pkg.frames.length; i++) {
        peer.ls.onRemoteInput(pkg.frames[i].f, pkg.slot, pkg.frames[i].m);
      }
    };
  }
  net.onReceive(0, receiver(peers[0]));
  net.onReceive(1, receiver(peers[1]));

  let now = 0;
  let maxStall = 0;
  let stalledTicks = 0;   // 因等对方输入而暂停的 tick 数（两个玩家合计）

  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    now = tick * STEP_MS;

    // ① 下一帧收齐输入 → 采样本地输入 + 推进 1 帧。
    //    逻辑帧与输入采样严格 1:1：卡住时不采样，恢复后逐帧补上，
    //    这样输入缓冲不会被卡顿撑大（否则越玩越延迟）。
    for (const p of peers) {
      if (p.ls.ready(p.ls.frame)) {
        p.ls.pushLocal(sampleMask(p, tick));
        p.ls.advance((frame, masks) => {
          step(p.state, masks);
          p.hashAt.set(frame, hashState(p.state));
          p.ticksAdvanced++;
        }, 1);
      } else {
        // 没就绪才需要算等待时长
        p.ls.checkStall(now);
        if (p.ls.maxStallMs > maxStall) maxStall = p.ls.maxStallMs;
        stalledTicks++;
      }
    }

    // ② 批量重传：从「对方已执行的下一帧」补到本地最新，最多 12 帧。
    //    比"只重发最近 3 帧"可靠 —— 任意一帧丢了都能在后续包里补上，
    //    否则只要有一帧永久丢失，两端就永久停在那一帧。
    for (const p of peers) {
      const from = Math.max(0, p.oppAck + 1);
      const frames = [];
      for (let f = from; f < p.ls.writeFrame && frames.length < 12; f++) {
        const m = p.ls.localInput(f);
        if (m !== undefined) frames.push({ f, m });
      }
      if (frames.length) {
        net.send(p.slot, 1 - p.slot, {
          slot: p.slot,
          ack: p.ls.lastDone(),
          frames
        }, now);
      }
    }

    // ③ 投递网络消息
    net.pump(now);
  }

  /* ---------- 5. 结算 ---------- */
  const A = peers[0], B = peers[1];
  const commonMax = Math.min(A.ticksAdvanced, B.ticksAdvanced);
  let firstDiff = -1, compared = 0;

  for (let f = 0; f < commonMax; f++) {
    const ha = A.hashAt.get(f), hb = B.hashAt.get(f);
    if (ha === undefined || hb === undefined) continue;
    compared++;
    if (ha !== hb) { firstDiff = f; break; }
  }

  const line = (k, v) => console.log('  ' + k.padEnd(22, ' ') + v);

  console.log('\n=== 帧同步模拟（' + (BROKEN ? '反例模式：随机源被换回 Math.random' : '正常模式') + '）===');
  line('网络条件', '单向延迟 30±18ms / 丢包 ' + Math.round(LOSS * 100) + '% / 乱序');
  line('输入提前量', BUFFER + ' 帧（' + Math.round(BUFFER * STEP_MS) + 'ms）');
  line('模拟时长', TOTAL_TICKS + ' 帧（' + Math.round(TOTAL_TICKS * STEP_MS / 1000) + ' 秒）');
  console.log('');
  line('玩家A 执行帧数', A.ticksAdvanced);
  line('玩家B 执行帧数', B.ticksAdvanced);
  line('逐帧比对', compared + ' 帧');
  line('网络发包/丢弃', net.stats.sent + ' / ' + net.stats.dropped);
  line('等待对方帧数', stalledTicks + ' / ' + (TOTAL_TICKS * 2) +
    '（' + (stalledTicks / (TOTAL_TICKS * 2) * 100).toFixed(1) + '%）');
  line('最长卡帧等待', Math.round(maxStall) + 'ms');
  console.log('');

  if (BROKEN) {
    const detected = firstDiff >= 0;
    console.log(detected
      ? '  ✓ 第 ' + firstDiff + ' 帧检测到状态分歧（desync 校验有效）'
      : '  ✗ 反例模式下竟然没检测到分歧，说明哈希校验漏了字段！');
    console.log('\n  这就是为什么要「逻辑层禁止 Math.random」——漏一处，' +
      (firstDiff >= 0 ? Math.round(firstDiff / 60 * 10) / 10 + ' 秒后两端就各玩各的' : '后果不可见') + '。\n');
    process.exit(detected ? 0 : 1);
  }

  // 唯一的硬指标是「一致性」：两端逐帧哈希不许有任何分歧。
  // 推进帧数受丢包影响会自然落后，属于性能表现，只提示不判失败。
  const consistent = firstDiff < 0 && compared > 0;
  const lagRatio = compared / TOTAL_TICKS;

  if (consistent) {
    console.log('  ✓ 两端逐帧哈希完全一致（' + compared + ' 帧，0 分歧）——确定性内核成立');
    if (lagRatio < 0.9) {
      console.log('  ⚠ 推进落后 ' + ((1 - lagRatio) * 100).toFixed(1) +
        '%（丢包 ' + Math.round(LOSS * 100) + '% 下的正常表现，不是逻辑错误）');
    }
  } else {
    console.log('  ✗ ' + (firstDiff >= 0
      ? '第 ' + firstDiff + ' 帧发生分歧，确定性被破坏'
      : '两端没有任何可比对的帧，推进完全卡死'));
  }
  console.log('');
  process.exit(consistent ? 0 : 1);
}

run();
