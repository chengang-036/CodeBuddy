/**
 * netinput.js - 联机输入源（把「网络帧掩码」伪装成 Input 接口）
 *
 * game.js 只认 pickDir / isDown / consumeFire 三个方法。
 * 联机时把它塞给 game.inputSource，玩法代码一行都不用改。
 *
 * 掩码位定义见 protocol.js：UP/DOWN/LEFT/RIGHT/FIRE 各 1 位。
 */
(function (g) {
  'use strict';

  function create(proto) {
    var P = proto || g.PROTOCOL;
    return {
      masks: [0, 0],

      setMasks: function (m) { this.masks = m || [0, 0]; },

      /** 方向优先级必须与 Input.pickDir 一致：上 下 左 右 */
      pickDir: function (pid) {
        var m = this.masks[pid] || 0;
        if (m & P.MASK.UP) return 'UP';
        if (m & P.MASK.DOWN) return 'DOWN';
        if (m & P.MASK.LEFT) return 'LEFT';
        if (m & P.MASK.RIGHT) return 'RIGHT';
        return null;
      },

      isDown: function (act, pid) {
        var m = this.masks[pid] || 0;
        if (act === 'fire') return !!(m & P.MASK.FIRE);
        var k = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' }[act];
        return k ? !!(m & P.MASK[k]) : false;
      },

      /** 掩码本身就是「按住」语义，没有边沿概念；连发靠 isDown */
      consumeFire: function () { return false; }
    };
  }

  g.NetInput = { create: create };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
