/**
 * rooms.js - 房间管理（纯逻辑，不认识 socket 细节，方便单测）
 *
 * 服务器在帧同步里只做三件事：
 *   1. 建房 / 进房，把 seed 和槽位发给两端（同一 seed 是两端一致的起点）
 *   2. 转发输入包（只转发，不改内容，不跑游戏逻辑）
 *   3. 比对两端哈希，发现分歧就广播 desync
 *
 * conn 只需要两个能力：conn.send(obj)、conn.meta（挂 room/slot）。
 */

'use strict';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  // 去掉 0/O/1/I，口头报房号不会听错
const CODE_LEN = 4;
const ROOM_TTL_MS = 30 * 60 * 1000;   // 30 分钟没人就回收
const GRACE_MS = 60 * 1000;           // 掉线保留槽位的时长（够切一次 Wi-Fi / 回个微信）

function randomCode(randInt) {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[randInt(0, CODE_CHARS.length - 1)];
  return s;
}

/**
 * 重连票据。
 *
 * 为什么用票据而不是「报房号就能回座」：房号是口头报的，隔壁谁都能进；
 * 票据只在开局握手时发给本人，丢了就只能当新玩家，不能顶别人的座位。
 */
function randomToken(randInt) {
  let s = '';
  for (let i = 0; i < 20; i++) s += CODE_CHARS[randInt(0, CODE_CHARS.length - 1)];
  return s;
}

class Rooms {
  constructor(opt) {
    opt = opt || {};
    this.rooms = new Map();
    this.now = opt.now || Date.now;
    this.randInt = opt.randInt || ((a, b) => a + Math.floor(Math.random() * (b - a + 1)));
    this.stats = { created: 0, joined: 0, closed: 0, detached: 0, rejoined: 0 };
  }

  _sweep() {
    const t = this.now();
    for (const [code, room] of this.rooms) {
      // 「有人在座位」或「有人掉线还在保留期内」都算活着。
      // 只看 slots 会把刚掉线待重连的房间当场回收，重连就永远回不来了。
      const seated = room.slots.some((c) => c && !c.closed);
      const pending = room.tokens.some((tok, i) => tok && room.absentSince[i] && t - room.absentSince[i] < GRACE_MS);
      if ((!seated && !pending) || t - room.touchedAt > ROOM_TTL_MS) {
        this.rooms.delete(code);
        this.stats.closed++;
      }
    }
  }

  _newCode() {
    for (let i = 0; i < 500; i++) {
      const c = randomCode(this.randInt);
      if (!this.rooms.has(c)) return c;
    }
    // 4 位 32 进制有 100 多万种，正常不可能走到这里
    return randomCode(this.randInt) + Date.now().toString(36).slice(-2).toUpperCase();
  }

  create(conn) {
    this._sweep();
    const code = this._newCode();
    const room = {
      code,
      seed: this.randInt(1, 0x7FFFFFFF) >>> 0,
      slots: [null, null],
      tokens: [null, null],
      absentSince: [0, 0],
      hashes: [null, null],
      touchedAt: this.now(),
      started: false
    };
    this.rooms.set(code, room);
    this.stats.created++;
    return this._seat(room, conn, 0);
  }

  join(conn, code) {
    this._sweep();
    const key = String(code || '').toUpperCase().trim();
    const room = this.rooms.get(key);
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    // 空座位分两种：真没人 / 有人掉线还留着票。后者不能给别人，否则对方重连回来座位被占。
    const free = (room.slots[0] === null && !room.tokens[0]) ? 0
      : ((room.slots[1] === null && !room.tokens[1]) ? 1 : -1);
    if (free < 0) return { error: 'ROOM_FULL' };
    this.stats.joined++;
    return this._seat(room, conn, free);
  }

  _seat(room, conn, slot) {
    room.slots[slot] = conn;
    // 票据必须两人不同：相同的话，任一方都能顶另一方的座位
    let tok = randomToken(this.randInt);
    for (let i = 0; i < 5 && tok === room.tokens[1 - slot]; i++) tok = randomToken(this.randInt);
    room.tokens[slot] = tok;
    room.absentSince[slot] = 0;
    room.touchedAt = this.now();
    conn.meta = conn.meta || {};
    conn.meta.room = room.code;
    conn.meta.slot = slot;
    conn.meta.token = room.tokens[slot];
    return {
      code: room.code, slot, seed: room.seed,
      token: room.tokens[slot],
      peers: room.slots.filter(Boolean).length
    };
  }

  /**
   * 掉线（非主动退出）：座位先留着，等对方拿票据回来。
   *
   * 这里只做「登记」，真正的超时清理由 expire() 完成 —— rooms 不持有定时器，
   * 时间推进交给调用方，单测里才好用假的时钟。
   * @returns {{code:string, slot:number}|null} 需要安排超时清理时返回房号与槽位
   */
  detach(conn) {
    const code = conn.meta && conn.meta.room;
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const slot = conn.meta.slot;
    if (room.slots[slot] !== conn) return null;   // 已被新连接顶替，忽略旧连接的关闭事件

    room.slots[slot] = null;
    room.hashes[slot] = null;
    room.absentSince[slot] = this.now();
    conn.meta.room = null;
    this.stats.detached++;
    this.touched(room);

    const other = room.slots[1 - slot];
    if (!other || other.closed) {
      // 两个人都没了，没什么可等的
      this.rooms.delete(code);
      this.stats.closed++;
      return null;
    }
    other.send({ t: 'peer-offline', grace: GRACE_MS });
    return { code, slot };
  }

  /** 保留期到点仍没回来：这下才算真走了 */
  expire(code, slot) {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.slots[slot]) return null;      // 已经重连上了，什么都不用做
    room.tokens[slot] = null;
    room.absentSince[slot] = 0;
    this.touched(room);
    const other = room.slots[1 - slot];
    if (other && !other.closed) {
      room.hashes[1 - slot] = null;
      other.send({ t: 'peerleft' });
    } else {
      this.rooms.delete(code);
      this.stats.closed++;
    }
    return code;
  }

  /** 拿票据回到原座位；票据不对就当没这回事 */
  rejoin(conn, code, slot, token) {
    const room = this.rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return { error: 'ROOM_GONE' };
    slot = slot | 0;
    if (slot !== 0 && slot !== 1) return { error: 'BAD_SLOT' };
    if (!room.tokens[slot] || room.tokens[slot] !== String(token || '')) return { error: 'BAD_TOKEN' };
    if (room.slots[slot] && !room.slots[slot].closed) return { error: 'SLOT_TAKEN' };

    room.slots[slot] = conn;
    room.absentSince[slot] = 0;
    this.touched(room);
    conn.meta = conn.meta || {};
    conn.meta.room = room.code;
    conn.meta.slot = slot;
    conn.meta.token = room.tokens[slot];
    this.stats.rejoined++;

    const other = room.slots[1 - slot];
    if (other && !other.closed) other.send({ t: 'peer-online' });
    return { code: room.code, slot, seed: room.seed, resumed: true };
  }

  touched(room) { room.touchedAt = this.now(); }

  /** 两人到齐时把「开局」同时推给两端 */
  maybeStart(code) {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.slots[0] && room.slots[1] && !room.started) {
      room.started = true;
      room.touchedAt = this.now();
      return true;
    }
    return false;
  }

  get(code) { return this.rooms.get(code) || null; }

  peerOf(conn) {
    const room = this.rooms.get(conn.meta && conn.meta.room);
    if (!room) return null;
    const other = 1 - conn.meta.slot;
    const c = room.slots[other];
    return c && !c.closed ? c : null;
  }

  /** 转发给同房另一人 */
  relay(conn, msg) {
    const peer = this.peerOf(conn);
    if (peer) peer.send(msg);
    const room = this.rooms.get(conn.meta.room);
    if (room) room.touchedAt = this.now();
    return !!peer;
  }

  /** 记录并比对哈希，返回 true 表示检测到 desync */
  compareHash(conn, frame, hash) {
    const room = this.rooms.get(conn.meta && conn.meta.room);
    if (!room) return false;
    const me = conn.meta.slot;
    room.hashes[me] = { f: frame, h: hash };
    const other = 1 - me;
    const o = room.hashes[other];
    if (!o || o.f !== frame) return false;
    return o.h !== hash;
  }

  /** 主动退出（点了关闭/退出）：立刻放座位，不给保留期 */
  leave(conn) {
    const code = conn.meta && conn.meta.room;
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const slot = conn.meta.slot;
    room.slots[slot] = null;
    room.hashes[slot] = null;
    room.tokens[slot] = null;          // 主动走的人不该还能用旧票据回来
    room.absentSince[slot] = 0;
    room.started = false;
    room.touchedAt = this.now();
    const other = room.slots[1 - slot];
    if (other && !other.closed) {
      // 不动对手的槽位号：他的客户端就是按这个槽位收发输入的，中途改号必错位。
      // 只把他那份哈希清掉，等新对手进来自动补上。
      room.hashes[1 - slot] = null;
      other.send({ t: 'peerleft' });
    } else {
      this.rooms.delete(code);
      this.stats.closed++;
    }
    conn.meta.room = null;
    return code;
  }
}

module.exports = { Rooms, CODE_CHARS, CODE_LEN, ROOM_TTL_MS, GRACE_MS };
