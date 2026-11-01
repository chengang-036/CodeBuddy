/**
 * server.js - 坦克大战联机中继服务（零依赖，Node 原生 http + 手写 WebSocket）
 *
 * 职责边界（很重要）：
 *   服务器**不跑任何游戏逻辑**，只做三件事：发房间号、转发输入字节、比对状态哈希。
 *   所以 1 核 2G 的小机器能挂上百个房间，而且「录像 / 观战 / 断线重连」都不用额外设计。
 *
 * 对外接口：
 *   GET  /            静态站点（client 目录）
 *   GET  /healthz     健康检查
 *   WS   /ws          联机通道
 *
 * 环境变量：PORT（必填，托管平台注入）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const wsframe = require('./server/wsframe');
const { Rooms } = require('./server/rooms');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = path.join(__dirname, 'client');
// 本地联调时才把 tools/ 暴露出来（双端联调页要用）；线上默认关闭
const TOOLS = process.env.SERVE_TOOLS ? path.join(__dirname, 'tools') : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

const rooms = new Rooms();

/* ==================== 静态文件 ==================== */

function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(url.parse(req.url).pathname); }
  catch (e) { res.writeHead(400); res.end('bad url'); return; }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  let base = ROOT;
  if (TOOLS && pathname.indexOf('/tools/') === 0) {
    base = TOOLS;
    pathname = pathname.slice('/tools'.length);
  }

  const full = path.join(base, pathname);
  // 目录穿越防护：拼出来的路径必须还在 base 里
  if (!full.startsWith(base + path.sep) && full !== base) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 not found');
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // 前端资源都带 ?v=xxx，这里只需保证别被中间层乱缓存
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    };
    res.writeHead(200, headers);
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    const body = JSON.stringify({ ok: true, rooms: rooms.rooms.size, stats: rooms.stats });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  serveStatic(req, res);
});

/* ==================== 联机通道 ==================== */

function handleWs(conn) {
  conn.onMessage((raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    switch (m.t) {
      /* ---- 建房 ---- */
      case 'create': {
        if (conn.meta.room) return;
        const r = rooms.create(conn);
        conn.send({ t: 'room', code: r.code, slot: r.slot, seed: r.seed });
        break;
      }

      /* ---- 加入 ---- */
      case 'join': {
        if (conn.meta.room) return;
        const r = rooms.join(conn, m.code);
        if (r.error) { conn.send({ t: 'err', code: r.error }); return; }
        const room = rooms.get(r.code);
        conn.send({ t: 'room', code: r.code, slot: r.slot, seed: r.seed });
        // 通知先到的那位：对手来了
        const other = room.slots[1 - r.slot];
        if (other && !other.closed) other.send({ t: 'peer', joined: true });
        // 两人齐了 → 同时喊开始（两端 seed / 槽位都已在 room 消息里拿到）
        if (rooms.maybeStart(r.code)) {
          for (let i = 0; i < 2; i++) {
            const c = room.slots[i];
            if (c && !c.closed) c.send({ t: 'go', code: r.code, seed: room.seed });
          }
        }
        break;
      }

      /* ---- 输入转发：服务器只搬砖，不解释内容 ---- */
      case 'in': {
        if (!conn.meta.room) return;
        rooms.relay(conn, {
          t: 'in',
          s: conn.meta.slot,
          a: m.a | 0,               // 对方已执行到哪帧，供其裁剪重发窗口
          f: m.f                    // [[frame, mask], ...]
        });
        break;
      }

      /* ---- 状态哈希比对，发现分歧主动广播 ---- */
      case 'hash': {
        if (!conn.meta.room) return;
        const bad = rooms.compareHash(conn, m.f | 0, String(m.h));
        rooms.relay(conn, { t: 'hash', s: conn.meta.slot, f: m.f | 0, h: String(m.h) });
        if (bad) {
          const room = rooms.get(conn.meta.room);
          if (room) {
            for (let i = 0; i < 2; i++) {
              const c = room.slots[i];
              if (c && !c.closed) c.send({ t: 'desync', f: m.f | 0 });
            }
          }
        }
        break;
      }

      /* ---- 心跳 / 测延迟 ---- */
      case 'ping': {
        conn.send({ t: 'pong', ts: m.ts });
        break;
      }

      case 'leave': {
        rooms.leave(conn);
        break;
      }

      default: break;
    }
  });

  conn.onClose(() => { rooms.leave(conn); });

  // 立刻回一条，客户端据此判定「通道真的通了」，而不是等它第一次发消息
  conn.send({ t: 'hello' });
}

server.on('upgrade', (req, socket, head) => {
  const pathname = (url.parse(req.url).pathname || '');
  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!wsframe.isUpgradeRequest(req)) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }
  const conn = wsframe.upgrade(req, socket, head);
  handleWs(conn);
});

// 反向代理常有空闲超时（常见 60s），定期 ping 让连接别被悄悄掐断
setInterval(() => {
  for (const room of rooms.rooms.values()) {
    for (const c of room.slots) {
      if (c && !c.closed) c._send(0x9, Buffer.alloc(0));
    }
  }
}, 25000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('[tank-coop] listening on 0.0.0.0:' + PORT + '  static=' + ROOT);
});
