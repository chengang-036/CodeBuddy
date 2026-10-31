/**
 * input.js - 输入（键盘双人 + 双虚拟摇杆）
 *
 * 双人键位（同一台电脑上两个人挤一把键盘，手感最接近街机）：
 *   P1（黄）：W A S D 移动，J / F / 左Shift 开火
 *   P2（绿）：↑ ↓ ← → 移动，空格 / K / 斜杠 开火
 *   全局：P / Esc 暂停，Enter 确认
 *
 * 单人模式（mode=1）：方向键与空格并入 P1，一个人用哪套键位都行。
 *
 * 触摸端：两套独立通道，各自一个摇杆 + 一个开火键，互不干扰
 *   （两根手指分别操作 P1 摇杆和 P2 摇杆时靠 pid 区分，绝不能共用状态）
 */
(function (g) {
  'use strict';

  function chan() {
    return {
      key: { up: false, down: false, left: false, right: false, fire: false },
      virt: { up: false, down: false, left: false, right: false, fire: false },
      fireEdge: false
    };
  }

  // e.code -> [slot, act]；slot = -1 表示全局动作（不受玩家席位影响）
  var MAP = {
    KeyW: [0, 'up'], KeyS: [0, 'down'], KeyA: [0, 'left'], KeyD: [0, 'right'],
    KeyJ: [0, 'fire'], KeyF: [0, 'fire'], ShiftLeft: [0, 'fire'],

    ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'],
    Space: [1, 'fire'], KeyK: [1, 'fire'], Slash: [1, 'fire'],

    KeyP: [-1, 'pause'], Escape: [-1, 'pause'],
    Enter: [-1, 'confirm']
  };

  var DIRS = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' };
  var STICK2ACT = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  var CH = [chan(), chan()];
  var mode = 2;
  var listeners = { confirm: [], pause: [], anyKey: [] };

  function emit(name, arg) {
    (listeners[name] || []).forEach(function (fn) { fn(arg); });
  }

  function ch(pid) { return CH[pid === 1 ? 1 : 0]; }

  /** 单人模式下 P1 也能用 P2 的键位 */
  function chanList(pid) {
    if (pid === 0 && mode === 1) return [CH[0], CH[1]];
    return [ch(pid)];
  }

  function downIn(c, act) { return !!(c.key[act] || c.virt[act]); }

  var Input = {
    /** 切换游戏模式：1 = 单人（方向键并入 P1），2 = 双人 */
    setMode: function (m) { mode = (m === 1) ? 1 : 2; },
    getMode: function () { return mode; },

    /** 供 main.js 初始化键盘（网页端） */
    initKeyboard: function (target) {
      target = target || (typeof window !== 'undefined' ? window : null);
      if (!target) return;
      target.addEventListener('keydown', function (e) {
        var m = MAP[e.code];
        if (!m) return;
        var slot = m[0], act = m[1];
        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();

        if (slot < 0) {
          if (act === 'pause' && !e.repeat) emit('pause');
          if (act === 'confirm' && !e.repeat) emit('confirm');
          return;
        }
        var c = CH[slot];
        if (!c.key[act]) {
          if (act === 'fire') c.fireEdge = true;
          if (DIRS[act]) emit('anyKey', act);
        }
        c.key[act] = true;
      });
      target.addEventListener('keyup', function (e) {
        var m = MAP[e.code];
        if (!m || m[0] < 0) return;
        CH[m[0]].key[m[1]] = false;
      });
      target.addEventListener('blur', function () { Input.reset(); });
    },

    /** 虚拟按键（触摸）。签名：setVirtual(pid, act, down) */
    setVirtual: function (pid, act, d) {
      if (typeof pid === 'string') { d = act; act = pid; pid = 0; }  // 兼容旧签名
      var c = ch(pid);
      if (!(act in c.virt)) return;
      c.virt[act] = !!d;
      if (d) {
        if (act === 'fire') c.fireEdge = true;
        emit('anyKey', act);
      }
    },

    /**
     * 虚拟摇杆方向（4 向）：dir 为 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null
     * 签名：setStickDir(pid, dir)。摇杆是「互斥方向」语义，设置时自动清掉其它方向。
     */
    setStickDir: function (pid, dir) {
      if (typeof pid === 'string' || pid === null) { dir = pid; pid = 0; }  // 兼容旧签名
      var c = ch(pid);
      var act = STICK2ACT[dir] || null;
      if (act && !c.virt[act]) emit('anyKey', act);
      c.virt.up = (act === 'up');
      c.virt.down = (act === 'down');
      c.virt.left = (act === 'left');
      c.virt.right = (act === 'right');
    },

    /** 摇杆当前方向（供 UI 画高亮） */
    stickDir: function (pid) {
      var c = ch(pid);
      if (c.virt.up) return 'UP';
      if (c.virt.down) return 'DOWN';
      if (c.virt.left) return 'LEFT';
      if (c.virt.right) return 'RIGHT';
      return null;
    },

    /** 某位玩家的动作是否按下（单人模式下 P1 会合并两套键位） */
    isDown: function (act, pid) {
      var list = chanList(pid === undefined ? 0 : pid);
      for (var i = 0; i < list.length; i++) if (downIn(list[i], act)) return true;
      return false;
    },

    /** 射击边沿（每帧读取一次后清除） */
    consumeFire: function (pid) {
      var c = ch(pid);
      if (c.fireEdge) { c.fireEdge = false; return true; }
      return false;
    },

    /** 某位玩家当前是否有方向输入 */
    hasDir: function (pid) {
      return !!this.pickDir(pid);
    },

    /** 取一位玩家的方向（固定优先：上 下 左 右） */
    pickDir: function (pid) {
      var list = chanList(pid === undefined ? 0 : pid);
      var order = ['up', 'down', 'left', 'right'];
      for (var k = 0; k < order.length; k++) {
        for (var i = 0; i < list.length; i++) {
          if (downIn(list[i], order[k])) return DIRS[order[k]];
        }
      }
      return null;
    },

    on: function (name, fn) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
    },

    triggerConfirm: function () { emit('confirm'); },
    triggerPause: function () { emit('pause'); },

    reset: function () {
      for (var i = 0; i < CH.length; i++) {
        var c = CH[i];
        for (var k in c.key) c.key[k] = false;
        for (var v in c.virt) c.virt[v] = false;
        c.fireEdge = false;
      }
    }
  };

  g.Input = Input;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
