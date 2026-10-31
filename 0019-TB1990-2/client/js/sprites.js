/**
 * sprites.js - 像素素材生成（程序化绘制，网页版与微信小游戏共用同一份）
 * 说明：不用外部图片，运行时用离屏 canvas 生成，保证包体小、两端一致、无加载等待。
 */
(function (g) {
  'use strict';
  var P = g.Platform, CFG = g.CFG;

  function mk(w, h) {
    var c = P.createCanvas(w, h);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c: c, x: x };
  }

  /** 字符矩阵 -> canvas（缺失字符按透明处理，容错行长度不齐） */
  function fromMatrix(matrix, palette, scale) {
    scale = scale || 1;
    var h = matrix.length, w = 0, i, j;
    for (i = 0; i < h; i++) w = Math.max(w, matrix[i].length);
    var o = mk(w * scale, h * scale);
    for (var y = 0; y < h; y++) {
      var row = matrix[y];
      for (var x = 0; x < w; x++) {
        var ch = row.charAt(x) || '.';
        var col = palette[ch];
        if (!col) continue;
        o.x.fillStyle = col;
        o.x.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return o.c;
  }

  function rotate(src, angle) {
    var w = src.width, h = src.height;
    var swap = (angle === 90 || angle === 270);
    var o = mk(swap ? h : w, swap ? w : h);
    o.x.save();
    o.x.translate(o.c.width / 2, o.c.height / 2);
    o.x.rotate(angle * Math.PI / 180);
    o.x.drawImage(src, -w / 2, -h / 2);
    o.x.restore();
    return o.c;
  }

  /* ============ 坦克（原生 32x32 绘制，1 像素 = 1 画布像素） ============
   * 之前是 16x16 设计再放大 2 倍，等于把像素放大成 2x2 色块，细节被砍半，
   * 在 32px 的实际显示尺寸下读不出结构。改为直接按 32x32 设计，与场景砖块
   * 的像素密度一致。结构（俯视，朝上）：
   *   履带  x0..5 / x26..31，整长，带连接销
   *   车体  x5..26，前装甲更亮
   *   炮塔  x9..22 居中，带舱盖
   *   炮管  x13..18，从炮塔前部伸出
   * 绘制顺序：履带 → 车体 → 炮塔 → 炮管（后画的压住先画的，形成"插座"而不是断开）
   */
  function tankSprite(pal, frame, scale) {
    scale = scale || 1;
    var S = scale, W = 32, H = 32;
    var o = mk(W * S, H * S), x = o.x;
    x.imageSmoothingEnabled = false;

    var K = pal.K, LIGHT = pal.A, MID = pal.B, DARK = pal.C;

    function rect(gx, gy, gw, gh, col) {
      x.fillStyle = col;
      x.fillRect(gx * S, gy * S, gw * S, gh * S);
    }

    /* --- 1. 外轮廓：按实际形状分三块画黑底（不能整块 32x24，否则顶部会多出一条黑带） --- */
    rect(0, 9, 7, 23, K);            // 左履带外轮廓 x0..6, y9..31
    rect(25, 9, 7, 23, K);           // 右履带外轮廓 x25..31
    rect(6, 9, 20, 23, K);           // 车体外轮廓 x6..25

    /* --- 2. 履带：各 5px 宽。连接销用"浅一档的灰"而不是纯黑，
     * 否则一节节的履带会被看成贴在车边的砖块。 --- */
    var TREAD = '#4d525b', TREAD_PIN = '#2c3037';
    rect(1, 10, 5, 21, TREAD);       // x1..5, y10..30
    rect(26, 10, 5, 21, TREAD);      // x26..30
    for (var ly = 12 + (frame ? 2 : 0); ly < 30; ly += 4) {
      rect(1, ly, 5, 2, TREAD_PIN);
      rect(26, ly, 5, 2, TREAD_PIN);
    }

    /* --- 3. 车体：直角即可（斜切在小尺寸下会变成一圈锯齿），只用左右内阴影做体积 --- */
    rect(7, 10, 18, 21, MID);        // x7..24, y10..30
    rect(7, 10, 1, 21, DARK);        // 左侧内阴影
    rect(24, 10, 1, 21, DARK);       // 右侧内阴影
    rect(7, 28, 18, 3, DARK);        // 尾部阴影

    /* --- 4. 炮管：先画，让炮塔压住它的根部（否则黑描边会穿过炮塔，把它劈成两半） --- */
    rect(13, 0, 6, 15, K);           // 外描边 x13..18, y0..14
    rect(14, 1, 4, 14, LIGHT);       // 管身
    rect(14, 1, 4, 2, '#ffffff');    // 炮口高光

    /* --- 5. 炮塔：最后画。宽 12 高 8，左右和下方各压 1px 暗色，
     * 让它读成"凸起的炮塔环"，而不是车体上的一块亮斑 --- */
    rect(10, 14, 12, 8, LIGHT);      // x10..21, y14..21
    rect(9, 14, 1, 9, DARK);         // 左沿
    rect(22, 14, 1, 9, DARK);        // 右沿
    rect(10, 22, 12, 1, DARK);       // 下沿
    rect(14, 17, 4, 3, MID);         // 舱盖（不要加"接缝点"，两个亮点会读成一张脸）
    return o.c;
  }

  var K = '#141418';
  var PALETTES = {
    // 玩家 1（黄）三级
    p1: { K: K, A: '#ffe066', B: '#f0a800', C: '#8a5c00' },
    p2: { K: K, A: '#f2f2f2', B: '#c8ccd4', C: '#6a7078' },
    p3: { K: K, A: '#fff3b0', B: '#ff8800', C: '#8f3a00' },
    // 玩家 2（绿）三级 —— 双人同屏时必须一眼分清，所以整条色相都换掉，不是只调亮度
    q1: { K: K, A: '#7ef08a', B: '#2fa84f', C: '#135c2c' },
    q2: { K: K, A: '#c2ffc8', B: '#48c46a', C: '#18652f' },
    q3: { K: K, A: '#e6ffe0', B: '#3fbf63', C: '#15592b' },
    basic: { K: K, A: '#e6e8ea', B: '#98a0a8', C: '#4a5058' },
    fast: { K: K, A: '#dff2ff', B: '#84aecb', C: '#2f4a5e' },
    power: { K: K, A: '#f6e2ff', B: '#a184cf', C: '#4a3068' },
    // 装甲兵按剩余血量变色：4 血用青色而不是绿色 —— 绿色留给 P2，
    // 否则双人同屏时队友和 4 血装甲兵在混战里根本分不清。
    armor4: { K: K, A: '#b8f6ff', B: '#3aa8c0', C: '#114a56' },
    armor3: { K: K, A: '#ffe9a8', B: '#dfae3c', C: '#6b4a08' },
    armor2: { K: K, A: '#ffc4a0', B: '#dd6c3c', C: '#6a2408' },
    armor1: { K: K, A: '#f2f2f2', B: '#9e9e9e', C: '#4e4e4e' }
  };

  /** 生成一套坦克：{ UP:[f0,f1], RIGHT:[...], DOWN:[...], LEFT:[...] } */
  function tankSet(pal) {
    var a = tankSprite(pal, 0, 1), b = tankSprite(pal, 1, 1);
    return {
      UP: [a, b],
      RIGHT: [rotate(a, 90), rotate(b, 90)],
      DOWN: [rotate(a, 180), rotate(b, 180)],
      LEFT: [rotate(a, 270), rotate(b, 270)]
    };
  }

  /* ============ 地形贴图（16x16 小格） ============ */
  function brickTile() {
    var o = mk(16, 16), x = o.x;
    x.fillStyle = '#6b2f14'; x.fillRect(0, 0, 16, 16);
    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 2; col++) {
        var ox = col * 8 + (row % 2 ? -4 : 0);
        x.fillStyle = '#b9552a';
        x.fillRect(ox + 1, row * 8 + 1, 7, 6);
        x.fillStyle = '#d8703c';
        x.fillRect(ox + 1, row * 8 + 1, 7, 1);
      }
    }
    return o.c;
  }

  function steelTile() {
    var o = mk(16, 16), x = o.x;
    x.fillStyle = '#9aa0a6'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#c8ced4'; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16);
    x.fillStyle = '#5f646a'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16);
    x.fillStyle = '#6b7076';
    [[4, 4], [11, 4], [4, 11], [11, 11]].forEach(function (p) {
      x.fillRect(p[0], p[1], 2, 2);
    });
    return o.c;
  }

  function waterTile(frame) {
    var o = mk(16, 16), x = o.x;
    x.fillStyle = '#1f4fb0'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#4a86e8';
    var off = frame ? 1 : 0;
    for (var i = 0; i < 3; i++) {
      var y = 2 + i * 5 + off;
      x.fillRect(1, y, 5, 2);
      x.fillRect(9, y + 2, 6, 2);
    }
    x.fillStyle = '#8fc0ff';
    x.fillRect(2, 6 + off, 3, 1);
    return o.c;
  }

  function iceTile() {
    var o = mk(16, 16), x = o.x;
    x.fillStyle = '#bfe6f5'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#eafaff';
    x.fillRect(0, 0, 16, 2); x.fillRect(2, 4, 6, 2); x.fillRect(9, 8, 5, 2);
    x.fillStyle = '#86bdd6';
    x.fillRect(0, 14, 16, 2); x.fillRect(11, 2, 2, 4);
    return o.c;
  }

  /** 草地（32x32，砖块级，绘制在坦克之上做遮挡） */
  function grassTile() {
    var o = mk(32, 32), x = o.x;
    var rnd = 0.7;
    function r() { rnd = (rnd * 9301 + 49297) % 233280 / 233280; return rnd; }
    for (var i = 0; i < 26; i++) {
      var cx = 3 + Math.floor(r() * 26), cy = 4 + Math.floor(r() * 24);
      var rad = 3 + Math.floor(r() * 4);
      x.fillStyle = i % 3 === 0 ? '#2f9e44' : (i % 3 === 1 ? '#37b24d' : '#1e7a33');
      x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#0f3d1c';
    x.fillRect(0, 0, 32, 2); x.fillRect(0, 30, 32, 2);
    x.fillRect(0, 0, 2, 32); x.fillRect(30, 0, 2, 32);
    return o.c;
  }

  /* ============ 基地（老鹰） ============ */
  var EAGLE_M = [
    '................',
    '.....KKKKKK.....',
    '....KWWWWWWK....',
    '...KWWWWWWWWK...',
    '...KWKKWWKKWK...',
    '...KWWWWWWWWK...',
    '....KWYYYYWK....',
    '.....KYKKYK.....',
    '....KKWWWWKK....',
    '...KWWWWWWWWK...',
    '..KWWWWWWWWWWK..',
    '..KWKKWWWWKKWK..',
    '..KWWWWWWWWWWK..',
    '...KKWWWWWWKK...',
    '.....KKKKKK.....',
    '................'
  ];
  var EAGLE_PAL = { K: K, W: '#f2f2f2', Y: '#ffd24a' };
  var EAGLE_DEAD_PAL = { K: '#2a2a2a', W: '#7a7a7a', Y: '#5a5a5a' };

  /* ============ 道具图标 ============ */
  var ICONS = {
    star: [
      '.......KK.......',
      '......KYYK......',
      '......KYYK......',
      '.....KYYYYK.....',
      'KKKKKYYYYYYKKKKK',
      '.KYYYYYYYYYYYYK.',
      '..KYYYYYYYYYYK..',
      '..KYYYYYYYYYYK..',
      '...KYYYYYYYYK...',
      '..KYYYYYYYYYYK..',
      '..KYYYKKKKYYYK..',
      '.KYYYK....KYYYK.',
      '.KYK........KYK.',
      '.KKK........KKK.',
      '................',
      '................'
    ],
    helmet: [
      '.....KKKKKK.....',
      '...KKWWWWWWKK...',
      '..KWWWWWWWWWWK..',
      '.KWWWWWWWWWWWWK.',
      '.KWWWWWWWWWWWWK.',
      '.KWKKWWWWWWKKWK.',
      '.KWWWWWWWWWWWWK.',
      '.KWWWWWWWWWWWWK.',
      '.KKWWWWWWWWWWKK.',
      '..KKKWWWWWWKKK..',
      '....KKKKKKKK....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ],
    bomb: [
      '............KK..',
      '...........KYK..',
      '..........KKK...',
      '........KKKKK...',
      '......KKWWWKK...',
      '....KKWWKKKKK...',
      '...KWKKKKKKKKK..',
      '...KWKKKKKKKKK..',
      '..KWKKKKKKKKKKK.',
      '..KWKKKKKKKKKKK.',
      '..KWKKKKKKKKKKK.',
      '...KKKKKKKKKKKK.',
      '...KKKKKKKKKKKK.',
      '....KKKKKKKKKK..',
      '.....KKKKKKKK...',
      '......KKKKKK....'
    ],
    shovel: [
      '......KKKK......',
      '......KWWK......',
      '......KWWK......',
      '......KWWK......',
      '.....KKWWKK.....',
      '....KWWWWWWK....',
      '...KWWWWWWWWK...',
      '...KWWWWWWWWK...',
      '...KWWWWWWWWK...',
      '....KWWWWWWK....',
      '.....KWWWWK.....',
      '......KWWK......',
      '......KWWK......',
      '......KKKK......',
      '................',
      '................'
    ],
    clock: [
      '.....KKKKKK.....',
      '...KKWWWWWWKK...',
      '..KWWWWWWWWWWK..',
      '.KWWWWWWKKWWWWK.',
      '.KWWWWWKKKWWWWK.',
      '.KWWWWWKKKWWWWK.',
      '.KWWWWWKKKWWWWK.',
      '.KWWWWWWKKWWWWK.',
      '.KWWWWWWWWWWWWK.',
      '.KWWWWWWWWWWWWK.',
      '..KWWWWWWWWWWK..',
      '...KKWWWWWWKK...',
      '.....KKKKKK.....',
      '................',
      '................',
      '................'
    ]
  };
  var ICON_PAL = {
    star: { K: K, Y: '#ffd24a' },
    helmet: { K: K, W: '#dfe6ec' },
    bomb: { K: K, W: '#ffffff', Y: '#ffb020' },
    shovel: { K: K, W: '#c8cdd4' },
    clock: { K: K, W: '#ffffff' }
  };

  /** 道具：32x32（白框 + 居中图标） */
  function powerupTile(type) {
    var o = mk(32, 32), x = o.x;
    x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 32, 32);
    x.fillStyle = '#101014'; x.fillRect(2, 2, 28, 28);
    var m = (type === 'tank') ? null : ICONS[type];
    var pal = (type === 'tank') ? PALETTES.p1 : ICON_PAL[type];
    var icon = (type === 'tank') ? tankSprite(PALETTES.p1, 0, 1) : fromMatrix(m, pal, 1);
    x.drawImage(icon, 8, 8, 16, 16);
    return o.c;
  }

  /* ============ 爆炸（程序化像素圆盘，3 个尺寸） ============ */
  function explosion(size, seed) {
    var o = mk(size, size), x = o.x;
    var cx = size / 2, cy = size / 2, r = size / 2;
    var s = seed;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000; }
    for (var y = 0; y < size; y++) {
      for (var px = 0; px < size; px++) {
        var dx = px - cx + 0.5, dy = y - cy + 0.5;
        var d = Math.sqrt(dx * dx + dy * dy) / r;
        var jit = (rnd() - 0.5) * 0.28;
        if (d + jit < 0.42) x.fillStyle = '#fff6c0';
        else if (d + jit < 0.68) x.fillStyle = '#ffc02a';
        else if (d + jit < 0.92) x.fillStyle = '#ff6a18';
        else if (d + jit < 1.0) x.fillStyle = '#8a2c08';
        else continue;
        x.fillRect(px, y, 1, 1);
      }
    }
    return o.c;
  }

  /** 出现星闪（敌人生成动画，4 帧） */
  function spawnStar(frame) {
    var o = mk(32, 32), x = o.x;
    var n = [1, 2, 3, 2][frame];
    x.fillStyle = frame % 2 ? '#ffffff' : '#ffe066';
    var s = n * 2;
    for (var i = 0; i < 32; i += 1) {
      // 十字光芒
      var half = Math.max(0, Math.round((16 - Math.abs(i - 16)) * (n / 3) * 0.9));
      if (half > 0) x.fillRect(16 - half, i, half * 2, 1);
      var half2 = Math.max(0, Math.round((16 - Math.abs(i - 16)) * (n / 3) * 0.45));
      if (half2 > 0) x.fillRect(i, 16 - half2, 1, half2 * 2);
    }
    x.fillStyle = '#fff';
    x.fillRect(16 - s / 2, 16 - s / 2, s, s);
    return o.c;
  }

  /** 旗帜图标（关卡显示） */
  function flagIcon() {
    var o = mk(16, 16), x = o.x;
    x.fillStyle = '#d8d8d8'; x.fillRect(3, 1, 2, 14);
    x.fillStyle = '#e0453a';
    x.beginPath(); x.moveTo(5, 2); x.lineTo(14, 5); x.lineTo(5, 8); x.closePath(); x.fill();
    x.fillStyle = K; x.fillRect(1, 14, 7, 2);
    return o.c;
  }

  /** 小坦克图标（信息栏：剩余敌人 / 玩家生命）—— 32px 原图缩到 16px */
  function tankIcon(pal) {
    var big = tankSprite(pal, 0, 1);
    var o = mk(16, 16);
    o.x.imageSmoothingEnabled = false;
    o.x.drawImage(big, 0, 0, 16, 16);
    return o.c;
  }

  var Sprites = {
    tank: {},
    terrain: {},
    powerup: {},
    explode: [],
    star: [],
    eagle: null,
    eagleDead: null,
    flag: null,
    icon: {},

    init: function () {
      var self = this;
      ['p1', 'p2', 'p3', 'q1', 'q2', 'q3', 'basic', 'fast', 'power', 'armor4', 'armor3', 'armor2', 'armor1']
        .forEach(function (k) { self.tank[k] = tankSet(PALETTES[k]); });

      this.terrain.brick = brickTile();
      this.terrain.steel = steelTile();
      this.terrain.water = [waterTile(0), waterTile(1)];
      this.terrain.ice = iceTile();
      this.terrain.grass = grassTile();

      this.eagle = fromMatrix(EAGLE_M, EAGLE_PAL, 2);
      this.eagleDead = fromMatrix(EAGLE_M, EAGLE_DEAD_PAL, 2);

      ['star', 'helmet', 'tank', 'bomb', 'shovel', 'clock'].forEach(function (k) {
        self.powerup[k] = powerupTile(k);
      });

      this.explode = [explosion(16, 7), explosion(24, 23), explosion(32, 91), explosion(40, 51)];
      for (var i = 0; i < 4; i++) this.star.push(spawnStar(i));

      this.flag = flagIcon();
      this.icon.enemy = tankIcon(PALETTES.basic);
      this.icon.player = tankIcon(PALETTES.p1);
      this.icon.player2 = tankIcon(PALETTES.q1);
      return this;
    }
  };

  g.Sprites = Sprites;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
