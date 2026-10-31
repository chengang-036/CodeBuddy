/**
 * config.js - 全局配置与数值表
 * 尺寸契约（对应 FC 坦克大战 2 倍像素）：
 *   小格 TILE=16（砖块最小破坏单位） / 砖块 BRICK=32（2x2 小格）
 *   战场 26x26 小格 = 416x416，右侧信息栏 96，底部状态条 64
 *   逻辑画布 512 x 480（竖屏/桌面均按等比缩放适配）
 */
(function (g) {
  'use strict';

  var C = {
    // ---------- 游戏模式 ----------
    // 1 = 单人（P2 键位并入 P1）；2 = 双人合作（同屏）
    MODE_SINGLE: 1,
    MODE_COOP: 2,
    DEFAULT_MODE: 2,

    // ---------- 尺寸 ----------
    TILE: 16,           // 地形小格边长（最小破坏单位）
    BRICK: 32,          // 砖块边长（2x2 小格）
    GRID: 26,           // 战场小格行列数
    FIELD: 26 * 16,     // 416 战场边长
    PANEL_W: 96,        // 右侧信息栏
    BOTTOM_H: 64,       // 底部状态条
    W: 512,             // 逻辑画布宽
    H: 480,             // 逻辑画布高
    TANK: 32,           // 坦克边长
    BULLET: 8,          // 子弹边长
    BASE: 32,           // 基地边长

    // ---------- 地形 ----------
    T_EMPTY: 0, T_BRICK: 1, T_STEEL: 2, T_WATER: 3, T_ICE: 4,

    // ---------- 方向 ----------
    DIR: {
      UP: { x: 0, y: -1, r: 0 },
      RIGHT: { x: 1, y: 0, r: 90 },
      DOWN: { x: 0, y: 1, r: 180 },
      LEFT: { x: -1, y: 0, r: 270 }
    },
    DIR_ORDER: ['UP', 'RIGHT', 'DOWN', 'LEFT'],

    // ---------- 玩家 ----------
    PLAYER: {
      speed: 62,
      lives: 3,
      spawnShield: 3.0,      // 出生保护秒数
      fireCd: { 1: 0.30, 2: 0.22, 3: 0.22 },
      bulletSpeed: { 1: 180, 2: 260, 3: 260 },
      maxBullets: { 1: 1, 2: 2, 3: 2 },
      maxLevel: 3,
      names: ['P1', 'P2'],   // 双人时的席位名
      colors: ['#ffe066', '#4ade80']  // 与 sprites 里 p*/q* 主色对应，仅 HUD 用
    },

    // ---------- 敌人 ----------
    ENEMY: {
      total: 20,             // 单人每关敌人总数
      totalCoop: 28,         // 双人每关敌人总数（按 2P 单独调表，避免抢不到怪）
      maxAlive: 4,           // 单人同屏上限
      maxAliveCoop: 6,       // 双人同屏上限
      spawnInterval: 2.2,    // 生成间隔（随关卡递减）
      spawnIntervalMin: 1.0,
      carryPowerUp: 4,       // 每关携带道具的敌人数
      types: {
        basic: { speed: 40, hp: 1, bulletSpeed: 130, fireCd: [0.9, 1.8], score: 100, name: '普通' },
        fast: { speed: 82, hp: 1, bulletSpeed: 130, fireCd: [1.0, 2.0], score: 200, name: '快速' },
        power: { speed: 52, hp: 1, bulletSpeed: 240, fireCd: [0.7, 1.4], score: 300, name: '火力' },
        armor: { speed: 50, hp: 4, bulletSpeed: 160, fireCd: [0.8, 1.5], score: 400, name: '装甲' }
      }
    },

    // ---------- 道具 ----------
    POWERUP: {
      life: 22,              // 存在秒数
      blinkAt: 6,            // 剩余秒数开始闪烁
      helmet: 10,            // 无敌时长
      clock: 8,              // 冻结时长
      shovel: 15             // 基地钢化时长
    },

    // ---------- 节奏 ----------
    TIMING: {
      stageIntro: 1.6,       // 关卡标题停留
      stageClear: 3.2,       // 结算停留
      spawnStar: 1.0,        // 敌人出现星闪
      respawn: 0.8,          // 玩家重生延迟
      gameOver: 2.6
    },

    // ---------- 基地（砖块坐标） ----------
    BASE_CELL: { col: 6, row: 12 },
    BASE_WALL: [           // 基地周围砖墙（砖块坐标）
      { col: 5, row: 11 }, { col: 6, row: 11 }, { col: 7, row: 11 },
      { col: 5, row: 12 }, { col: 7, row: 12 }
    ],
    SPAWN_POINTS: [        // 敌人生成点（砖块坐标）
      { col: 0, row: 0 }, { col: 6, row: 0 }, { col: 12, row: 0 }
    ],
    PLAYER_SPAWN: [        // 玩家出生点（砖块坐标）
      { col: 2, row: 12 }, { col: 10, row: 12 }
    ],

    // ---------- 配色 ----------
    COLORS: {
      bg: '#0b0b0e',
      field: '#16171c',
      panel: '#2a2b33',
      border: '#4a4d5a',
      text: '#e8e8ee',
      dim: '#8f93a3',
      accent: '#ffd24a',
      danger: '#ff5a4a'
    },

    STORAGE_KEY: 'tank1990_best_score'
  };

  g.CFG = C;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
