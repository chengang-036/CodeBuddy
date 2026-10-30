/**
 * input.js - 输入（键盘 + 虚拟按键）
 * 键盘：方向键/WASD 移动，J/K/空格 射击，P/Esc 暂停，Enter/空格 确认
 * 虚拟按键：由网页端 DOM 按钮调用 setVirtual（移动端热区 >= 88x88）
 */
(function (g) {
  'use strict';

  var MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'fire', KeyJ: 'fire', KeyK: 'fire',
    KeyP: 'pause', Escape: 'pause',
    Enter: 'confirm'
  };

  var state = { up: false, down: false, left: false, right: false, fire: false };
  var virtual = { up: false, down: false, left: false, right: false, fire: false };
  var pressedEdge = { fire: false, pause: false, confirm: false };
  var listeners = { confirm: [], pause: [], anyKey: [] };

  function emit(name, arg) {
    (listeners[name] || []).forEach(function (fn) { fn(arg); });
  }

  var Input = {
    /** 供 main.js 初始化键盘（网页端） */
    initKeyboard: function (target) {
      target = target || (typeof window !== 'undefined' ? window : null);
      if (!target) return;
      target.addEventListener('keydown', function (e) {
        var act = MAP[e.code];
        if (!act) return;
        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
        if (!state[act]) {
          if (act === 'fire') pressedEdge.fire = true;
          if (act === 'pause') emit('pause');
          if (act === 'confirm') emit('confirm');
          if (act === 'up' || act === 'down' || act === 'left' || act === 'right') emit('anyKey', act);
        }
        state[act] = true;
      });
      target.addEventListener('keyup', function (e) {
        var act = MAP[e.code];
        if (act) state[act] = false;
      });
      target.addEventListener('blur', function () {
        for (var k in state) state[k] = false;
      });
    },

    /** 虚拟按键（触摸） */
    setVirtual: function (act, down) {
      if (!(act in virtual)) return;
      virtual[act] = !!down;
      if (down) {
        if (act === 'fire') pressedEdge.fire = true;
        emit('anyKey', act);
      }
    },

    isDown: function (act) { return !!(state[act] || virtual[act]); },

    /** 射击边沿（每帧读取一次后清除） */
    consumeFire: function () {
      if (pressedEdge.fire) { pressedEdge.fire = false; return true; }
      return false;
    },

    /** 当前是否有方向输入 */
    hasDir: function () {
      return this.isDown('up') || this.isDown('down') || this.isDown('left') || this.isDown('right');
    },

    /** 取一个方向（优先级：后按优先 -> 简化为上下左右固定优先） */
    pickDir: function () {
      if (this.isDown('up')) return 'UP';
      if (this.isDown('down')) return 'DOWN';
      if (this.isDown('left')) return 'LEFT';
      if (this.isDown('right')) return 'RIGHT';
      return null;
    },

    on: function (name, fn) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
    },

    /** 菜单点击/触摸确认 */
    triggerConfirm: function () { emit('confirm'); },
    triggerPause: function () { emit('pause'); },

    reset: function () {
      for (var k in state) state[k] = false;
      for (var v in virtual) virtual[v] = false;
      pressedEdge.fire = false;
    }
  };

  g.Input = Input;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
