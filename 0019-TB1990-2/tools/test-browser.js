/**
 * test-browser.js - 真浏览器双端联机 E2E（Chrome CDP 驱动）
 *
 * 为什么要这一步：Node 里的 test-online.js 验证的是逻辑一致性，
 * 但「WebSocket 能不能连上、UI 有没有把槽位搞反、rAF 驱动对不对」
 * 只有真浏览器能证明。之前的 --virtual-time-budget 截图法对真实网络不可靠
 * （虚拟时间跑完时 WS 还没握手），所以这里用 CDP 精确控制两个标签页。
 *
 * 流程：
 *   1. 起 Chrome（remote-debugging-port）
 *   2. 标签 A 打开 ?net=create，轮询到拿到 4 位房号
 *   3. 标签 B 打开 ?net=join=房号
 *   4. 等两边都推进到 120 帧以上，读取 __net() 探针
 *   5. 断言：房号一致 / 槽位 0 与 1 / 无 desync / 帧号接近 / 状态 playing
 *
 * 运行：node tools/test-browser.js   （需要先起 server，见脚本内 BASE）
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { connect } = require('./wsclient');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8940';
// 必须两个独立浏览器进程：同一个浏览器里后台标签的 requestAnimationFrame 会被
// Chrome 暂停，后台那台就永远不推帧——那是浏览器行为，不是游戏 bug。
// 两台手机本来就是两个独立的浏览器。
const PORTS = [9222, 9223];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

function httpJson(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request(Object.assign({ host: '127.0.0.1', port: port }, opts), (res) => {
      let b = '';
      res.on('data', (d) => b += d);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 一个 CDP 连接（极简：只用到 Runtime.evaluate 与 Page.captureScreenshot） */
class Tab {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.waiting = new Map();
    ws._onMessage = null;
    // wsclient 只做缓冲，这里挂一个轮询把响应取出
    this._pump = setInterval(() => {
      while (this.ws.messages.length) {
        const m = this.ws.messages.shift();
        if (m && m.id && this.waiting.has(m.id)) {
          const { resolve, timer } = this.waiting.get(m.id);
          this.waiting.delete(m.id);
          clearTimeout(timer);
          resolve(m);
        }
      }
    }, 5);
  }

  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 8000);
      this.waiting.set(id, { resolve, timer });
      this.ws.send({ id, method, params: params || {} });
    });
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: false
    });
    if (r.error) throw new Error(JSON.stringify(r.error));
    const res = r.result || {};
    if (res.exceptionDetails) {
      return { __error: res.exceptionDetails.text || 'exception' };
    }
    return res.result ? res.result.value : undefined;
  }

  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  }

  close() { clearInterval(this._pump); try { this.ws.close(); } catch (e) { } }
}

async function newTab(port, url) {
  const t = await httpJson(port, { path: '/json/new?' + encodeURIComponent(url), method: 'PUT' });
  if (!t || !t.webSocketDebuggerUrl) throw new Error('无法创建标签页: ' + JSON.stringify(t));
  const u = new URL(t.webSocketDebuggerUrl);
  const ws = await connect(parseInt(u.port, 10), u.pathname);
  const tab = new Tab(ws);
  await tab.send('Runtime.enable');
  await tab.send('Page.enable');
  return tab;
}

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(150);
  }
  throw new Error('等待超时: ' + label);
}

(async () => {
  // 服务必须先起来
  try {
    await new Promise((resolve, reject) => {
      http.get(BASE + '/healthz', (r) => { r.resume(); resolve(); }).on('error', reject);
    });
  } catch (e) {
    console.log('✗ 联机服务没起来（' + BASE + '），先跑：SERVE_TOOLS=1 PORT=8940 node server.js');
    process.exit(1);
  }

  const profiles = PORTS.map((p) => '/tmp/tb-cdp-' + p + '-' + process.pid);
  const chromes = PORTS.map((port, i) => spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profiles[i],
    '--window-size=420,900',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    'about:blank'
  ], { stdio: 'ignore' }));

  let tabA, tabB;
  try {
    await waitFor(async () => {
      try {
        const vs = await Promise.all(PORTS.map((p) => httpJson(p, { path: '/json/version' })));
        return vs.every((v) => v && v.webSocketDebuggerUrl);
      } catch (e) { return false; }
    }, 20000, '两个 Chrome 调试端口');

    console.log('\n[1] 标签 A 自动建房');
    tabA = await newTab(PORTS[0], BASE + '/index.html?touch=1&net=create');
    const code = await waitFor(async () => {
      const s = await tabA.eval('window.__net ? JSON.stringify(window.__net()) : null');
      if (!s || typeof s !== 'string') return null;
      try {
        const o = JSON.parse(s);
        return (o.code && o.code.length === 4) ? o : null;
      } catch (e) { return null; }
    }, 12000, 'A 拿到房号');
    ok('A 建房成功，房号 4 位', /^[2-9A-Z]{4}$/.test(code.code), code);
    ok('A 状态为 waiting', code.status === 'waiting', code.status);

    console.log('\n[2] 标签 B 用房号加入');
    tabB = await newTab(PORTS[1], BASE + '/index.html?touch=1&net=join=' + code.code);

    const bothStarted = await waitFor(async () => {
      const [a, b] = await Promise.all([
        tabA.eval('window.__net ? JSON.stringify(window.__net()) : null'),
        tabB.eval('window.__net ? JSON.stringify(window.__net()) : null')
      ]);
      if (!a || !b) return null;
      const A = JSON.parse(a), B = JSON.parse(b);
      return (A.status === 'playing' && B.status === 'playing') ? [A, B] : null;
    }, 15000, '两端进入对局');
    ok('两端都进入 playing', !!bothStarted);

    const [A0, B0] = bothStarted;
    ok('两端房号一致', A0.code === B0.code, [A0.code, B0.code]);
    ok('槽位互补（0 与 1）', A0.slot !== B0.slot && (A0.slot === 0 || A0.slot === 1), [A0.slot, B0.slot]);

    console.log('\n[3] 让两端跑 2 秒，检查帧推进与 desync');
    await sleep(2000);
    const [A, B] = await Promise.all([
      tabA.eval('JSON.stringify(window.__net())'),
      tabB.eval('JSON.stringify(window.__net())')
    ]).then(([a, b]) => [JSON.parse(a), JSON.parse(b)]);

    ok('A 在推进（帧号 > 60）', A.frame > 60, A.frame);
    ok('B 在推进（帧号 > 60）', B.frame > 60, B.frame);
    ok('两端帧号接近（差 ≤ 8）', Math.abs(A.frame - B.frame) <= 8, [A.frame, B.frame]);
    ok('两端都没有 desync', A.desync < 0 && B.desync < 0, [A.desync, B.desync]);
    ok('两端都测到 RTT', A.rtt >= 0 && B.rtt >= 0, [A.rtt, B.rtt]);

    console.log('\n[4] 真实按键跨端生效');
    // 等过场结束，坦克真正能动
    await waitFor(async () => {
      const st = await tabA.eval('window.__game ? window.__game.state : -1');
      return st === 1 || st === 0 ? false : true;
    }, 8000, 'A 进入可操作状态').catch(() => {});

    const before = JSON.parse(await tabA.eval(
      'JSON.stringify(window.__game.players[0] ? {x:window.__game.players[0].x, y:window.__game.players[0].y, st:window.__game.state} : null)'));
    // 直接驱动输入层（等价于手指推摇杆）
    await tabA.eval('window.Input.setVirtual(0,"up",true), 1');
    await sleep(900);
    await tabA.eval('window.Input.setVirtual(0,"up",false), 1');
    await sleep(400);

    const afterA = JSON.parse(await tabA.eval(
      'JSON.stringify(window.__game.players[0] ? {x:window.__game.players[0].x, y:window.__game.players[0].y} : null)'));
    const afterB = JSON.parse(await tabB.eval(
      'JSON.stringify(window.__game.players[0] ? {x:window.__game.players[0].x, y:window.__game.players[0].y} : null)'));

    ok('按上键后 A 端坦克向上移动了', before && afterA && afterA.y < before.y,
      before && afterA && [before.y, afterA.y]);
    ok('B 端看到的同一辆坦克位置与 A 完全一致',
      afterA && afterB && afterA.x === afterB.x && afterA.y === afterB.y, [afterA, afterB]);

    // 截图存档
    const docs = path.join(__dirname, '..', 'docs');
    if (!fs.existsSync(docs)) fs.mkdirSync(docs);
    await tabA.shot(path.join(docs, 'online-a.png'));
    await tabB.shot(path.join(docs, 'online-b.png'));
    ok('两端截图已保存', fs.existsSync(path.join(docs, 'online-a.png')));

    console.log('\n  进度：A ' + A.frame + ' 帧 / B ' + B.frame + ' 帧，本地 RTT '
      + A.rtt + 'ms / ' + B.rtt + 'ms');
    console.log('  A 内部: ' + JSON.stringify(A.dbg));
    console.log('  B 内部: ' + JSON.stringify(B.dbg));

  } catch (e) {
    fail++;
    console.log('\n  ✗ 中断: ' + e.message);
  } finally {
    if (tabA) tabA.close();
    if (tabB) tabB.close();
    chromes.forEach((c) => c.kill('SIGTERM'));
    for (const pf of profiles) { try { fs.rmSync(pf, { recursive: true, force: true }); } catch (e) { } }
  }

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '失败 ' + fail + ' 项 / 通过 ' + pass + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})();
