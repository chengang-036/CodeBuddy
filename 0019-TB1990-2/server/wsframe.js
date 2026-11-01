/**
 * wsframe.js - 手写 RFC6455 WebSocket 服务端实现（零依赖）
 *
 * 为什么不装 ws：
 *   托管沙箱里 `npm install` 要联网，一旦失败整个发布就废了。
 *   这个游戏只用「文本帧 + ping/pong + close」四件事，自己写 150 行比装包更稳。
 *
 * 支持：
 *   - 握手（Sec-WebSocket-Accept）
 *   - 分片帧重组（continuation）
 *   - 掩码解包（浏览器→服务端必带掩码）
 *   - ping / pong / close
 *   - 长度 7bit / 16bit / 64bit 三档
 *
 * 不支持（用不到）：扩展协商、子协议、二进制压缩。
 */
'use strict';

const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BIN = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xA;
const MAX_PAYLOAD = 1 << 20;   // 1MB 上限，防止恶意超大帧打爆内存

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

function isUpgradeRequest(req) {
  const up = String(req.headers.upgrade || '').toLowerCase();
  return up === 'websocket' && !!req.headers['sec-websocket-key'];
}

/** 完成握手，把 socket 包成 Conn */
function upgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
  );
  const conn = new Conn(socket);
  if (head && head.length) conn._feed(head);
  return conn;
}

/** 组帧（服务端→客户端不加掩码） */
function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x80 | opcode;   // FIN + opcode
  return Buffer.concat([header, payload]);
}

class Conn {
  constructor(socket) {
    this.socket = socket;
    this.closed = false;
    this._buf = Buffer.alloc(0);
    this._fragOp = 0;
    this._fragChunks = [];
    this._msgCb = null;
    this._closeCb = null;
    this.meta = {};            // 上层挂的房间/槽位等

    try { socket.setNoDelay(true); } catch (e) { /* 小包即时发，别攒 */ }

    socket.on('data', (chunk) => this._feed(chunk));
    socket.on('error', () => this._finish());
    // 对端半关闭（直接 socket.end() 或进程被杀）只会触发 end，不会触发 close。
    // 不处理这条，房间会一直留着一个「已死但没断」的观察者，掉线通知永远发不出去。
    socket.on('end', () => {
      this._finish();
      try { socket.end(); } catch (e) { }
    });
    socket.on('close', () => this._finish());
  }

  onMessage(cb) { this._msgCb = cb; return this; }
  onClose(cb) { this._closeCb = cb; return this; }

  _finish() {
    if (this.closed) return;
    this.closed = true;
    if (this._closeCb) { try { this._closeCb(); } catch (e) { } }
  }

  _feed(chunk) {
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    // 一个 TCP 包里可能有多帧，循环榨干
    while (this._parseOne()) { /* keep going */ }
  }

  /** 解析一帧；数据不够返回 false 等下次 */
  _parseOne() {
    const buf = this._buf;
    if (buf.length < 2) return false;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;

    if (len === 126) {
      if (buf.length < off + 2) return false;
      len = buf.readUInt16BE(off);
      off += 2;
    } else if (len === 127) {
      if (buf.length < off + 8) return false;
      const hi = buf.readUInt32BE(off);
      const lo = buf.readUInt32BE(off + 4);
      if (hi !== 0) return this._fail('payload too large');
      len = lo;
      off += 8;
    }
    if (len > MAX_PAYLOAD) return this._fail('payload over limit');

    let maskKey = null;
    if (masked) {
      if (buf.length < off + 4) return false;
      maskKey = buf.slice(off, off + 4);
      off += 4;
    }
    if (buf.length < off + len) return false;

    let payload = buf.slice(off, off + len);
    if (masked) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i & 3];
      payload = out;
    }
    this._buf = buf.slice(off + len);

    this._handleFrame(fin, opcode, payload);
    return this._buf.length >= 2;
  }

  _handleFrame(fin, opcode, payload) {
    if (opcode === OP_PING) { this._send(OP_PONG, payload); return; }
    if (opcode === OP_PONG) return;
    if (opcode === OP_CLOSE) {
      this._send(OP_CLOSE, Buffer.alloc(0));
      try { this.socket.end(); } catch (e) { }
      this._finish();
      return;
    }

    if (opcode === OP_CONT) {
      this._fragChunks.push(payload);
      if (!fin) return;
      payload = Buffer.concat(this._fragChunks);
      opcode = this._fragOp;
      this._fragChunks = [];
      this._fragOp = 0;
    } else if (!fin) {
      this._fragOp = opcode;
      this._fragChunks = [payload];
      return;
    }

    if (opcode === OP_TEXT || opcode === OP_BIN) {
      if (this._msgCb) {
        try { this._msgCb(payload.toString('utf8')); } catch (e) { /* 上层异常不能拖垮连接 */ }
      }
    }
  }

  _fail(reason) {
    try { this.socket.destroy(); } catch (e) { }
    this._finish();
    return false;
  }

  _send(opcode, payload) {
    if (this.closed) return false;
    try { this.socket.write(encodeFrame(opcode, payload)); return true; }
    catch (e) { this._finish(); return false; }
  }

  /** 发文本（JSON） */
  send(obj) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return this._send(OP_TEXT, Buffer.from(s, 'utf8'));
  }

  close(code, reason) {
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code || 1000, 0);
    this._send(OP_CLOSE, payload);
    try { this.socket.end(); } catch (e) { }
    this._finish();
  }
}

module.exports = { upgrade, isUpgradeRequest, encodeFrame, acceptKey, Conn };
