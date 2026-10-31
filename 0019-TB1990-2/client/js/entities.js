/**
 * entities.js - 游戏实体：坦克 / 子弹 / 道具 / 爆炸
 * 所有碰撞通过 game 提供的查询完成，实体本身不持有地形数据。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG;
  var TILE = CFG.TILE, FIELD = CFG.FIELD;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ==================== 坦克 ==================== */
  function Tank(opts) {
    this.x = opts.x; this.y = opts.y;
    this.size = CFG.TANK;
    this.dir = opts.dir || 'DOWN';
    this.isPlayer = !!opts.isPlayer;
    this.pid = (opts.pid === undefined) ? -1 : opts.pid;  // 玩家席位 0/1；敌人为 -1
    this.type = opts.type || 'basic';       // basic / fast / power / armor / player
    this.isArmor = this.type === 'armor';
    this.hp = opts.hp || 1;
    this.maxHp = this.hp;
    this.speed = opts.speed || 50;
    this.bulletSpeed = opts.bulletSpeed || 130;
    this.fireCdMin = opts.fireCdMin || 0.8;
    this.fireCdMax = opts.fireCdMax || 1.6;
    this.score = opts.score || 100;
    this.level = opts.level || 1;           // 玩家等级 1-3
    this.shield = 0;
    this.alive = true;
    this.moving = false;
    this.animT = 0;
    this.frame = 0;
    this.fireTimer = 0;
    this.spawnT = opts.spawnT || 0;         // >0 表示出场星闪中
    this.frozen = false;                    // 时钟冻结
    this.slideV = 0;                        // 冰面惯性
    this.carrying = !!opts.carrying;        // 是否携带道具
    this.blinkT = 0;
    this.aiTimer = 0;
    this.aiDirTimer = 0;
    this.isFast = this.type === 'fast';
  }

  Tank.prototype.centerX = function () { return this.x + this.size / 2; };
  Tank.prototype.centerY = function () { return this.y + this.size / 2; };

  Tank.prototype.setDir = function (dir) {
    if (this.dir === dir) return;
    var wasVertical = (this.dir === 'UP' || this.dir === 'DOWN');
    var nowVertical = (dir === 'UP' || dir === 'DOWN');
    if (wasVertical !== nowVertical) {
      // 换向时对齐到小格网格，保证能穿过通道
      if (nowVertical) this.x = Math.round(this.x / TILE) * TILE;
      else this.y = Math.round(this.y / TILE) * TILE;
    }
    this.dir = dir;
  };

  /** 分轴移动，撞墙/撞坦克则停止该轴 */
  Tank.prototype.moveStep = function (dx, dy, game) {
    if (dx) {
      var nx = clamp(this.x + dx, 0, FIELD - this.size);
      if (!game.rectBlocked(nx, this.y, this.size, this.size, this)) this.x = nx;
      else this.moving = false;
    }
    if (dy) {
      var ny = clamp(this.y + dy, 0, FIELD - this.size);
      if (!game.rectBlocked(this.x, ny, this.size, this.size, this)) this.y = ny;
      else this.moving = false;
    }
  };

  Tank.prototype.update = function (dt, game) {
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      return;
    }
    if (this.shield > 0) this.shield -= dt;
    if (this.frozen) return;

    var d = CFG.DIR[this.dir];
    var step = this.speed * dt;
    var before = this.moving;

    if (this.moving) {
      this.moveStep(d.x * step, d.y * step, game);
      this.animT += dt;
      if (this.animT > 0.09) { this.animT = 0; this.frame = 1 - this.frame; }
      // 冰面惯性记录
      if (game.tankOnIce(this)) { this.slideV = step; }
    } else if (game.tankOnIce(this) && this.slideV > 0.2) {
      // 冰面打滑：松手后继续滑行并衰减
      this.moveStep(d.x * this.slideV, d.y * this.slideV, game);
      this.slideV -= step * 4 * dt * 6;
      if (this.slideV < 0) this.slideV = 0;
    }

    if (this.fireTimer > 0) this.fireTimer -= dt;
  };

  Tank.prototype.canFire = function () {
    if (this.spawnT > 0 || this.frozen || !this.alive) return false;
    if (this.fireTimer > 0) return false;
    var max = this.isPlayer ? CFG.PLAYER.maxBullets[this.level] : 1;
    return this.bullets === undefined ? true : true;
  };

  Tank.prototype.resetFireCd = function () {
    this.fireTimer = this.isPlayer
      ? CFG.PLAYER.fireCd[this.level]
      : (this.fireCdMin + g.RNG.rand() * (this.fireCdMax - this.fireCdMin));
  };

  /** 精灵名（玩家按席位+等级：P1 = p1..p3 黄系，P2 = q1..q3 绿系；装甲按剩余血量变色） */
  Tank.prototype.spriteKey = function () {
    if (this.isPlayer) return (this.pid === 1 ? 'q' : 'p') + this.level;
    if (this.isArmor) {
      var idx = clamp(this.hp, 1, 4);
      return 'armor' + idx;
    }
    return this.type;
  };

  /* ==================== 子弹 ==================== */
  function Bullet(opts) {
    this.x = opts.x; this.y = opts.y;
    this.size = CFG.BULLET;
    this.dir = opts.dir;
    this.speed = opts.speed;
    this.owner = opts.owner;         // 'player' | 'enemy'
    this.tank = opts.tank || null;
    this.power = !!opts.power;       // 可否击毁钢
    this.alive = true;
    this.trail = 0;
  }

  Bullet.prototype.update = function (dt, game) {
    var d = CFG.DIR[this.dir];
    var total = this.speed * dt;
    var steps = Math.max(1, Math.ceil(total / 3));
    var inc = total / steps;
    for (var i = 0; i < steps; i++) {
      this.x += d.x * inc;
      this.y += d.y * inc;
      if (game.bulletResolve(this)) { this.alive = false; return; }
    }
  };

  /* ==================== 道具 ==================== */
  function PowerUp(opts) {
    this.x = opts.x; this.y = opts.y;
    this.size = CFG.BRICK;
    this.type = opts.type;
    this.life = CFG.POWERUP.life;
    this.blink = 0;
    this.alive = true;
  }
  PowerUp.prototype.update = function (dt) {
    this.life -= dt;
    this.blink += dt;
    if (this.life <= 0) this.alive = false;
  };
  PowerUp.prototype.visible = function () {
    if (this.life > CFG.POWERUP.blinkAt) return true;
    return (Math.floor(this.blink * 8) % 2) === 0;
  };

  /* ==================== 爆炸特效 ==================== */
  function Explosion(opts) {
    this.x = opts.x; this.y = opts.y;
    this.big = !!opts.big;
    this.t = 0;
    this.dur = this.big ? 0.55 : 0.28;
    this.alive = true;
    this.maxSize = this.big ? 40 : 24;
  }
  Explosion.prototype.update = function (dt) {
    this.t += dt;
    if (this.t >= this.dur) this.alive = false;
  };
  Explosion.prototype.frameIndex = function () {
    var p = this.t / this.dur;
    return clamp(Math.floor(p * 4), 0, 3);
  };

  g.Tank = Tank;
  g.Bullet = Bullet;
  g.PowerUp = PowerUp;
  g.Explosion = Explosion;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
