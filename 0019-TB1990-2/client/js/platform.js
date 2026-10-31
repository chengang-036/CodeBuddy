/**
 * platform.js - 平台适配层
 * 网页端：使用浏览器 DOM / Canvas / WebAudio
 * 微信小游戏：使用 wx.* API（这里只声明能力，具体由 game.js 入口注入）
 * 说明：所有 wx API 均以官方文档为准，网页预览一律用本地 mock 替代。
 */
(function (g) {
  'use strict';

  var isMiniGame = (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function');

  var Platform = {
    isMiniGame: isMiniGame,

    /** 全局作用域获取（小游戏为 GameGlobal） */
    global: g,

    /** 创建离屏 canvas（像素图缓存用） */
    createCanvas: function (w, h) {
      if (isMiniGame) {
        // 官方文档：wx.createCanvas() 创建画布
        var c = wx.createCanvas();
        c.width = w; c.height = h;
        return c;
      }
      var el = document.createElement('canvas');
      el.width = w; el.height = h;
      return el;
    },

    /** 本地存储：小游戏 wx.getStorageSync/setStorageSync，网页 localStorage */
    getStorage: function (key, def) {
      try {
        if (isMiniGame) {
          var v = wx.getStorageSync(key);
          return (v === '' || v === null || v === undefined) ? def : v;
        }
        var s = window.localStorage.getItem(key);
        return s === null ? def : s;
      } catch (e) { return def; }
    },
    setStorage: function (key, val) {
      try {
        if (isMiniGame) { wx.setStorageSync(key, val); }
        else { window.localStorage.setItem(key, val); }
      } catch (e) { /* 忽略存储失败 */ }
    },

    /** 震动反馈：wx.vibrateShort（微信基础库 1.2.0+），网页端静默 */
    vibrate: function (ms) {
      if (isMiniGame && typeof wx.vibrateShort === 'function') {
        try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
      }
    },

    /** 触摸/点击事件（用于菜单确认、按钮） */
    onPointerDown: function (handler) {
      if (isMiniGame) {
        if (typeof wx.onTouchStart === 'function') wx.onTouchStart(handler);
      } else if (g.__mainCanvas) {
        g.__mainCanvas.addEventListener('pointerdown', function (ev) {
          handler({ clientX: ev.clientX, clientY: ev.clientY, raw: ev });
        });
      }
    },

    /** 音频上下文：小游戏 wx.createWebAudioContext（2.19.0+），网页 AudioContext */
    createAudioContext: function () {
      if (isMiniGame && typeof wx.createWebAudioContext === 'function') {
        try { return wx.createWebAudioContext(); } catch (e) { return null; }
      }
      var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (AC) { try { return new AC(); } catch (e) { return null; } }
      return null;
    },

    /** 系统信息（用于安全区、DPR） */
    getSystemInfo: function () {
      if (isMiniGame) {
        try { return wx.getSystemInfoSync(); } catch (e) { return {}; }
      }
      return {
        pixelRatio: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1,
        windowWidth: (typeof window !== 'undefined' ? window.innerWidth : 512),
        windowHeight: (typeof window !== 'undefined' ? window.innerHeight : 480)
      };
    }
  };

  g.Platform = Platform;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
