/**
 * lockstep.js - 帧同步内核（客户端用，无 DOM / 无网络依赖）
 *
 * 核心规则：
 *   1. 逻辑帧固定推进，每帧必须有「全体玩家」的输入才能往前走；
 *   2. 本地输入不立刻生效，而是写入 frame + buffer 帧（默认 3 帧 = 50ms），
 *      这样网络抖动在 50ms 内完全不影响帧率；
 *   3. 缺输入就停，超时由上层做 UI 提示（"等待对方…"），不黑屏卡死。
 *
 * 不做的事：不碰网络、不碰渲染、不认识游戏状态。step() 回调由上层提供，
 * 上层必须保证 step 是纯函数（同 state + 同 masks → 同结果）。
 */
(function (g) {
  'use strict';

  /**
   * @param {object} opt
   *   players       玩家人数（默认 2）
   *   localSlot     本地玩家槽位（0 或 1）
   *   startFrame    起始逻辑帧号（由服务器下发，双端一致）
   *   bufferFrames  输入提前量帧数（默认 3）
   *   timeoutMs     等输入超时（默认 200ms）
   *   maxCatchUp    单次 advance 最多补几帧（默认 8，防卡顿后追帧爆炸）
   */
  function LockStep(opt) {
    opt = opt || {};
    this.slots = opt.players || 2;
    this.local = opt.localSlot || 0;
    this.buffer = opt.bufferFrames === undefined ? 3 : opt.bufferFrames;
    this.timeoutMs = opt.timeoutMs === undefined ? 200 : opt.timeoutMs;
    this.maxCatchUp = opt.maxCatchUp || 8;

    this.frame = opt.startFrame || 0;   // 下一个待执行帧
    this.writeFrame = this.frame + this.buffer; // 下一个本地输入要写入的帧

    this.localInputs = Object.create(null);   // frame -> mask（尚未执行）
    this.remoteInputs = Object.create(null);  // frame -> { slot: mask }
    this.history = Object.create(null);       // frame -> mask（已执行，保留一段时间供重传）
    this.historyLimit = opt.historyLimit || 300;  // 保留 5 秒，够覆盖短时断网
    this.recent = [];                          // 最近 3 帧（{frame,mask}），网络层据此冗余发送

    this.advanced = 0;      // 已执行帧数
    this.received = 0;      // 收到的远端输入条数
    this.discarded = 0;     // 迟到帧（执行完才到，丢弃）
    this.stallSince = 0;    // 开始等待的时刻（ms），0 表示没在等
    this.maxStallMs = 0;    // 本次最长等待时长，调优用

    // 开局预填：起始的 buffer 帧视为「什么都没按」。
    // 不预填的话第 0 帧的本地输入要等到 frame+buffer 才产生，会一开始就死等。
    for (var i = 0; i < this.buffer; i++) {
      var pf = this.frame + i;
      this.localInputs[pf] = 0;
      this.recent.push({ frame: pf, mask: 0 });
    }
  }

  /**
   * 采样一次本地输入，写入「未来第 buffer 帧」。
   * 由主循环在每个逻辑帧（或每个渲染帧）调用一次。
   * @param {number} mask 位掩码（见 protocol.MASK）
   * @returns {{frame:number, mask:number}} 本次写入的帧
   */
  LockStep.prototype.pushLocal = function (mask) {
    var m = mask & 0xFF;

    // 追帧后缓冲会被消耗，这里必须**逐帧补齐**，绝不能直接把写指针跳到 frame+buffer。
    // 早期版本就是直接跳指针，结果中间几帧没有输入 → 两端永久停在那几帧（死锁）。
    // 补齐时用当前按键填充，等价于「卡顿期间玩家一直按着」，是合理的降级。
    var target = this.frame + this.buffer;
    while (this.writeFrame < target) {
      this.localInputs[this.writeFrame] = m;
      this.recent.push({ frame: this.writeFrame, mask: m });
      if (this.recent.length > 3) this.recent.shift();
      this.writeFrame++;
    }

    var f = this.writeFrame++;
    this.localInputs[f] = m;

    this.recent.push({ frame: f, mask: m });
    if (this.recent.length > 3) this.recent.shift();
    return { frame: f, mask: m };
  };

  /** 已执行帧不再接受，直接丢弃并计数（网络乱序时会发生） */
  LockStep.prototype.onRemoteInput = function (frame, slot, mask) {
    if (slot === this.local) return;          // 自己发的不用收
    if (frame < this.frame) { this.discarded++; return false; }

    var row = this.remoteInputs[frame];
    if (!row) { row = this.remoteInputs[frame] = Object.create(null); }
    if (row[slot] === undefined) this.received++;
    row[slot] = mask & 0xFF;
    return true;
  };

  /** 该帧是否已收齐所有玩家输入 */
  LockStep.prototype.ready = function (f) {
    if (this.localInputs[f] === undefined) return false;
    var row = this.remoteInputs[f];
    if (!row) return false;
    var need = this.slots - 1, got = 0;
    for (var s = 0; s < this.slots; s++) {
      if (s === this.local) continue;
      if (row[s] !== undefined) got++;
    }
    return got >= need;
  };

  /** 还差谁：返回缺失的槽位数组，UI 可显示"等待玩家 2" */
  LockStep.prototype.missing = function (f) {
    var out = [];
    for (var s = 0; s < this.slots; s++) {
      if (s === this.local) continue;
      var row = this.remoteInputs[f];
      if (!row || row[s] === undefined) out.push(s);
    }
    return out;
  };

  /**
   * 尽可能推进逻辑帧。
   * @param {function(number, number[])} stepFn (frame, masks按槽位顺序) => void
   * @returns {number} 本次推进了几帧
   */
  LockStep.prototype.advance = function (stepFn, maxFrames) {
    var limit = maxFrames === undefined ? this.maxCatchUp : maxFrames;
    var n = 0;
    while (n < limit && this.ready(this.frame)) {
      var f = this.frame;
      var masks = new Array(this.slots);
      for (var s = 0; s < this.slots; s++) {
        masks[s] = (s === this.local)
          ? this.localInputs[f]
          : this.remoteInputs[f][s];
      }
      stepFn(f, masks);

      // 已执行的本地输入不立即丢弃，转入 history：
      // 对方若因丢包还停在 f，需要能重传这一帧，否则会永久卡死。
      this.history[f] = this.localInputs[f];
      delete this.localInputs[f];
      delete this.remoteInputs[f];
      this.frame++;
      this.advanced++;
      n++;
    }
    if (n > 0) this.stallSince = 0;
    this.trimHistory();
    return n;
  };

  /** 清理过旧的历史，防止长时间对局内存无限增长 */
  LockStep.prototype.trimHistory = function () {
    var cut = this.frame - this.historyLimit;
    if (cut <= 0 || this.frame % 60 !== 0) return;
    for (var f in this.history) {
      if (+f < cut) delete this.history[f];
    }
  };

  /** 取某一帧的本地输入（未执行的取待执行表，已执行的取历史） */
  LockStep.prototype.localInput = function (f) {
    if (this.localInputs[f] !== undefined) return this.localInputs[f];
    if (this.history[f] !== undefined) return this.history[f];
    return undefined;
  };

  /** 本端已执行到最后一帧的帧号（-1 表示还没开始），随输入包上行，供对方裁剪重传范围 */
  LockStep.prototype.lastDone = function () { return this.frame - 1; };

  /**
   * 卡帧检测。返回 null 表示正常；返回帧号表示已等待超过 timeoutMs。
   * @param {number} nowMs 当前时刻（由调用方传 Date.now()，内核不自己取时间）
   */
  LockStep.prototype.checkStall = function (nowMs) {
    if (this.ready(this.frame)) {
      this.stallSince = 0;
      return null;
    }
    if (!this.stallSince) { this.stallSince = nowMs; return null; }
    var waited = nowMs - this.stallSince;
    if (waited > this.maxStallMs) this.maxStallMs = waited;
    return waited > this.timeoutMs ? this.frame : null;
  };

  /** 已收齐但还没执行的最远帧号（用于判断是否追帧） */
  LockStep.prototype.buffered = function () {
    var f = this.frame, n = 0;
    while (this.ready(f) && n < 600) { f++; n++; }
    return n;
  };

  g.LOCKSTEP = { LockStep: LockStep };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.LOCKSTEP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
