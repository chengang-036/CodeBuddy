/**
 * game.js - 玩法核心：状态机、关卡、AI、碰撞、道具、计分
 * 状态：TITLE / INTRO / PLAYING / PAUSED / CLEAR / GAMEOVER / WIN
 */
(function (g) {
  'use strict';
  var CFG = g.CFG, Level = g.Level, P = g.Platform;
  var Tank = g.Tank, Bullet = g.Bullet, PowerUp = g.PowerUp, Explosion = g.Explosion;
  var Sfx = g.Sfx;

  var ST = { TITLE: 0, INTRO: 1, PLAYING: 2, PAUSED: 3, CLEAR: 4, GAMEOVER: 5, WIN: 6 };
  var TILE = CFG.TILE, FIELD = CFG.FIELD;
  var BRICK = CFG.T_BRICK, STEEL = CFG.T_STEEL, WATER = CFG.T_WATER, ICE = CFG.T_ICE;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function solid(t) { return t === BRICK || t === STEEL; }

  var POWER_TYPES = ['star', 'helmet', 'tank', 'bomb', 'shovel', 'clock'];

  function Game() {
    this.state = ST.TITLE;
    this.stage = 1;
    this.score = 0;
    this.best = parseInt(P.getStorage(CFG.STORAGE_KEY, '0'), 10) || 0;
    this.lives = CFG.PLAYER.lives;
    this.time = 0;
    this.baseAlive = true;
    this.grid = null;
    this.grass = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.explosions = [];
    this.queue = [];
    this.spawnedCount = 0;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.carrySet = {};
    this.kills = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.freezeT = 0;
    this.shovelT = 0;
    this.respawnT = 0;
    this.introT = 0;
    this.clearT = 0;
    this.overT = 0;
    this.clearPending = 0;
    this.shakeT = 0;
    this.lastStageScore = 0;
    this.pausedFrom = ST.PLAYING;
    this.baseX = CFG.BASE_CELL.col * CFG.BRICK;
    this.baseY = CFG.BASE_CELL.row * CFG.BRICK;
  }

  /* ==================== 生命周期 ==================== */

  Game.prototype.startNewGame = function () {
    this.stage = 1;
    this.score = 0;
    this.lives = CFG.PLAYER.lives;
    this.kills = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.startStage();
  };

  Game.prototype.startStage = function () {
    var lv = Level.parse(this.stage);
    this.grid = lv.grid;
    this.grass = lv.grass;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.explosions = [];
    this.baseAlive = true;
    this.freezeT = 0;
    this.shovelT = 0;
    this.respawnT = 0;
    this.clearPending = 0;
    this.queue = Level.mixFor(this.stage);
    this.spawnedCount = 0;
    this.spawnTimer = 0.6;
    this.spawnIndex = 0;
    // 随机选出携带道具的敌人序号
    this.carrySet = {};
    for (var i = 0; i < CFG.ENEMY.carryPowerUp; i++) {
      this.carrySet[Math.floor(Math.random() * CFG.ENEMY.total)] = true;
    }
    this.lastStageScore = this.score;
    this.gridVersion = (this.gridVersion || 0) + 1;
    this.spawnPlayer(true);
    this.state = ST.INTRO;
    this.introT = CFG.TIMING.stageIntro;
    Sfx.play('stage');
  };

  Game.prototype.spawnPlayer = function (resetLevel) {
    var sp = CFG.PLAYER_SPAWN[0];
    var level = (resetLevel || !this.player) ? 1 : this.player.level;
    this.player = new Tank({
      x: sp.col * CFG.BRICK, y: sp.row * CFG.BRICK,
      dir: 'UP', isPlayer: true, type: 'player', level: level,
      speed: CFG.PLAYER.speed,
      bulletSpeed: CFG.PLAYER.bulletSpeed[level],
      spawnT: 0.2
    });
    this.player.shield = CFG.PLAYER.spawnShield;
  };

  /** 当前状态按确认键的处理 */
  Game.prototype.confirm = function () {
    switch (this.state) {
      case ST.TITLE: this.startNewGame(); break;
      case ST.CLEAR:
        if (this.clearT > 0.4) { this.clearT = 0.01; }
        break;
      case ST.GAMEOVER:
        if (this.overT <= 0) this.state = ST.TITLE;
        break;
      case ST.WIN:
        if (this.overT <= 0) this.state = ST.TITLE;
        break;
      case ST.PAUSED: this.togglePause(); break;
      default: break;
    }
  };

  Game.prototype.togglePause = function () {
    if (this.state === ST.PLAYING) { this.state = ST.PAUSED; }
    else if (this.state === ST.PAUSED) { this.state = ST.PLAYING; }
  };

  /* ==================== 主更新 ==================== */

  Game.prototype.update = function (dt) {
    this.time += dt;
    if (this.shakeT > 0) this.shakeT -= dt;

    switch (this.state) {
      case ST.TITLE:
        break;
      case ST.INTRO:
        this.introT -= dt;
        if (this.introT <= 0) this.state = ST.PLAYING;
        break;
      case ST.PLAYING:
        this.updatePlay(dt);
        break;
      case ST.CLEAR:
        this.clearT -= dt;
        this.updateEffects(dt);
        if (this.clearT <= 0) {
          if (this.stage >= Level.count) {
            this.state = ST.WIN; this.overT = 0.8;
            Sfx.play('victory');
          } else {
            this.stage++;
            this.startStage();
          }
        }
        break;
      case ST.GAMEOVER:
      case ST.WIN:
        if (this.overT > 0) this.overT -= dt;
        this.updateEffects(dt);
        break;
      case ST.PAUSED:
      default:
        break;
    }
  };

  Game.prototype.updatePlay = function (dt) {
    var i;
    // 道具计时
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      if (this.freezeT <= 0) { this.freezeT = 0; this.setFrozen(false); }
    }
    if (this.shovelT > 0) {
      this.shovelT -= dt;
      if (this.shovelT <= 0) { this.shovelT = 0; this.restoreBaseWall(); }
    }

    // 玩家重生
    if (!this.player && this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.spawnPlayer(true);
    }

    // 玩家输入
    if (this.player && this.player.spawnT <= 0) {
      var dir = g.Input.pickDir();
      if (dir) { this.player.setDir(dir); this.player.moving = true; }
      else { this.player.moving = false; }
      // 点按立即开火；按住则连发（fire() 内部按 fireTimer 与同屏弹数节流）
      if (g.Input.consumeFire() || g.Input.isDown('fire')) this.fire(this.player);
    } else if (this.player) {
      g.Input.consumeFire();
    }

    if (this.player) this.player.update(dt, this);

    // 敌人生成
    if (this.queue.length > 0 && this.enemies.length < CFG.ENEMY.maxAlive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.trySpawnEnemy();
    }

    // 敌人 AI
    for (i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.spawnT > 0) { e.update(dt, this); continue; }
      if (!this.freezeT) this.aiThink(e, dt);
      var px = e.x, py = e.y;
      e.update(dt, this);
      // 撞墙自动改向
      if (e.moving && Math.abs(e.x - px) < 0.01 && Math.abs(e.y - py) < 0.01) {
        this.aiTurn(e, true);
      }
    }

    // 子弹
    for (i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.update(dt, this);
      if (!b.alive) this.bullets.splice(i, 1);
    }

    // 道具
    for (i = this.powerups.length - 1; i >= 0; i--) {
      var pu = this.powerups[i];
      pu.update(dt);
      if (this.player && pu.alive &&
        overlap(this.player.x, this.player.y, this.player.size, this.player.size, pu.x, pu.y, pu.size, pu.size)) {
        this.applyPowerUp(pu.type);
        pu.alive = false;
      }
      if (!pu.alive) this.powerups.splice(i, 1);
    }

    this.updateEffects(dt);

    // 胜负判定
    if (this.queue.length === 0 && this.enemies.length === 0 && this.baseAlive) {
      if (this.clearPending === 0) this.clearPending = 1.4;
      this.clearPending -= dt;
      if (this.clearPending <= 0) {
        this.state = ST.CLEAR;
        this.clearT = CFG.TIMING.stageClear;
        if (this.score > this.best) { this.best = this.score; P.setStorage(CFG.STORAGE_KEY, String(this.best)); }
      }
    }
  };

  Game.prototype.updateEffects = function (dt) {
    for (var i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update(dt);
      if (!this.explosions[i].alive) this.explosions.splice(i, 1);
    }
  };

  /* ==================== 敌人 ==================== */

  Game.prototype.trySpawnEnemy = function () {
    var pts = CFG.SPAWN_POINTS;
    for (var k = 0; k < pts.length; k++) {
      var idx = (this.spawnIndex + k) % pts.length;
      var p = pts[idx];
      var x = p.col * CFG.BRICK, y = p.row * CFG.BRICK;
      if (this.rectBlocked(x, y, CFG.TANK, CFG.TANK, null)) continue;
      var type = this.queue.shift();
      var cfg = CFG.ENEMY.types[type];
      var t = new Tank({
        x: x, y: y, dir: 'DOWN', type: type,
        hp: cfg.hp, speed: cfg.speed, bulletSpeed: cfg.bulletSpeed,
        fireCdMin: cfg.fireCd[0], fireCdMax: cfg.fireCd[1],
        score: cfg.score,
        spawnT: CFG.TIMING.spawnStar,
        carrying: !!this.carrySet[this.spawnedCount]
      });
      t.frozen = false;
      this.enemies.push(t);
      this.spawnedCount++;
      this.spawnIndex = idx + 1;
      var iv = CFG.ENEMY.spawnInterval - (this.stage - 1) * 0.12;
      this.spawnTimer = Math.max(CFG.ENEMY.spawnIntervalMin, iv);
      Sfx.play('appear');
      return true;
    }
    this.spawnTimer = 0.35;
    return false;
  };

  Game.prototype.aiThink = function (e, dt) {
    e.aiDirTimer -= dt;
    if (e.aiDirTimer <= 0) {
      var r = Math.random();
      if (r < 0.32 && this.player) {
        // 朝玩家方向
        var dx = this.player.centerX() - e.centerX();
        var dy = this.player.centerY() - e.centerY();
        e.setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
      } else if (r < 0.46) {
        // 朝基地
        var bx = this.baseX - e.centerX();
        var by = this.baseY - e.centerY();
        e.setDir(Math.abs(bx) > Math.abs(by) ? (bx > 0 ? 'RIGHT' : 'LEFT') : (by > 0 ? 'DOWN' : 'UP'));
      } else {
        this.aiTurn(e, false);
      }
      e.aiDirTimer = 0.5 + Math.random() * 1.3;
    }
    if (e.fireTimer <= 0) {
      this.fire(e);
      e.fireTimer = e.fireCdMin + Math.random() * (e.fireCdMax - e.fireCdMin);
    }
    e.moving = true;
  };

  Game.prototype.aiTurn = function (e, forced) {
    var r = Math.random();
    var perp = (e.dir === 'UP' || e.dir === 'DOWN') ? (r < 0.5 ? 'LEFT' : 'RIGHT') : (r < 0.5 ? 'UP' : 'DOWN');
    var back = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }[e.dir];
    e.setDir(r < 0.72 ? perp : back);
    e.aiDirTimer = 0.5 + Math.random() * 1.0;
  };

  Game.prototype.setFrozen = function (v) {
    for (var i = 0; i < this.enemies.length; i++) this.enemies[i].frozen = v;
  };

  /* ==================== 射击与伤害 ==================== */

  Game.prototype.fire = function (tank) {
    if (!tank || !tank.alive || tank.spawnT > 0 || tank.frozen) return false;
    if (tank.fireTimer > 0) return false;
    var isP = tank.isPlayer;
    var owner = isP ? 'player' : 'enemy';
    var maxB = isP ? CFG.PLAYER.maxBullets[tank.level] : 1;
    var count = 0;
    for (var i = 0; i < this.bullets.length; i++) {
      if (this.bullets[i].owner === owner && this.bullets[i].tank === tank) count++;
    }
    if (count >= maxB) return false;

    var d = CFG.DIR[tank.dir];
    var speed = isP ? CFG.PLAYER.bulletSpeed[tank.level] : tank.bulletSpeed;
    var cx = tank.x + tank.size / 2 + d.x * (tank.size / 2 - CFG.BULLET / 2) - CFG.BULLET / 2;
    var cy = tank.y + tank.size / 2 + d.y * (tank.size / 2 - CFG.BULLET / 2) - CFG.BULLET / 2;
    var power = isP && tank.level >= 3;
    this.bullets.push(new Bullet({
      x: cx, y: cy, dir: tank.dir, speed: speed, owner: owner, tank: tank, power: power
    }));
    tank.resetFireCd();
    Sfx.play(isP ? (tank.level >= 2 ? 'shootFast' : 'shoot') : 'shoot');
    return true;
  };

  /** 子弹碰撞结算：返回 true 表示子弹销毁 */
  Game.prototype.bulletResolve = function (b) {
    var i, o;
    // 出界
    if (b.x < 0 || b.y < 0 || b.x + b.size > FIELD || b.y + b.size > FIELD) {
      var ex = clamp(b.x + b.size / 2 - 8, 0, FIELD - 16);
      var ey = clamp(b.y + b.size / 2 - 8, 0, FIELD - 16);
      this.explosions.push(new Explosion({ x: ex, y: ey }));
      Sfx.play('hitSteel');
      return true;
    }

    // 子弹对撞（玩家子弹抵消敌人子弹）
    for (i = 0; i < this.bullets.length; i++) {
      o = this.bullets[i];
      if (o === b || !o.alive || o.owner === b.owner) continue;
      if (overlap(b.x, b.y, b.size, b.size, o.x, o.y, o.size, o.size)) {
        o.alive = false;
        this.explosions.push(new Explosion({ x: b.x - 8, y: b.y - 8 }));
        Sfx.play('hitSteel');
        return true;
      }
    }

    // 地形
    var c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.size - 1) / TILE);
    var r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.size - 1) / TILE);
    var d = CFG.DIR[b.dir];
    var hit = null;
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) continue;
        if (solid(this.grid[r][c])) {
          if (!hit) hit = { r: r, c: c };
          else {
            // 取弹道更靠前的一格
            var prevScore = hit.r * d.y + hit.c * d.x;
            var curScore = r * d.y + c * d.x;
            if (curScore > prevScore) hit = { r: r, c: c };
          }
        }
      }
    }
    if (hit) { this.destroyTiles(b, hit.r, hit.c); return true; }

    // 基地
    if (this.baseAlive && overlap(b.x, b.y, b.size, b.size, this.baseX, this.baseY, CFG.BASE, CFG.BASE)) {
      this.destroyBase();
      return true;
    }

    // 坦克
    if (b.owner === 'player') {
      for (i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        if (!e.alive || e.spawnT > 0) continue;
        if (overlap(b.x, b.y, b.size, b.size, e.x, e.y, e.size, e.size)) {
          this.hitEnemy(e, b);
          return true;
        }
      }
    } else {
      if (this.player && this.player.spawnT <= 0 &&
        overlap(b.x, b.y, b.size, b.size, this.player.x, this.player.y, this.player.size, this.player.size)) {
        this.hitPlayer(b);
        return true;
      }
    }
    return false;
  };

  Game.prototype.destroyTiles = function (b, r, c) {
    var d = CFG.DIR[b.dir];
    this.destroyCell(r, c, b);
    if (d.x !== 0) {
      if (!this.destroyCell(r - 1, c, b)) this.destroyCell(r + 1, c, b);
    } else {
      if (!this.destroyCell(r, c - 1, b)) this.destroyCell(r, c + 1, b);
    }
  };

  Game.prototype.destroyCell = function (r, c, b) {
    if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) return false;
    var t = this.grid[r][c];
    if (!solid(t)) return false;
    if (t === STEEL && !b.power) { Sfx.play('hitSteel'); return false; }
    this.grid[r][c] = CFG.T_EMPTY;
    this.gridVersion = (this.gridVersion || 0) + 1;
    Sfx.play('hitBrick');
    return true;
  };

  Game.prototype.hitEnemy = function (e, b) {
    e.hp -= 1;
    if (e.hp > 0) {
      Sfx.play('hitTank');
      this.explosions.push(new Explosion({ x: b.x - 8, y: b.y - 8 }));
      return;
    }
    var self = this;
    this.explosions.push(new Explosion({ x: e.x - 4, y: e.y - 4, big: true }));
    Sfx.play('explodeBig');
    P.vibrate(30);
    this.shakeT = 0.22;
    var idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    e.alive = false;
    this.score += e.score;
    this.kills[e.type] = (this.kills[e.type] || 0) + 1;
    if (e.carrying) this.dropPowerUp(e.x, e.y);
  };

  Game.prototype.hitPlayer = function (b) {
    var p = this.player;
    if (!p) return;
    if (p.shield > 0) {
      this.explosions.push(new Explosion({ x: b.x - 8, y: b.y - 8 }));
      Sfx.play('hitSteel');
      return;
    }
    this.explosions.push(new Explosion({ x: p.x - 4, y: p.y - 4, big: true }));
    Sfx.play('explodeBig');
    P.vibrate(60);
    this.shakeT = 0.3;
    this.player = null;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = ST.GAMEOVER;
      this.overT = CFG.TIMING.gameOver;
      if (this.score > this.best) { this.best = this.score; P.setStorage(CFG.STORAGE_KEY, String(this.best)); }
      Sfx.play('gameover');
    } else {
      this.respawnT = CFG.TIMING.respawn;
    }
  };

  Game.prototype.destroyBase = function () {
    this.baseAlive = false;
    this.explosions.push(new Explosion({ x: this.baseX - 4, y: this.baseY - 4, big: true }));
    Sfx.play('explodeBig');
    Sfx.play('gameover');
    P.vibrate(80);
    this.shakeT = 0.5;
    this.state = ST.GAMEOVER;
    this.overT = CFG.TIMING.gameOver;
    if (this.score > this.best) { this.best = this.score; P.setStorage(CFG.STORAGE_KEY, String(this.best)); }
  };

  /* ==================== 道具 ==================== */

  Game.prototype.dropPowerUp = function (x, y) {
    // 优先落在击毁处，其次随机找一个空砖块
    var bx = clamp(Math.round(x / CFG.BRICK) * CFG.BRICK, 0, FIELD - CFG.BRICK);
    var by = clamp(Math.round(y / CFG.BRICK) * CFG.BRICK, 0, FIELD - CFG.BRICK);
    if (this.rectBlocked(bx, by, CFG.BRICK, CFG.BRICK, null)) {
      var found = false;
      for (var i = 0; i < 40 && !found; i++) {
        var rx = Math.floor(Math.random() * 13) * CFG.BRICK;
        var ry = Math.floor(Math.random() * 13) * CFG.BRICK;
        if (!this.rectBlocked(rx, ry, CFG.BRICK, CFG.BRICK, null)) { bx = rx; by = ry; found = true; }
      }
    }
    var type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    this.powerups.push(new PowerUp({ x: bx, y: by, type: type }));
    Sfx.play('powerupDrop');
  };

  Game.prototype.applyPowerUp = function (type) {
    this.score += 500;
    Sfx.play('powerup');
    switch (type) {
      case 'star':
        if (this.player) {
          this.player.level = Math.min(CFG.PLAYER.maxLevel, this.player.level + 1);
          this.player.bulletSpeed = CFG.PLAYER.bulletSpeed[this.player.level];
        }
        break;
      case 'helmet':
        if (this.player) this.player.shield = Math.max(this.player.shield, CFG.POWERUP.helmet);
        break;
      case 'tank':
        this.lives += 1;
        Sfx.play('life');
        break;
      case 'bomb':
        for (var i = this.enemies.length - 1; i >= 0; i--) {
          var e = this.enemies[i];
          this.explosions.push(new Explosion({ x: e.x - 4, y: e.y - 4, big: true }));
          this.score += e.score;
          this.kills[e.type] = (this.kills[e.type] || 0) + 1;
          this.enemies.splice(i, 1);
        }
        Sfx.play('explodeBig');
        this.shakeT = 0.4;
        break;
      case 'shovel':
        this.hardenBaseWall(true);
        this.shovelT = CFG.POWERUP.shovel;
        Sfx.play('shovel');
        break;
      case 'clock':
        this.freezeT = CFG.POWERUP.clock;
        this.setFrozen(true);
        Sfx.play('freeze');
        break;
      default: break;
    }
  };

  Game.prototype.hardenBaseWall = function (on) {
    var t = on ? STEEL : BRICK;
    CFG.BASE_WALL.forEach(function (p) {
      var r0 = p.row * 2, c0 = p.col * 2;
      this.grid[r0][c0] = t; this.grid[r0][c0 + 1] = t;
      this.grid[r0 + 1][c0] = t; this.grid[r0 + 1][c0 + 1] = t;
    }, this);
    this.gridVersion = (this.gridVersion || 0) + 1;
  };
  Game.prototype.restoreBaseWall = function () { this.hardenBaseWall(false); };

  /* ==================== 碰撞查询 ==================== */

  Game.prototype.rectBlocked = function (x, y, w, h, self) {
    if (x < 0 || y < 0 || x + w > FIELD || y + h > FIELD) return true;
    var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
    var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) return true;
        var t = this.grid[r][c];
        if (t === BRICK || t === STEEL || t === WATER) return true;
      }
    }
    if (this.baseAlive && overlap(x, y, w, h, this.baseX, this.baseY, CFG.BASE, CFG.BASE)) return true;
    var self_ = self;
    function chk(t) {
      if (!t || t === self_ || !t.alive || t.spawnT > 0) return false;
      return overlap(x, y, w, h, t.x, t.y, t.size, t.size);
    }
    if (chk(this.player)) return true;
    for (var i = 0; i < this.enemies.length; i++) if (chk(this.enemies[i])) return true;
    return false;
  };

  Game.prototype.tankOnIce = function (t) {
    var c = Math.floor(t.centerX() / TILE), r = Math.floor(t.centerY() / TILE);
    if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) return false;
    return this.grid[r][c] === ICE;
  };

  Game.prototype.enemiesLeft = function () {
    return this.queue.length + this.enemies.length;
  };

  g.Game = Game;
  g.GAME_ST = ST;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
