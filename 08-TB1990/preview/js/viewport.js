/**
 * viewport.js - 移动端视口锁定（防页面缩放）
 *
 * 背景：iOS Safari 自 iOS 10 起忽略 <meta viewport> 的 user-scalable=no 与
 * maximum-scale，用户在游戏里连续点按摇杆会触发「双击缩放」，两指同时按在
 * 屏幕上会触发「双指捏合缩放」，结果整个页面被放大 2 倍左右——摇杆跟着变大，
 * 游戏画面被挤出屏幕，且没有明显的缩回入口。
 *
 * 这里用三层防护，从"不让它发生"到"发生了也自动复原"：
 *   1. 拦 Safari 私有手势事件  gesturestart / gesturechange / gestureend → preventDefault
 *   2. 拦双击缩放             dblclick + touchend 双击判定（300ms / 40px 内）
 *   3. 兜底自动复位            visualViewport.scale > 1.05 时重写 viewport meta 逼 Safari 重置
 *
 * 配合 CSS 里 #app 上的 touch-action: none（第一道防线，拦 pinch 最有效）。
 *
 * 【不要拦"双指按下"】曾经试过在 touchstart 里对 touches.length > 1 一律
 * preventDefault，结果会连带废掉"左手摇杆 + 右手按射击"这个核心操作——
 * 第二根手指的 touchstart 被拦后不再派发 pointer 事件，射击键就哑了。
 * 所以这里只拦 Safari 判定为缩放手势的 gesture* 事件，以及双击。
 *
 * 注意：单指点击/拖动、双指分别按不同控件，都完全不受影响。
 */
(function (g) {
  'use strict';
  if (!g || !g.document) return;

  var doc = g.document;

  var LOCK = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,' +
    'user-scalable=no,viewport-fit=cover';
  // 复位时先写入这个"临时放开"的值，再写回 LOCK：
  // Safari 只在 content 内容发生变化时才重新计算视口，值不变则不会复位缩放。
  var UNLOCK = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,' +
    'user-scalable=yes,viewport-fit=cover';

  var TAP_GAP = 300;   // 双击判定：两次 tap 的最大间隔（ms）
  var TAP_DIST = 40;   // 双击判定：两次 tap 的最大位移（px）
  var ZOOM_MAX = 1.05; // visualViewport.scale 超过它就认为被放大了

  var resetting = false;
  var metaCache = null;

  function metaEl() {
    if (metaCache && metaCache.parentNode) return metaCache;
    var m = doc.querySelector ? doc.querySelector('meta[name="viewport"]') : null;
    if (!m) {
      m = doc.createElement('meta');
      m.name = 'viewport';
      if (doc.head && doc.head.appendChild) doc.head.appendChild(m);
    }
    m.setAttribute('content', LOCK);
    metaCache = m;
    return m;
  }

  function applyLock() {
    var m = metaEl();
    if (m.getAttribute('content') !== LOCK) m.setAttribute('content', LOCK);
  }

  /** 强制 Safari 重新应用视口，把缩放比拉回 1。带防重入，避免抖动。 */
  function resetZoom() {
    if (resetting) return;
    resetting = true;
    var m = metaEl();
    m.setAttribute('content', UNLOCK);
    // 读一次布局属性，强制 Safari 走一遍视口重算
    void (doc.documentElement && doc.documentElement.offsetWidth);
    if (g.setTimeout) {
      g.setTimeout(function () {
        m.setAttribute('content', LOCK);
        void (doc.documentElement && doc.documentElement.offsetWidth);
        if (g.scrollTo) { try { g.scrollTo(0, 0); } catch (e) { } }
        resetting = false;
      }, 40);
    } else {
      resetting = false;
    }
  }

  function stop(e) {
    if (e && e.cancelable !== false && e.preventDefault) e.preventDefault();
  }

  /* ---------- 1. Safari 私有手势事件（pinch 缩放） ---------- */
  // gesturestart 只在 Safari 真正判定为缩放手势时触发，比"拦所有双指按下"精准，
  // 不会影响"摇杆 + 射击"同时按。
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    doc.addEventListener(t, stop, { passive: false });
  });

  /* ---------- 2. 双击缩放 ---------- */
  // 2a. 浏览器原生 dblclick
  doc.addEventListener('dblclick', stop, { passive: false });

  // 2b. 部分场景（元素上已 preventDefault）不会派发 dblclick，这里按时间+位移自己判
  var lastTap = 0, lastX = 0, lastY = 0;
  doc.addEventListener('touchend', function (e) {
    if (e.touches && e.touches.length) return;          // 还有其他手指按着
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var now = Date.now();
    var quick = (now - lastTap) < TAP_GAP;
    var near = Math.abs(t.clientX - lastX) < TAP_DIST &&
      Math.abs(t.clientY - lastY) < TAP_DIST;
    if (quick && near) {
      stop(e);                                          // 掐掉这次 tap 带出的缩放
      lastTap = 0;                                      // 重置，避免连点误判
      resetZoom();                                      // 万一已经放大了，顺手复原
      return;
    }
    lastTap = now; lastX = t.clientX; lastY = t.clientY;
  }, { passive: false });

  /* ---------- 3. 兜底：发现被放大就复位 ---------- */
  var vv = g.visualViewport;
  if (vv && vv.addEventListener) {
    var pending = null;
    var guard = function () {
      // 手势进行中会连续触发，节流一下，等用户手指离开再判断
      if (pending) return;
      pending = g.setTimeout(function () {
        pending = null;
        if (vv.scale > ZOOM_MAX) resetZoom();
      }, 220);
    };
    vv.addEventListener('resize', guard);
    vv.addEventListener('scroll', guard);
  }

  // 回到前台时检查一次（切到别的 App 再回来可能保留了缩放）
  doc.addEventListener('visibilitychange', function () {
    if (!doc.hidden && vv && vv.scale > ZOOM_MAX) resetZoom();
  });

  applyLock();

  g.VP = {
    LOCK: LOCK,
    resetZoom: resetZoom,
    applyLock: applyLock,
    /** 当前缩放比，供调试面板/测试用 */
    scale: function () { return (g.visualViewport && g.visualViewport.scale) || 1; }
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
