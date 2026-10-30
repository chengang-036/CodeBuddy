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

  /* ============ 坦克基础矩阵（16x16，朝上；履带两帧） ============ */
  var T0 = [
    '.......KK.......',
    '.......KK.......',
    '.......KK.......',
    '......KAAK......',
    '.....KABBAK.....',
    '.....KABBAK.....',
    '....KABBBBAK....',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK'
  ];
  var T1 = [
    '.......KK.......',
    '.......KK.......',
    '.......KK.......',
    '......KAAK......',
    '.....KABBAK.....',
    '.....KABBAK.....',
    '....KABBBBAK....',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC',
    'KKKABBBBBBBBAKKK',
    'CKCABBBBBBBBACKC'
  ];

  var K = '#141418';
  var PALETTES = {
    p1: { K: K, A: '#ffe066', B: '#f0a800', C: '#b06c00' },
    p2: { K: K, A: '#ffffff', B: '#e8c860', C: '#9a7a10' },
    p3: { K: K, A: '#fff3b0', B: '#ff8800', C: '#c03c00' },
    basic: { K: K, A: '#e6e8ea', B: '#98a0a8', C: '#5a6169' },
    fast: { K: K, A: '#dff2ff', B: '#84aecb', C: '#41617a' },
    power: { K: K, A: '#f6e2ff', B: '#a184cf', C: '#5b3f84' },
    armor4: { K: K, A: '#c8f5a8', B: '#52b84e', C: '#1f6b1c' },
    armor3: { K: K, A: '#ffe9a8', B: '#dfae3c', C: '#7d5a10' },
    armor2: { K: K, A: '#ffc4a0', B: '#dd6c3c', C: '#7c3010' },
    armor1: { K: K, A: '#f2f2f2', B: '#9e9e9e', C: '#5c5c5c' }
  };

  /** 生成一套坦克：{ UP:[f0,f1], RIGHT:[...], DOWN:[...], LEFT:[...] } */
  function tankSet(pal) {
    var a = fromMatrix(T0, pal, 2), b = fromMatrix(T1, pal, 2);
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
    var m = (type === 'tank') ? T0 : ICONS[type];
    var pal = (type === 'tank') ? PALETTES.p1 : ICON_PAL[type];
    var icon = fromMatrix(m, pal, 1);
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

  /** 小坦克图标（信息栏：剩余敌人 / 玩家生命） */
  function tankIcon(pal) { return fromMatrix(T0, pal, 1); }

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
      ['p1', 'p2', 'p3', 'basic', 'fast', 'power', 'armor4', 'armor3', 'armor2', 'armor1']
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
      return this;
    }
  };

  g.Sprites = Sprites;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
