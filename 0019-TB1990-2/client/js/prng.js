/**
 * prng.js - 种子化伪随机数（帧同步的确定性前提）
 *
 * 为什么必须换掉 Math.random：
 *   帧同步要求两端「同样输入 → 同样结果」。Math.random 每台机器的序列完全不同，
 *   敌人转向、开火冷却、道具掉落只要有一处用它，两端约 10~30 秒就会漂移（desync）。
 *
 * 用 mulberry32：32 位状态、纯整数运算（Math.imul），跨浏览器/跨 Node 结果一致，
 * 不依赖浮点三角函数，不存在 ULP 差异问题。
 */
(function (g) {
  'use strict';

  /**
   * 创建一个随机源。同一个 seed 必然产生同一串数。
   * @param {number} seed 32 位无符号整数（由房主生成，随开局下发）
   * @returns {function(): number} 返回 [0,1) 的浮点数
   */
  function make(seed) {
    var a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 封装成带常用方法的对象，同时保留 rand() 原函数 */
  function Rng(seed) {
    this.seed = seed >>> 0;
    this.next = make(this.seed);
    this.count = 0;          // 已取值次数，调试 desync 时非常有用
  }

  /** [0,1) */
  Rng.prototype.rand = function () { this.count++; return this.next(); };

  /** [min,max] 闭区间整数 */
  Rng.prototype.int = function (min, max) {
    return min + Math.floor(this.rand() * (max - min + 1));
  };

  /** [min,max) 浮点 */
  Rng.prototype.range = function (min, max) {
    return min + this.rand() * (max - min);
  };

  /** 数组随机取一个（空数组返回 undefined） */
  Rng.prototype.pick = function (arr) {
    if (!arr || !arr.length) return undefined;
    return arr[this.int(0, arr.length - 1)];
  };

  /** 按概率命中 */
  Rng.prototype.chance = function (p) { return this.rand() < p; };

  /** 原地洗牌（Fisher-Yates，用自建随机源保证可复现） */
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = this.int(0, i);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /** 当前内部计数，用于排查「究竟哪一步开始不一致」 */
  Rng.prototype.snapshot = function () { return { seed: this.seed, count: this.count }; };

  g.PRNG = { make: make, Rng: Rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.PRNG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
