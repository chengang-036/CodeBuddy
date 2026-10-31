/**
 * audio.js - 音效（WebAudio 实时合成，零音频文件）
 * 移动端/小游戏均需在用户手势后 unlock 才能出声。
 */
(function (g) {
  'use strict';
  var P = g.Platform;
  var ctx = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      ctx = P.createAudioContext();
      if (ctx) {
        master = ctx.createGain();
        master.gain.value = 0.45;
        if (master.connect) master.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function envelope(node, dur, peak) {
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    node.connect(gn);
    if (gn.connect) gn.connect(master);
    return gn;
  }

  function tone(type, f0, f1, dur, peak, delay) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gn); if (gn.connect) gn.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, peak, cutoff, delay) {
    if (!ensure() || muted) return;
    if (!noiseBuf) {
      var len = Math.floor(ctx.sampleRate * 0.7);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = ctx.currentTime + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(cutoff || 1200, t0);
    flt.frequency.exponentialRampToValueAtTime(180, t0 + dur);
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(peak, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(gn); if (gn.connect) gn.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  var SFX = {
    shoot: function () { tone('square', 520, 240, 0.07, 0.10); },
    shootFast: function () { tone('square', 700, 300, 0.06, 0.10); },
    hitBrick: function () { noise(0.06, 0.14, 2200); },
    hitSteel: function () { tone('square', 900, 600, 0.05, 0.08); },
    hitTank: function () { tone('square', 300, 160, 0.06, 0.10); },
    explodeSmall: function () { noise(0.22, 0.22, 1400); },
    explodeBig: function () { noise(0.55, 0.32, 1800); tone('sawtooth', 160, 40, 0.5, 0.10); },
    powerup: function () {
      tone('square', 520, 520, 0.08, 0.11, 0);
      tone('square', 700, 700, 0.08, 0.11, 0.08);
      tone('square', 980, 980, 0.14, 0.12, 0.16);
    },
    powerupDrop: function () { tone('square', 880, 1200, 0.10, 0.10); },
    appear: function () { tone('triangle', 300, 700, 0.18, 0.08); },
    stage: function () {
      tone('square', 420, 420, 0.12, 0.12, 0);
      tone('square', 620, 620, 0.18, 0.12, 0.14);
    },
    life: function () {
      tone('square', 660, 660, 0.10, 0.12, 0);
      tone('square', 880, 880, 0.16, 0.12, 0.10);
    },
    gameover: function () {
      tone('sawtooth', 300, 90, 0.7, 0.16);
      tone('sawtooth', 220, 60, 0.9, 0.13, 0.35);
    },
    victory: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone('square', f, f, 0.18, 0.12, i * 0.14);
      });
    },
    freeze: function () { tone('triangle', 1200, 400, 0.4, 0.10); },
    shovel: function () { tone('square', 300, 900, 0.25, 0.10); }
  };

  var Audio = {
    unlock: function () { ensure(); },
    play: function (name) {
      if (muted) return;
      var f = SFX[name];
      if (f && ensure()) { try { f(); } catch (e) { /* 音频不可用则静默 */ } }
    },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    toggle: function () { muted = !muted; return muted; }
  };

  g.Sfx = Audio;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
