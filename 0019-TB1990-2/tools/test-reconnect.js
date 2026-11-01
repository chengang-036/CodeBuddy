/**
 * test-reconnect.js - 掉线重连集成测试（真 WebSocket、真服务端、真客户端代码）
 *
 * 要证明的就三件事：
 *   1. 一方断网，另一方**整局停住**（帧号原地不动，不是继续跑）
 *   2. 断网方自动重连，凭票据回到原座位，两边从同一个帧号接着打
 *   3. 恢复后**不会快进**：暂停 2 秒不会变成一次追 120 帧的雪崩
 *
 * 为什么不能用假 socket 测：断线→重连这条路上真正容易错的是节奏锚（startedAt）
 * 和补帧窗口，这两处只有在真实时间流逝 + 真实消息往返下才暴露。
 *
 * 跑法：node tools/test-reconnect.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 8932;
const ROOT = path.join(__dirname, '..');
const CLIENT_JS = path.join(ROOT, 'client', 'js');

const FILES = ['prng.js', 'hash.js', 'protocol.js', 'lockstep.js', 'rng.js', 'config.js',
  'sprites.js', 'input.js', 'level.js', 'entities.js', 'game.js', 'ui.js',
  'netinput.js', 'statehash.js', 'net.js'];
const SOURCES = FILES.map((f) => ({ name: f, code: fs.readFileSync(path.join(CLIENT_JS, f), 'utf8') }));

const STEP = 1 / 60;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** 造一台独立设备：独立全局 + 独立 RNG（两台手机本来就是两个 JS 环境） */
function makeDevice(slot, mask) {
  const sandbox = { console, __isTouch: false, setTimeout, clearTimeout, setInterval, clearInterval };
  sandbox.globalThis = sandbox;
  sandbox.performance = { now: () => Date.now() };
  sandbox.WebSocket = globalThis.WebSocket;   // 真 socket，不是 mock
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

  const dev = sandbox;
  const game = new dev.Game();
  game.setMode(dev.CFG.MODE_COOP);
  const netSrc = dev.NetInput.create(dev.PROTOCOL);
  game.inputSource = netSrc;

  const state = { status: 'idle', started: 0, desync: -1, frames: 0, hashes: Object.create(null) };

  dev.NetPlay.init({
    url: 'ws://127.0.0.1:' + PORT + '/ws',
    sampleMask: () => mask,
    hash: () => dev.StateHash.of(game),
    step: function (frame, masks) {
      netSrc.setMasks(masks);
      game.update(STEP);
      state.frames++;
      // 逐帧存快照，等跑完再和另一台逐帧比：相邻两帧本来就应该不同，
      // 只有「同一帧上两端不同」才是真的不同步。
      state.hashes[frame] = dev.StateHash.of(game);
    },
    onStart: function (info) {
      game.startNewGame(info.seed);
      state.started++;
    },
    onStatus: function (s) { state.status = s; },
    onDesync: function (f) { state.desync = f; }
  });

  return { dev, game, state, net: dev.NetPlay };
}

function tickBoth(a, b) {
  const now = Date.now();
  a.net.tick(now);
  b.net.tick(now);
}

async function run(ms, a, b) {
  const end = Date.now() + ms;
  while (Date.now() < end) { tickBoth(a, b); await sleep(16); }
}

function waitStatus(dev, want, ms) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (dev.state.status === want) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); resolve(false); }
    }, 20);
  });
}

/** 逐帧比对两端的游戏状态快照，返回第一处不一致的帧号（-1 表示完全一致） */
function firstMismatch(a, b) {
  const ka = Object.keys(a.state.hashes);
  let compared = 0;
  for (const k of ka) {
    if (b.state.hashes[k] === undefined) continue;
    compared++;
    if (b.state.hashes[k] !== a.state.hashes[k]) return { frame: +k, compared: compared };
  }
  return { frame: -1, compared: compared };
}

function waitHealth(tries) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http.get({ port: PORT, host: '127.0.0.1', path: '/healthz' }, (res) => { res.resume(); resolve(); })
        .on('error', () => { if (++n > tries) reject(new Error('服务没起来')); else setTimeout(tick, 120); });
    };
    tick();
  });
}

(async () => {
  if (typeof globalThis.WebSocket !== 'function') {
    console.log('当前 Node 没有内置 WebSocket（需要 22+），跳过集成测试');
    process.exit(0);
  }

  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', (d) => log += d);
  child.stderr.on('data', (d) => log += d);

  const A = makeDevice(0, 8);    // A 一直按左
  const B = makeDevice(1, 4);    // B 一直按右

  try {
    await waitHealth(60);

    section('【1】建房与开局');
    A.net.createRoom();
    const okRoom = await new Promise((r) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (A.net.code()) { clearInterval(iv); r(true); }
        else if (Date.now() - t0 > 5000) { clearInterval(iv); r(false); }
      }, 20);
    });
    ok('A 建房拿到房号', okRoom && /^[2-9A-HJ-NP-Z]{4}$/.test(A.net.code()), A.net.code());

    B.net.joinRoom(A.net.code());
    const started = await Promise.all([waitStatus(A, 'playing', 5000), waitStatus(B, 'playing', 5000)]);
    ok('两端都进入对局', started[0] && started[1], [A.state.status, B.state.status]);
    ok('两端各自跑同一份开局', A.state.started === 1 && B.state.started === 1);

    await run(1200, A, B);
    const f0A = A.net.frame(), f0B = B.net.frame();
    ok('两边帧号一致地往前走', f0A > 30 && Math.abs(f0A - f0B) <= 2, [f0A, f0B]);
    const m0 = firstMismatch(A, B);
    ok('断线前两端逐帧状态一致（比了 ' + m0.compared + ' 帧）', m0.frame < 0, m0);

    section('【2】A 断网：B 必须停住');
    A.net._simulateDrop();
    await sleep(250);
    ok('A 察觉断线并进入重连态', A.state.status === 'reconnecting', A.state.status);
    const bPaused = await waitStatus(B, 'peer-offline', 2000);
    ok('B 收到「队友掉线并暂停」', bPaused, B.state.status);

    // 重连窗口只有几百毫秒，这里要卡在「还没回来」的间隙里量，否则量到的是恢复后的正常推进
    const fPauseA = A.net.frame(), fPauseB = B.net.frame();
    await sleep(250);
    ok('暂停期间 A 一帧都不走', A.net.frame() === fPauseA, [fPauseA, A.net.frame()]);
    ok('暂停期间 B 一帧都不走', B.net.frame() === fPauseB, [fPauseB, B.net.frame()]);
    ok('暂停期间没有越跑越远（两边仍对齐）', Math.abs(A.net.frame() - B.net.frame()) <= 2,
      [A.net.frame(), B.net.frame()]);

    section('【3】自动重连回原座位');
    const backA = await waitStatus(A, 'playing', 8000);
    ok('A 自动重连成功', backA, A.state.status);
    const backB = await waitStatus(B, 'playing', 3000);
    ok('B 收到「队友回来了」并恢复', backB, B.state.status);

    section('【4】恢复后不快进');
    const rStart = A.net.frame();
    ok('恢复瞬间没有「补跑」暂停期间的帧', rStart - fPauseA < 10, [fPauseA, rStart]);
    await run(600, A, B);         // 0.6 秒 ≈ 36 帧
    const gained = A.net.frame() - rStart;
    ok('恢复后按真实时间推进（0.6 秒约 36 帧）', gained > 10 && gained < 60, gained);
    ok('恢复后两端帧号仍对齐', Math.abs(A.net.frame() - B.net.frame()) <= 3,
      [A.net.frame(), B.net.frame()]);

    section('【5】全程无 desync');
    await run(800, A, B);
    ok('A 端没有检出状态分歧', A.state.desync < 0, A.state.desync);
    ok('B 端没有检出状态分歧', B.state.desync < 0, B.state.desync);
    const m1 = firstMismatch(A, B);
    ok('断线重连后逐帧状态仍完全一致（比了 ' + m1.compared + ' 帧）', m1.frame < 0, m1);
    ok('帧号继续向前（确实在打，不是卡住）', A.net.frame() > rStart + 20, [rStart, A.net.frame()]);

  } catch (e) {
    fail++;
    console.log('\n  ✗ 测试异常中断: ' + e.message);
    if (log) console.log('--- 服务端输出 ---\n' + log);
  } finally {
    child.kill('SIGTERM');
    try { A.net.leave(); B.net.leave(); } catch (e) { }
  }

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '失败 ' + fail + ' 项 / 通过 ' + pass + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})();
