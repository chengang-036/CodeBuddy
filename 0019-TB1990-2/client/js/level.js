/**
 * level.js - 关卡数据与解析
 * 关卡用 13x13 砖块字符网格描述：
 *   . 空  B 砖  S 钢  W 水  I 冰  G 草（覆盖层）
 * 解析为 26x26 小格地形（砖块 = 2x2 小格）+ 13x13 草地覆盖层。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG;
  var T = CFG.T_EMPTY, BRICK = CFG.T_BRICK, STEEL = CFG.T_STEEL, WATER = CFG.T_WATER, ICE = CFG.T_ICE;

  var LEVELS = [
    // 1 入门：砖块阵
    [
      '.............',
      '..BB.BBB.BB..',
      '..BB.BBB.BB..',
      '.............',
      '.BB.BB.BB.BB.',
      '.BB.BB.BB.BB.',
      '.............',
      'BB.BB...BB.BB',
      'BB.BB...BB.BB',
      '.............',
      '.............',
      '.............',
      '.............'
    ],
    // 2 钢铁
    [
      '.............',
      '.SS.BBBBB.SS.',
      '.BB.B...B.BB.',
      '.....B.B.....',
      'BB.BB.B.BB.BB',
      'BB.BB...BB.BB',
      '.....B.B.....',
      'BB.BB.B.BB.BB',
      'BB.BB...BB.BB',
      '.............',
      '..B.......B..',
      '.............',
      '.............'
    ],
    // 3 河流
    [
      '.............',
      '.BB.......BB.',
      '.BB.WWWWW.BB.',
      '....WWWWW....',
      'BB..WWWWW..BB',
      'BB.........BB',
      '..BB.BBB.BB..',
      '..BB.BBB.BB..',
      '.............',
      '.BB.BBBBB.BB.',
      '.BB.......BB.',
      '.............',
      '.............'
    ],
    // 4 丛林（草地遮挡）
    [
      '.............',
      '.BB.BBBBB.BB.',
      '.BB.B...B.BB.',
      '...GG...GG...',
      'BB.GG...GG.BB',
      'BB.........BB',
      '..BB.BBB.BB..',
      '..BB.B.B.BB..',
      '...GG...GG...',
      '.BB.GGGGG.BB.',
      '.BB.......BB.',
      '.............',
      '.............'
    ],
    // 5 冰面
    [
      '.............',
      '..IIIIIIIII..',
      '..BB.BBB.BB..',
      '..BB.BBB.BB..',
      '.II.......II.',
      '.BB.BBBBB.BB.',
      '.BB.B...B.BB.',
      '.BB.BBBBB.BB.',
      '.II.......II.',
      '..BB.BBB.BB..',
      '..IIIIIIIII..',
      '.............',
      '.............'
    ],
    // 6 综合
    [
      '.............',
      '.SS.BB.BB.SS.',
      '.BB.BB.BB.BB.',
      '..W.......W..',
      'BB.BB.B.BB.BB',
      'BB.BB.S.BB.BB',
      '..W.......W..',
      'BB.BB.B.BB.BB',
      'BB.BB...BB.BB',
      '....GG.GG....',
      '.BB.G...G.BB.',
      '.............',
      '.............'
    ],
    // 7 要塞
    [
      '.............',
      '.GG.......GG.',
      '.BB.SSSSS.BB.',
      '...S.....S...',
      'BB.S.BBB.S.BB',
      'BB...BBB...BB',
      '...S.BBB.S...',
      'BB.S.....S.BB',
      'BB.SS...SS.BB',
      '.....B.B.....',
      '.BB..B.B..BB.',
      '.............',
      '.............'
    ],
    // 8 水道
    [
      '.............',
      '.BB.B...B.BB.',
      '.BB.W...W.BB.',
      '..W..BBB..W..',
      'BB.W.BBB.W.BB',
      'BB....S....BB',
      'BB.W.BBB.W.BB',
      '..W..BBB..W..',
      '.BB.W...W.BB.',
      '.BB.B...B.BB.',
      '..GG.....GG..',
      '.............',
      '.............'
    ],
    // 9 冰川要塞
    [
      '.............',
      '.II.BBBBB.II.',
      '.BB.B...B.BB.',
      '....B.S.B....',
      'BB.BB.S.BB.BB',
      'BB.BB...BB.BB',
      '....B.S.B....',
      '.BB.B...B.BB.',
      '.II.BBBBB.II.',
      '..BB.....BB..',
      '..W.......W..',
      '.............',
      '.............'
    ],
    // 10 终局
    [
      '.............',
      '.SS.BBBBB.SS.',
      '.BB.S...S.BB.',
      '..W..BBB..W..',
      'BB.B.BBB.B.BB',
      'BB...BBB...BB',
      'BB.B.BBB.B.BB',
      '..W..BBB..W..',
      '.BB.S...S.BB.',
      '.SS.BBBBB.SS.',
      '..GG.....GG..',
      '.............',
      '.............'
    ]
  ];

  function charToTile(ch) {
    switch (ch) {
      case 'B': return BRICK;
      case 'S': return STEEL;
      case 'W': return WATER;
      case 'I': return ICE;
      default: return T;
    }
  }

  /** 解析关卡 -> { grid: 26x26, grass: 13x13 } */
  function parse(levelIndex) {
    var data = LEVELS[(levelIndex - 1) % LEVELS.length];
    var grid = [], grass = [], r, c, i;
    for (r = 0; r < CFG.GRID; r++) { grid.push(new Array(CFG.GRID)); }
    for (r = 0; r < 13; r++) { grass.push(new Array(13)); }

    for (r = 0; r < 13; r++) {
      var row = data[r] || '';
      for (c = 0; c < 13; c++) {
        var ch = row.charAt(c) || '.';
        if (ch === 'G') grass[r][c] = true; else grass[r][c] = false;
        var t = charToTile(ch);
        for (i = 0; i < 2; i++) {
          grid[r * 2][c * 2 + i] = t;
          grid[r * 2 + 1][c * 2 + i] = t;
        }
      }
    }

    // 基地周围砖墙 + 基地占位（地形清空）
    CFG.BASE_WALL.forEach(function (p) { setBrick(grid, p.col, p.row, BRICK); });
    setBrick(grid, CFG.BASE_CELL.col, CFG.BASE_CELL.row, T);

    // 玩家出生点清空，保证可出生
    CFG.PLAYER_SPAWN.forEach(function (p) {
      setBrick(grid, p.col, p.row, T);
      setBrick(grid, p.col, CFG.BASE_CELL.row - 1, T);
    });

    // 敌人生成点清空
    CFG.SPAWN_POINTS.forEach(function (p) { setBrick(grid, p.col, p.row, T); });

    return { grid: grid, grass: grass, index: levelIndex };
  }

  function setBrick(grid, col, row, t) {
    if (row < 0 || row > 12 || col < 0 || col > 12) return;
    var r0 = row * 2, c0 = col * 2;
    grid[r0][c0] = t; grid[r0][c0 + 1] = t;
    grid[r0 + 1][c0] = t; grid[r0 + 1][c0 + 1] = t;
  }

  /**
   * 关卡敌人构成。单人 20 辆；双人 28 辆（两人各打一半，避免抢不到怪）。
   * 使用种子随机洗牌，保证同一 seed 下两端序列一致。
   */
  function mixFor(levelIndex, mode) {
    var total = (mode === CFG.MODE_COOP) ? CFG.ENEMY.totalCoop : CFG.ENEMY.total;
    var n = levelIndex;
    var armor = Math.min(Math.round(total * 0.34), Math.floor((n + 1) / 2) + (mode === CFG.MODE_COOP ? 2 : 0));
    var power = Math.min(Math.round(total * 0.28), Math.floor(n / 2) + 1);
    var fast = Math.min(Math.round(total * 0.36), 1 + Math.floor(n / 1.5));
    var basic = Math.max(2, total - armor - power - fast);
    var arr = [];
    function push(type, count) { for (var i = 0; i < count; i++) arr.push(type); }
    push('armor', armor); push('power', power); push('fast', fast); push('basic', basic);
    while (arr.length < total) arr.push('basic');
    arr = arr.slice(0, total);
    g.RNG.shuffle(arr);
    return arr;
  }

  g.Level = {
    count: LEVELS.length,
    parse: parse,
    mixFor: mixFor,
    raw: LEVELS
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
