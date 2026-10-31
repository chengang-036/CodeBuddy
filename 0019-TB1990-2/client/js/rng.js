/**
 * rng.js - 逻辑层唯一随机源（种子化）
 *
 * 规则：game.js / level.js / entities.js 里**一处都不许**出现 Math.random()。
 * 只要漏一处，P2 联机时两端约 10~30 秒就会漂移（desync）。
 * 渲染层（ui.js 屏幕震动闪白之类）可以用 Math.random，因为它不影响逻辑状态。
 *
 * 用法：
 *   RNG.reseed(seed)        开局/重开时播种
 *   RNG.rand()              [0,1)
 *   RNG.range(a, b)         [a,b) 浮点
 *   RNG.int(a, b)           [a,b] 闭区间整数
 *   RNG.pick(arr)           随机取一个
 *   RNG.shuffle(arr)        原地洗牌（Fisher-Yates，可复现）
 *   RNG.mark(name)          打点：记录取数位置，排查 desync 用
 */
(function (g) {
  'use strict';

  var cur = null;
  var marks = [];

  /** 默认种子：未显式播种时用固定值，保证「不播种也确定性」而不是悄悄变随机 */
  var DEFAULT_SEED = 0x5A17BEEF;

  function ensure() {
    if (!cur) {
      cur = new g.PRNG.Rng(DEFAULT_SEED);
    }
    return cur;
  }

  var RNG = {
    DEFAULT_SEED: DEFAULT_SEED,

    /** 重新播种。同一 seed → 同一串数 */
    reseed: function (seed) {
      var s = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : DEFAULT_SEED;
      cur = new g.PRNG.Rng(s);
      marks.length = 0;
      return s;
    },

    /** 当前种子与已取数次数（P2 联机时随输入包上报，用于定位分叉点） */
    state: function () {
      var r = ensure();
      return { seed: r.seed, count: r.count };
    },

    rand: function () { return ensure().rand(); },
    range: function (a, b) { return ensure().range(a, b); },
    int: function (a, b) { return ensure().int(a, b); },
    pick: function (arr) { return ensure().pick(arr); },
    shuffle: function (arr) { return ensure().shuffle(arr); },

    /** 打点：把「此刻取了几个数」记下来，方便对比两端在哪一步开始不一致 */
    mark: function (name) {
      var r = ensure();
      marks.push({ name: name, count: r.count, at: Date.now() });
      if (marks.length > 64) marks.shift();
      return r.count;
    },
    marks: function () { return marks.slice(); }
  };

  g.RNG = RNG;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
