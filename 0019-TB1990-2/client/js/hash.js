/**
 * hash.js - 状态哈希（FNV-1a 32 位）
 *
 * 用途：每 60 帧（1 秒）对全场可变状态算一次哈希，双方比对。
 * 不一致就说明发生了 desync，立刻报警并触发全量快照重同步。
 *
 * 为什么用 FNV-1a：纯整数运算、无依赖、跨平台一致、够快（微秒级）。
 * 不是密码学哈希，也不需要——只要能发现差异即可。
 *
 * 使用约定（很重要）：
 *   1. 字段顺序必须固定，不能依赖对象 key 遍历顺序；
 *   2. 浮点先转定点整数（Math.round(v * 16)）再入哈希，避免 ULP 差异；
 *   3. 数组按索引顺序入，不排序。
 */
(function (g) {
  'use strict';

  var FNV_OFFSET = 0x811C9DC5;
  var FNV_PRIME = 0x01000193;

  function Hash() {
    this.h = FNV_OFFSET >>> 0;
    this.n = 0;
  }

  /** 混入一个 32 位整数 */
  Hash.prototype.int = function (v) {
    var x = (v | 0) >>> 0;
    // 4 字节逐个混入，避免高位丢失导致的碰撞
    for (var i = 0; i < 4; i++) {
      this.h ^= (x >>> (i * 8)) & 0xFF;
      this.h = Math.imul(this.h, FNV_PRIME) >>> 0;
    }
    this.n++;
    return this;
  };

  /** 浮点转定点后混入（1px = 16 单位，精度足够且完全可复现） */
  Hash.prototype.fixed = function (v) {
    return this.int(Math.round(v * 16));
  };

  /** 布尔 */
  Hash.prototype.bool = function (b) { return this.int(b ? 1 : 0); };

  /** 字符串（逐字符码点） */
  Hash.prototype.str = function (s) {
    for (var i = 0; i < s.length; i++) this.int(s.charCodeAt(i));
    return this;
  };

  /** 取结果：8 位十六进制字符串 */
  Hash.prototype.value = function () {
    return ('0000000' + (this.h >>> 0).toString(16)).slice(-8);
  };

  g.HASH = { Hash: Hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.HASH;
})(typeof globalThis !== 'undefined' ? globalThis : this);
