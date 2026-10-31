/**
 * protocol.js - 联机协议常量与编解码（客户端 / 服务器 / 模拟器共用）
 *
 * 设计原则：一帧输入只有 1 字节，网络开销压到最低。
 *   上行输入包 9 字节，下行帧广播 6+N 字节（2 人时 8 字节）。
 *   60Hz 下每人每秒上行 540 字节、下行 480 字节 —— 比一张小图片还小。
 */
(function (g) {
  'use strict';

  var MSG = {
    INPUT: 0x01,    // C→S 本帧输入
    FRAME: 0x02,    // S→C 该帧的全体输入
    HASH: 0x03,     // C→S 状态哈希
    CREATE: 0x10,   // C→S 建房
    JOIN: 0x11,     // C→S 加入
    START: 0x12,    // S→C 开局（seed + 起始帧）
    LEAVE: 0x13,    // 双向 离开
    DESYNC: 0x14,   // S→C 哈希不一致
    SNAPSHOT: 0x15, // 房主→对方 全量状态
    PING: 0x16,     // 双向 心跳/RTT 采样
    PONG: 0x17
  };

  /* 输入位掩码：一帧一个字节，5 个按键 */
  var BIT_UP = 1 << 0;
  var BIT_DOWN = 1 << 1;
  var BIT_LEFT = 1 << 2;
  var BIT_RIGHT = 1 << 3;
  var BIT_FIRE = 1 << 4;

  var MASK = {
    UP: BIT_UP, DOWN: BIT_DOWN, LEFT: BIT_LEFT,
    RIGHT: BIT_RIGHT, FIRE: BIT_FIRE,
    /** 四方向互斥检查用 */
    DIRS: BIT_UP | BIT_DOWN | BIT_LEFT | BIT_RIGHT
  };

  /** 从「当前按住状态」打包成位掩码 */
  function packMask(held) {
    var m = 0;
    if (held.up) m |= BIT_UP;
    if (held.down) m |= BIT_DOWN;
    if (held.left) m |= BIT_LEFT;
    if (held.right) m |= BIT_RIGHT;
    if (held.fire) m |= BIT_FIRE;
    return m & 0xFF;
  }

  function has(mask, bit) { return (mask & bit) !== 0; }

  /**
   * 上行输入包（9 字节）
   * [type][frame:u32le][mask:u8][ackFrame:u16le][seq:u8]
   */
  function encodeInput(frame, mask, ackFrame, seq) {
    var b = new Uint8Array(9);
    b[0] = MSG.INPUT;
    b[1] = frame & 0xFF; b[2] = (frame >>> 8) & 0xFF;
    b[3] = (frame >>> 16) & 0xFF; b[4] = (frame >>> 24) & 0xFF;
    b[5] = mask & 0xFF;
    b[6] = ackFrame & 0xFF; b[7] = (ackFrame >>> 8) & 0xFF;
    b[8] = seq & 0xFF;
    return b;
  }

  function decodeInput(b) {
    return {
      type: b[0],
      frame: (b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24)) >>> 0,
      mask: b[5] & 0xFF,
      ackFrame: b[6] | (b[7] << 8),
      seq: b[8] & 0xFF
    };
  }

  /**
   * 下行帧广播（6+N 字节）
   * [type][frame:u32le][n:u8][mask:u8 × n]
   */
  function encodeFrame(frame, masks) {
    var n = masks.length;
    var b = new Uint8Array(6 + n);
    b[0] = MSG.FRAME;
    b[1] = frame & 0xFF; b[2] = (frame >>> 8) & 0xFF;
    b[3] = (frame >>> 16) & 0xFF; b[4] = (frame >>> 24) & 0xFF;
    b[5] = n;
    for (var i = 0; i < n; i++) b[6 + i] = masks[i] & 0xFF;
    return b;
  }

  function decodeFrame(b) {
    var n = b[5];
    var masks = [];
    for (var i = 0; i < n; i++) masks.push(b[6 + i] & 0xFF);
    return {
      type: b[0],
      frame: (b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24)) >>> 0,
      masks: masks
    };
  }

  /** 4 位房间码（去掉易混淆的 0/O/1/I） */
  var CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  function randomCode(rng) {
    var s = '';
    for (var i = 0; i < 4; i++) s += CODE_CHARS[rng.int(0, CODE_CHARS.length - 1)];
    return s;
  }

  g.PROTOCOL = {
    MSG: MSG, MASK: MASK,
    packMask: packMask, has: has,
    encodeInput: encodeInput, decodeInput: decodeInput,
    encodeFrame: encodeFrame, decodeFrame: decodeFrame,
    randomCode: randomCode
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.PROTOCOL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
