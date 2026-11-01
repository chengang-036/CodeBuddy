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

function randomCode(randInt) {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[randInt(0, CODE_CHARS.length - 1)];
  return s;
}

class Rooms {
  constructor(opt) {
    opt = opt || {};
    this.rooms = new Map();
    this.now = opt.now || Date.now;
    this.randInt = opt.randInt || ((a, b) => a + Math.floor(Math.random() * (b - a + 1)));
    this.stats = { created: 0, joined: 0, closed: 0 };
  }

  _sweep() {
    const t = this.now();
    for (const [code, room] of this.rooms) {
      const alive = room.slots.some((c) => c && !c.closed);
      if (!alive || t - room.touchedAt > ROOM_TTL_MS) {
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
    const free = room.slots[0] === null ? 0 : (room.slots[1] === null ? 1 : -1);
    if (free < 0) return { error: 'ROOM_FULL' };
    this.stats.joined++;
    return this._seat(room, conn, free);
  }

  _seat(room, conn, slot) {
    room.slots[slot] = conn;
    room.touchedAt = this.now();
    conn.meta = conn.meta || {};
    conn.meta.room = room.code;
    conn.meta.slot = slot;
    return { code: room.code, slot, seed: room.seed, peers: room.slots.filter(Boolean).length };
  }

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

  /** 掉线：通知对手，释放槽位 */
  leave(conn) {
    const code = conn.meta && conn.meta.room;
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const slot = conn.meta.slot;
    room.slots[slot] = null;
    room.hashes[slot] = null;
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

module.exports = { Rooms, CODE_CHARS, CODE_LEN, ROOM_TTL_MS };
