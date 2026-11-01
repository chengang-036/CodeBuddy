/**
 * test-net.js - 联机服务端端到端测试（真起进程、真开 socket，不用 mock）
 *
 * 覆盖：
 *   1. 静态站点可访问（顺带证明部署时 client 目录位置对）
 *   2. WebSocket 握手（Sec-WebSocket-Accept 校验）
 *   3. 建房 / 房号格式 / seed 下发
 *   4. 加入房间拿到对侧槽位与同一 seed
 *   5. 两人到齐自动 go
 *   6. 输入双向转发（槽位标记正确）
 *   7. 哈希一致不报警；哈希不一致双方都收到 desync
 *   8. 掉线通知对手
 *   9. 房号不存在 / 房间满 的错误码
 *
 * 跑法：node tools/test-net.js
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { connect } = require('./wsclient');

const PORT = 8931;
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ port: PORT, host: '127.0.0.1', path: pathname }, (res) => {
      let b = '';
      res.on('data', (d) => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}

function waitServer(tries) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http.get({ port: PORT, host: '127.0.0.1', path: '/healthz' }, (res) => {
        res.resume(); resolve();
      }).on('error', () => {
        if (++n > tries) reject(new Error('server did not start'));
        else setTimeout(tick, 120);
      });
    };
    tick();
  });
}

(async () => {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', (d) => serverLog += d);
  child.stderr.on('data', (d) => serverLog += d);

  try {
    await waitServer(60);

    section('【1】静态托管');
    const idx = await getJson('/index.html');
    ok('GET /index.html 返回 200', idx.status === 200, idx.status);
    ok('页面里能找到双摇杆控件', /stick-zone-1/.test(idx.body));
    const health = await getJson('/healthz');
    ok('GET /healthz 返回 ok', /"ok":true/.test(health.body), health.body);

    section('【2】握手与建房');
    const a = await connect(PORT, '/ws');
    ok('A 握手成功并收到 hello', (await a.next((m) => m.t === 'hello')).t === 'hello');

    a.send({ t: 'create' });
    const roomA = await a.next((m) => m.t === 'room');
    ok('A 拿到 4 位房号', /^[2-9A-HJ-NP-Z]{4}$/.test(roomA.code), roomA.code);
    ok('A 是 0 号位', roomA.slot === 0, roomA.slot);
    ok('下发了 seed', typeof roomA.seed === 'number' && roomA.seed > 0, roomA.seed);

    section('【3】加入房间');
    const bad = await connect(PORT, '/ws');
    bad.send({ t: 'join', code: 'ZZZZ' });
    const errMsg = await bad.next((m) => m.t === 'err');
    ok('房号不存在返回 ROOM_NOT_FOUND', errMsg.code === 'ROOM_NOT_FOUND', errMsg.code);
    bad.close();

    const b = await connect(PORT, '/ws');
    b.send({ t: 'join', code: roomA.code });
    const roomB = await b.next((m) => m.t === 'room');
    ok('B 进房成功，坐 1 号位', roomB.slot === 1, roomB.slot);
    ok('两端 seed 完全一致（同一起点）', roomB.seed === roomA.seed, [roomA.seed, roomB.seed]);

    const peerMsg = await a.next((m) => m.t === 'peer');
    ok('A 收到「对手已进房」', peerMsg.joined === true);
    const goA = await a.next((m) => m.t === 'go');
    const goB = await b.next((m) => m.t === 'go');
    ok('两人到齐自动开局（两端都收到 go）', goA.code === roomA.code && goB.code === roomA.code);

    section('【4】输入双向转发');
    a.send({ t: 'in', a: -1, f: [[0, 8], [1, 9]] });
    const inB = await b.next((m) => m.t === 'in');
    ok('B 收到 A 的输入包，槽位标记为 0', inB.s === 0, inB.s);
    ok('输入内容原样转发（帧号+掩码）',
      JSON.stringify(inB.f) === JSON.stringify([[0, 8], [1, 9]]), inB.f);

    b.send({ t: 'in', a: 22, f: [[23, 4]] });
    const inA = await a.next((m) => m.t === 'in');
    ok('A 收到 B 的输入包，槽位标记为 1', inA.s === 1, inA.s);
    ok('ack 字段透传（对方已执行到 22 帧）', inA.a === 22, inA.a);

    section('【5】哈希比对与 desync 检测');
    a.send({ t: 'hash', f: 60, h: 'deadbeef' });
    const hashOnB = await b.next((m) => m.t === 'hash');
    ok('哈希转发给对手', hashOnB.h === 'deadbeef' && hashOnB.s === 0, hashOnB);

    b.send({ t: 'hash', f: 60, h: 'deadbeef' });
    let noDesync = true;
    try { await a.next((m) => m.t === 'desync', 500); noDesync = false; } catch (e) { noDesync = true; }
    ok('哈希一致时不误报', noDesync);

    a.send({ t: 'hash', f: 61, h: '00000001' });
    b.send({ t: 'hash', f: 61, h: '00000002' });
    const dA = await a.next((m) => m.t === 'desync');
    const dB = await b.next((m) => m.t === 'desync');
    ok('哈希不一致时双方都收到 desync', dA.f === 61 && dB.f === 61, [dA, dB]);

    section('【6】掉线保座（不再立刻判死）');
    b.close();
    const off = await a.next((m) => m.t === 'peer-offline');
    ok('对手掉线先发 peer-offline（留 60 秒重连窗口）', off.t === 'peer-offline' && off.grace > 0, off);

    // 座位被票据占着：新人拿房号进来不该能顶掉掉线那位的座位
    const c = await connect(PORT, '/ws');
    c.send({ t: 'join', code: roomA.code });
    const cMsg = await c.next((m) => m.t === 'err' || m.t === 'room');
    ok('掉线期间座位保留，新人进不来（ROOM_FULL）', cMsg.t === 'err' && cMsg.code === 'ROOM_FULL', cMsg);
    c.close();

    section('【7】票据重连回原座位');
    const b2 = await connect(PORT, '/ws');
    b2.send({ t: 'rejoin', code: roomA.code, slot: 1, token: roomB.token });
    const resumed = await b2.next((m) => m.t === 'resumed' || m.t === 'err');
    ok('拿票据重连成功，回到 1 号位', resumed.t === 'resumed' && resumed.slot === 1, resumed);
    ok('重连后 seed 不变（同一局）', resumed.seed === roomA.seed, [resumed.seed, roomA.seed]);
    const back = await a.next((m) => m.t === 'peer-online');
    ok('队友收到「他回来了」', back.t === 'peer-online');

    // 票据错了不能顶座（防别人拿房号冒充）
    const badTok = await connect(PORT, '/ws');
    badTok.send({ t: 'rejoin', code: roomA.code, slot: 0, token: 'WRONGTOKEN' });
    const badMsg = await badTok.next((m) => m.t === 'err');
    ok('票据不对拒绝重连（BAD_TOKEN）', badMsg.code === 'BAD_TOKEN', badMsg.code);
    badTok.close();

    b2.send({ t: 'in', a: 40, f: [[41, 2]] });
    const afterBack = await a.next((m) => m.t === 'in');
    ok('重连后输入继续转发，槽位仍是 1', afterBack.s === 1 && afterBack.f[0][0] === 41, afterBack);

    section('【8】主动退出与房间回收');
    b2.send({ t: 'leave' });
    const left = await a.next((m) => m.t === 'peerleft');
    ok('主动退出才立刻通知对手', left.t === 'peerleft');

    a.close();
    await new Promise((r) => setTimeout(r, 200));
    const health2 = await getJson('/healthz');
    ok('两人都离开后房间被回收', /"rooms":0/.test(health2.body), health2.body);

  } catch (e) {
    fail++;
    console.log('\n  ✗ 测试异常中断: ' + e.message);
    if (serverLog) console.log('--- 服务端输出 ---\n' + serverLog);
  } finally {
    child.kill('SIGTERM');
  }

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0
    ? '全部通过：' + pass + ' 项'
    : '失败 ' + fail + ' 项 / 通过 ' + pass + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})();
