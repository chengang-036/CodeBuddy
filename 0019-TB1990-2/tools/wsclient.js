/**
 * wsclient.js - 测试用的极简 WebSocket 客户端（Node 原生，零依赖）
 *
 * 为什么自己写：托管沙箱装不了 npm 包时，端到端测试还得跑。
 * 这里只实现测试需要的部分：握手、发文本帧（带掩码）、收文本帧、ping/pong、close。
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeMasked(opcode, payload) {
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x80 | opcode;
  const body = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) body[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, body]);
}

class WsClient {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.messages = [];
    this.closed = false;
    this._waiters = [];
    socket.on('data', (d) => this._feed(d));
    socket.on('close', () => { this.closed = true; this._flush(); });
    socket.on('error', () => { this.closed = true; this._flush(); });
  }

  _feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = this.buf.readUInt32BE(6); off = 10;
      }
      const masked = (b1 & 0x80) !== 0;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len);
      this.buf = this.buf.slice(off + len);

      if (opcode === 0x1) {
        let obj = null;
        try { obj = JSON.parse(payload.toString('utf8')); } catch (e) { obj = { raw: payload.toString('utf8') }; }
        this.messages.push(obj);
        this._flush();
      } else if (opcode === 0x9) {
        this.socket.write(encodeMasked(0xA, payload));
      } else if (opcode === 0x8) {
        this.closed = true;
        this.socket.end();
        this._flush();
      }
    }
  }

  _flush() {
    this._waiters = this._waiters.filter((w) => !w.check());
  }

  send(obj) {
    this.socket.write(encodeMasked(0x1, Buffer.from(JSON.stringify(obj), 'utf8')));
  }

  /** 取第一条满足条件的消息（从缓冲里删除），没有则等 */
  next(pred, timeoutMs) {
    pred = pred || (() => true);
    timeoutMs = timeoutMs === undefined ? 3000 : timeoutMs;

    return new Promise((resolve, reject) => {
      const pick = () => {
        for (let i = 0; i < this.messages.length; i++) {
          if (pred(this.messages[i])) return this.messages.splice(i, 1)[0];
        }
        return null;
      };
      const hit = pick();
      if (hit) { resolve(hit); return; }

      let done = false;
      const timer = setTimeout(() => {
        if (done) return; done = true;
        reject(new Error('timeout waiting for message; got=' + JSON.stringify(this.messages.slice(-5))));
      }, timeoutMs);

      const w = {
        check: () => {
          if (done) return true;
          const found = pick();
          if (found) {
            done = true; clearTimeout(timer); resolve(found); return true;
          }
          if (this.closed) {
            done = true; clearTimeout(timer);
            reject(new Error('closed while waiting')); return true;
          }
          return false;
        }
      };
      this._waiters.push(w);
    });
  }

  close() { try { this.socket.end(); } catch (e) { } }
}

/** @returns {Promise<WsClient>} */
function connect(port, pathname) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      port, host: '127.0.0.1', path: pathname || '/ws',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13'
      }
    });
    req.on('upgrade', (res, socket) => {
      const expect = crypto.createHash('sha1').update(key + GUID).digest('base64');
      if (res.headers['sec-websocket-accept'] !== expect) {
        socket.destroy();
        reject(new Error('bad accept key'));
        return;
      }
      resolve(new WsClient(socket));
    });
    req.on('response', (res) => reject(new Error('unexpected HTTP ' + res.statusCode)));
    req.on('error', reject);
    req.end();
  });
}

module.exports = { connect };
