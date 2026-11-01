/**
 * netui.js - 联机面板（纯 DOM，不画在 canvas 里）
 *
 * 为什么不在 canvas 画输入框：手机上调起软键盘、选中、粘贴、光标，
 * 全部要自己实现，还容易触发页面缩放。用原生 <input> 一行就解决。
 */
(function (g) {
  'use strict';

  var el = {};
  var handlers = {};

  function $(id) { return document.getElementById(id); }

  function setStatus(text, kind) {
    if (!el.status) return;
    el.status.textContent = text || '';
    el.status.className = 'np-status' + (kind ? ' is-' + kind : '');
  }

  function submitJoin() {
    var code = (el.codeInput.value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 4);
    if (code.length !== 4) { setStatus('房号是 4 位，检查一下', 'err'); return; }
    if (handlers.onJoin) handlers.onJoin(code);
  }

  var NetUI = {
    init: function (opt) {
      handlers = opt || {};
      el.box = $('netpanel');
      el.step1 = $('np-step1');
      el.step2 = $('np-step2');
      el.codeInput = $('np-code');
      el.codeBig = $('np-codebig');
      el.status = $('np-status');
      el.tip = $('np-step2-tip');
      if (!el.box) return;

      $('np-create').addEventListener('click', function () {
        if (handlers.onCreate) handlers.onCreate();
      });
      $('np-join').addEventListener('click', submitJoin);

      // 面板里的键盘事件必须拦住，否则打字时 W/A/S/D 会被当成移动、空格当成开火
      el.codeInput.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') submitJoin();
      });
      el.codeInput.addEventListener('keyup', function (e) { e.stopPropagation(); });
      el.codeInput.addEventListener('input', function () {
        el.codeInput.value = el.codeInput.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 4);
      });

      $('np-close').addEventListener('click', function () { NetUI.close(); });
    },

    /** 打开面板（回到「创建 / 加入」选择态） */
    open: function () {
      if (!el.box) return;
      el.box.classList.remove('np-hidden');
      el.step1.classList.remove('np-hidden');
      el.step2.classList.add('np-hidden');
      setStatus('');
      try { el.codeInput.blur(); } catch (e) { }
    },

    /** 已建房 / 已进房，展示大房号 */
    waiting: function (code, slot) {
      if (!el.box) return;
      el.step1.classList.add('np-hidden');
      el.step2.classList.remove('np-hidden');
      el.codeBig.textContent = code;
      el.tip.textContent = slot === 0 ? '把房号报给队友，等对方输入加入' : '已进房，等房主那边同步';
      setStatus('等待队友…');
    },

    peerJoined: function () {
      setStatus('队友已进来，正在同步开局…', 'ok');
    },

    starting: function () {
      setStatus('开局！', 'ok');
    },

    error: function (msg) {
      if (!el.box) return;
      el.box.classList.remove('np-hidden');
      el.step1.classList.remove('np-hidden');
      el.step2.classList.add('np-hidden');
      setStatus(msg || '出错了', 'err');
    },

    peerLeft: function () {
      if (!el.box) return;
      el.box.classList.remove('np-hidden');
      el.step2.classList.remove('np-hidden');
      el.step1.classList.add('np-hidden');
      setStatus('对手已断开连接', 'err');
      el.tip.textContent = '本局已结束';
    },

    /** 对局中打开面板（当菜单用：看房号 / 退出） */
    inGame: function (code) {
      if (!el.box) return;
      el.box.classList.remove('np-hidden');
      el.step1.classList.add('np-hidden');
      el.step2.classList.remove('np-hidden');
      el.codeBig.textContent = code || '----';
      el.tip.textContent = '对局进行中，关掉面板可以继续';
      setStatus('联机中');
    },

    /** 只隐藏，不触发 onClose（开局后自动收起用这个） */
    hide: function () {
      if (el.box) el.box.classList.add('np-hidden');
    },

    close: function () {
      if (!el.box) return;
      el.box.classList.add('np-hidden');
      if (handlers.onClose) handlers.onClose();
    },

    isOpen: function () { return el.box ? !el.box.classList.contains('np-hidden') : false; }
  };

  g.NetUI = NetUI;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
