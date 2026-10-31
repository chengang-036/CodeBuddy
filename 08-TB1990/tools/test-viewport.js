/**
 * test-viewport.js - 视口锁定（防页面缩放）专项测试
 *
 * 用最小 DOM mock 加载 preview/js/viewport.js，验证三层防护的行为：
 *   1. 单指 touchstart 不能被拦（否则摇杆/按钮全废）
 *   2. 双指 touchstart 也不能被拦（否则摇杆+射击无法同时按）
 *   3. Safari 私有 gesture 事件必须被拦
 *   4. dblclick 必须被拦
 *   5. 快速连点两次（双击）必须被拦并触发复位
 *   6. 慢速两次点击不能被误拦
 *   7. visualViewport.scale 变大后要自动复位（meta 经历 UNLOCK → LOCK）
 *
 * 运行：node tools/test-viewport.js
 */
'use strict';

const path = require('path');

/* ---------------- 最小 DOM mock ---------------- */
const listeners = {};
const metaHistory = [];
const meta = {
  name: 'viewport',
  _content: 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover',
  parentNode: {},
  getAttribute() { return this._content; },
  setAttribute(k, v) { this._content = v; metaHistory.push(v); }
};

const vv = { scale: 1, _ls: {},
  addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); }
};

global.document = {
  hidden: false,
  documentElement: { get offsetWidth() { return 390; } },
  body: { get offsetHeight() { return 844; } },
  head: { appendChild() {} },
  querySelector(sel) { return /viewport/.test(sel) ? meta : null; },
  createElement() { return { name: '', setAttribute(k, v) { this._content = v; } }; },
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); }
};
global.visualViewport = vv;
global.scrollTo = () => {};

require(path.join(__dirname, '..', 'preview', 'js', 'viewport.js'));

const VP = global.VP;

/* ---------------- 断言小工具 ---------------- */
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  →  ' + extra : '')); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fire(type, ev) {
  const arr = listeners[type] || [];
  const e = Object.assign({ cancelable: true, defaultPrevented: false }, ev);
  e.preventDefault = function () { e.defaultPrevented = true; };
  arr.forEach(fn => fn(e));
  return e;
}
const touch = (x, y) => ({ clientX: x, clientY: y });

(async function run() {
  console.log('\n【视口锁定专项】');

  // T0 模块装载后 viewport meta 已被锁死
  ok('装载后 viewport meta 锁定为 maximum-scale=1',
    /maximum-scale=1/.test(meta.getAttribute('content')) && /user-scalable=no/.test(meta.getAttribute('content')),
    meta.getAttribute('content'));
  ok('对外暴露 VP.resetZoom', typeof VP.resetZoom === 'function');

  // T1 单指按下不拦
  let e1 = fire('touchstart', { touches: [touch(100, 100)] });
  ok('单指 touchstart 不被拦截（摇杆可用）', !e1.defaultPrevented);

  // T2 双指按下也不能拦！否则"左手摇杆 + 右手射击"同时按会哑火
  let e2 = fire('touchstart', { touches: [touch(100, 100), touch(300, 700)] });
  ok('双指同时按下不被拦截（摇杆+射击可同时按）', !e2.defaultPrevented);
  ok('未注册任何 touchstart 拦截器（不误伤多指操控）', !(listeners.touchstart && listeners.touchstart.length));

  // T3 gesture 事件
  let g1 = fire('gesturestart', {});
  let g2 = fire('gesturechange', {});
  ok('gesturestart / gesturechange 被拦截（Safari 私有）',
    g1.defaultPrevented && g2.defaultPrevented);

  // T4 dblclick
  let d1 = fire('dblclick', {});
  ok('dblclick 被拦截', d1.defaultPrevented);

  // T5 快速双击 → 拦 + 复位
  metaHistory.length = 0;
  fire('touchend', { touches: [], changedTouches: [touch(200, 600)] });
  await sleep(20);
  let e5 = fire('touchend', { touches: [], changedTouches: [touch(203, 602)] });
  ok('快速双击的第二次 tap 被拦截', e5.defaultPrevented);
  await sleep(80);
  ok('双击触发视口复位（meta 先放开再锁回）',
    metaHistory.length >= 2 && /maximum-scale=5/.test(metaHistory[0]) &&
    /maximum-scale=1/.test(meta.getAttribute('content')),
    JSON.stringify(metaHistory));

  // T6 慢速两次点击不误拦
  await sleep(400);
  fire('touchend', { touches: [], changedTouches: [touch(50, 50)] });
  await sleep(500);
  let e6 = fire('touchend', { touches: [], changedTouches: [touch(52, 51)] });
  ok('间隔 >300ms 的两次点击不被误拦', !e6.defaultPrevented);

  // T7 visualViewport.scale 变大 → 自动复位
  metaHistory.length = 0;
  vv.scale = 2;
  (vv._ls.resize || []).forEach(fn => fn({}));
  await sleep(320);
  ok('页面被放大到 2 倍后自动复位（meta 重新写入锁值）',
    metaHistory.length >= 2 && /maximum-scale=1/.test(meta.getAttribute('content')),
    JSON.stringify(metaHistory));

  // T8 未放大时不应无谓复位
  metaHistory.length = 0;
  vv.scale = 1;
  (vv._ls.resize || []).forEach(fn => fn({}));
  await sleep(320);
  ok('缩放比为 1 时不触发复位（不做无用重排）', metaHistory.length === 0,
    JSON.stringify(metaHistory));

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败\n');
  process.exit(fail ? 1 : 0);
})();
