/**
 * test-rooms.js - 房间逻辑单测（假时钟，毫秒级跑完，不需要起服务）
 *
 * 为什么要单独测：重连的正确性几乎全在「时间边界」上——
 * 保留期内要能回来、过了保留期要真的清掉、主动退出不能被旧票据复活。
 * 这些用真服务测要等 60 秒，用假时钟 0 毫秒。
 *
 * 跑法：node tools/test-rooms.js
 */
'use strict';

const path = require('path');
const { Rooms, GRACE_MS } = require(path.join(__dirname, '..', 'server', 'rooms.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }

function fakeConn() {
  return {
    closed: false,
    meta: {},
    msg: [],
    send(m) { this.msg.push(m); },
    got(t) { return this.msg.filter((m) => m.t === t); }
  };
}

let clock = 1000000;
// 假随机：线性同余，既确定性又能产生不同序列（纯常量会让两个票据撞成一个）
let seed = 12345;
const pseudoRandInt = (a, b) => {
  seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
  return a + (seed % (b - a + 1));
};
const rooms = new Rooms({ now: () => clock, randInt: pseudoRandInt });

section('【1】建房与票据');
const A = fakeConn();
const ra = rooms.create(A);
ok('建房拿到 4 位房号', /^[2-9A-HJ-NP-Z]{4}$/.test(ra.code), ra.code);
ok('建房同时下发重连票据', typeof ra.token === 'string' && ra.token.length >= 12, ra.token);
ok('票据存在房间里', rooms.get(ra.code).tokens[0] === ra.token);

const B = fakeConn();
const rb = rooms.join(B, ra.code);
ok('第二人坐 1 号位，各拿各的票据', rb.slot === 1 && rb.token !== ra.token);
ok('两人到齐可开局', rooms.maybeStart(ra.code) === true);
ok('重复调用不会重复开局', rooms.maybeStart(ra.code) === false);

section('【2】掉线：保座而不是清座');
clock += 5000;
const det = rooms.detach(B);
ok('掉线返回需要安排超时清理的房号/槽位', det && det.code === ra.code && det.slot === 1, det);
ok('座位空了（连接已摘掉）', rooms.get(ra.code).slots[1] === null);
ok('票据仍然保留（这才是能回来的凭证）', rooms.get(ra.code).tokens[1] === rb.token);
ok('队友收到 peer-offline 而不是 peerleft',
  A.got('peer-offline').length === 1 && A.got('peerleft').length === 0, A.msg);
ok('peer-offline 带上保留期时长', A.got('peer-offline')[0].grace === GRACE_MS);

section('【3】保留期内不能被别人顶座');
const C = fakeConn();
const rc = rooms.join(C, ra.code);
ok('新人拿房号进不来（ROOM_FULL）', rc.error === 'ROOM_FULL', rc);

section('【4】保留期内房间不被清扫');
clock += GRACE_MS - 1000;
rooms._sweep();
ok('还差 1 秒到期，房间仍在', !!rooms.get(ra.code));

section('【5】拿票据回原座位');
const B2 = fakeConn();
const rj = rooms.rejoin(B2, ra.code, 1, rb.token);
ok('重连成功回到 1 号位', rj.slot === 1 && rj.seed === ra.seed, rj);
ok('重连不带 resumed 标志以外的副作用（不重发 go）', A.got('peer-online').length === 1);
ok('重连计数 +1', rooms.stats.rejoined === 1);

const wrong = rooms.rejoin(fakeConn(), ra.code, 0, 'NOPE');
ok('票据不对拒绝（BAD_TOKEN）', wrong.error === 'BAD_TOKEN', wrong);
const taken = rooms.rejoin(fakeConn(), ra.code, 1, rb.token);
ok('座位已被自己占着再重连被拒（SLOT_TAKEN）', taken.error === 'SLOT_TAKEN', taken);

section('【6】再次掉线 → 超时清除');
const det2 = rooms.detach(B2);
ok('第二次掉线同样进入保留期', det2 && det2.slot === 1, det2);
clock += GRACE_MS + 1;
const expired = rooms.expire(ra.code, 1);
ok('到期清理生效', expired === ra.code, expired);
ok('此时才通知对手 peerleft', A.got('peerleft').length === 1, A.msg);
ok('票据已作废', rooms.get(ra.code).tokens[1] === null);

section('【7】过期票据再也回不来');
const late = rooms.rejoin(fakeConn(), ra.code, 1, rb.token);
ok('过期票据被拒', late.error === 'BAD_TOKEN' || late.error === 'ROOM_GONE', late);

section('【8】主动退出不给保留期');
const D = fakeConn();
const rd = rooms.join(D, ra.code);
ok('空位可被新人补上', rd.slot === 1 && rd.seed === ra.seed, rd);
rooms.leave(D);
ok('主动退出后票据立刻作废', rooms.get(ra.code).tokens[1] === null);
const back = rooms.rejoin(fakeConn(), ra.code, 1, rd.token);
ok('旧票据不能复活座位', back.error === 'BAD_TOKEN', back);

section('【9】两人都走 → 房间回收');
rooms.leave(A);
ok('房间被回收', rooms.get(ra.code) === null);
ok('无泄漏：房间表为空', rooms.rooms.size === 0, rooms.rooms.size);

console.log('\n' + '='.repeat(46));
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '失败 ' + fail + ' 项 / 通过 ' + pass + ' 项');
process.exit(fail === 0 ? 0 : 1);
