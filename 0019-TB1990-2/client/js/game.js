/**
 * game.js - 玩法核心：状态机、关卡、AI、碰撞、道具、计分
 * 状态：TITLE / INTRO / PLAYING / PAUSED / CLEAR / GAMEOVER / WIN
 *
 * 双人合作（P1）：
 *   - 两名玩家共享同一张地图、同一份敌人队列、同一个基地；各自独立的生命与等级
 *   - 玩家子弹不伤队友（合作模式不开友伤，误伤只会让两个人吵架）
 *   - 敌人 AI 的目标是"最近的那个玩家"，这样两个人分别吸引火力才有意义
 *   - 一人命耗尽后出局旁观，队友继续；两人全部出局才算失败
 *
 * 确定性（为 P2 联机铺路）：
 *   逻辑层所有随机都走 g.RNG（种子化），不允许出现 Math.random。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG, Level = g.Level, P = g.Platform, RNG = g.RNG;
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
    this.mode = CFG.DEFAULT_MODE;      // 1 = 单人，2 = 双人同屏
    this.state = ST.TITLE;
    this.stage = 1;
    this.score = 0;
    this.best = parseInt(P.getStorage(CFG.STORAGE_KEY, '0'), 10) || 0;
    this.seats = [];                   // [{ lives, level }]，长度随 mode 变化
    this.players = [];                 // Tank | null，长度随 mode 变化
    this.respawnT = [];                // 每席重生倒计时
    this.time = 0;
    this.baseAlive = true;
    this.grid = null;
    this.grass = null;
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
    this.introT = 0;
    this.clearT = 0;
    this.overT = 0;
    this.overReason = '';
    this.clearPending = 0;
    this.shakeT = 0;
    this.lastStageScore = 0;
    this.pausedFrom = ST.PLAYING;
    this.baseX = CFG.BASE_CELL.col * CFG.BRICK;
    this.baseY = CFG.BASE_CELL.row * CFG.BRICK;
    this.setMode(this.mode);
  }

  /* ==================== 模式与席位 ==================== */

  Game.prototype.setMode = function (m) {
    this.mode = (m === CFG.MODE_SINGLE) ? CFG.MODE_SINGLE : CFG.MODE_COOP;
    var seats = [], players = [], resp = [];
    for (var i = 0; i < this.mode; i++) {
      seats.push({ lives: CFG.PLAYER.lives, level: 1 });
      players.push(null);
      resp.push(0);
    }
    this.seats = seats;
    this.players = players;
    this.respawnT = resp;
    if (g.Input && g.Input.setMode) g.Input.setMode(this.mode);
  };

  /** 每关敌人总数（单人 20 / 双人 28） */
  Game.prototype.enemyTotal = function () {
    return this.mode === CFG.MODE_COOP ? CFG.ENEMY.totalCoop : CFG.ENEMY.total;
  };

  /** 同屏敌人上限（单人 4 / 双人 6） */
  Game.prototype.maxAlive = function () {
    return this.mode === CFG.MODE_COOP ? CFG.ENEMY.maxAliveCoop : CFG.ENEMY.maxAlive;
  };

  /** 还有命的玩家数量 */
  Game.prototype.aliveSeats = function () {
    var n = 0;
    for (var i = 0; i < this.seats.length; i++) if (this.seats[i].lives > 0) n++;
    return n;
  };

  /** 找最近的、活着的、已出场的玩家（敌人 AI 用） */
  Game.prototype.nearestPlayer = function (e) {
    var best = null, bd = Infinity;
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      if (!p || !p.alive || p.spawnT > 0) continue;
      var dx = p.centerX() - e.centerX(), dy = p.centerY() - e.centerY();
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  /* ==================== 生命周期 ==================== */

  Game.prototype.startNewGame = function (seed) {
    this.stage = 1;
    this.score = 0;
    this.kills = { basic: 0, fast: 0, power: 0, armor: 0 };
    RNG.reseed(seed === undefined ? (Date.now() >>> 0) : seed);
    this.setMode(this.mode);
    this.startStage();
  };

  Game.prototype.startStage = function () {
    var i;
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
    this.clearPending = 0;
    this.queue = Level.mixFor(this.stage, this.mode);
    this.spawnedCount = 0;
    this.spawnTimer = 0.6;
    this.spawnIndex = 0;
    RNG.mark('stage' + this.stage);

    // 随机选出携带道具的敌人序号
    this.carrySet = {};
    for (i = 0; i < CFG.ENEMY.carryPowerUp; i++) {
      this.carrySet[RNG.int(0, this.enemyTotal() - 1)] = true;
    }
    this.lastStageScore = this.score;
    this.gridVersion = (this.gridVersion || 0) + 1;

    for (i = 0; i < this.mode; i++) {
      this.players[i] = null;
      this.respawnT[i] = 0;
      this.seats[i].level = 1;
      this.spawnPlayer(i, true);
    }
    this.state = ST.INTRO;
    this.introT = CFG.TIMING.stageIntro;
    Sfx.play('stage');
  };

  /**
   * 在席位 i 的出生点生成坦克。
   * 出生点被别的坦克占着时先不生成，返回 false 让调用方稍后重试
   * （否则会出现两辆坦克叠在一起，之后谁都动不了）。
   */
  Game.prototype.spawnPlayer = function (i, resetLevel) {
    var seat = this.seats[i];
    if (!seat || seat.lives <= 0) return false;
    if (resetLevel) seat.level = 1;
    var lv = seat.level;
    var pts = CFG.PLAYER_SPAWN;
    var sp = pts[i % pts.length];
    var x = sp.col * CFG.BRICK, y = sp.row * CFG.BRICK;

    if (this.grid && this.rectBlocked(x, y, CFG.TANK, CFG.TANK, null)) {
      // 地形（shovel 钢化过的墙可能留在这里）：清掉，保证一定出生得出来
      if (this.gridBlocked(x, y)) this.clearCellsUnder(x, y);
      else return false;   // 被坦克占着 → 稍后再试
    }

    var t = new Tank({
      x: x, y: y,
      dir: 'UP', isPlayer: true, pid: i, type: 'player', level: lv,
      speed: CFG.PLAYER.speed,
      bulletSpeed: CFG.PLAYER.bulletSpeed[lv],
      spawnT: 0.2
    });
    t.shield = CFG.PLAYER.spawnShield;
    this.players[i] = t;
    return true;
  };

  /** 只查地形（不查坦克），用于判断出生点是不是被墙挡住 */
  Game.prototype.gridBlocked = function (x, y) {
    if (!this.grid) return false;
    var c0 = Math.floor(x / TILE), c1 = Math.floor((x + CFG.TANK - 1) / TILE);
    var r0 = Math.floor(y / TILE), r1 = Math.floor((y + CFG.TANK - 1) / TILE);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) return true;
        var t = this.grid[r][c];
        if (t === BRICK || t === STEEL || t === WATER) return true;
      }
    }
    return false;
  };

  Game.prototype.clearCellsUnder = function (x, y) {
    var c0 = Math.floor(x / TILE), c1 = Math.floor((x + CFG.TANK - 1) / TILE);
    var r0 = Math.floor(y / TILE), r1 = Math.floor((y + CFG.TANK - 1) / TILE);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (r < 0 || r >= CFG.GRID || c < 0 || c >= CFG.GRID) continue;
        if (solid(this.grid[r][c])) this.grid[r][c] = CFG.T_EMPTY;
      }
    }
    this.gridVersion = (this.gridVersion || 0) + 1;
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

    // 各席位：重生倒计时 + 输入 + 自身更新
    for (i = 0; i < this.mode; i++) {
      var p = this.players[i];
      if (!p) {
        if (this.seats[i].lives > 0) {
          this.respawnT[i] -= dt;
          if (this.respawnT[i] <= 0) {
            if (!this.spawnPlayer(i, true)) this.respawnT[i] = 0.35;  // 出生点被占，稍后再试
          }
        }
        continue;
      }
      if (p.spawnT <= 0) {
        var dir = g.Input.pickDir(i);
        if (dir) { p.setDir(dir); p.moving = true; }
        else { p.moving = false; }
        // 点按立即开火；按住则连发（fire() 内部按射速与同屏弹数节流）
        if (g.Input.consumeFire(i) || g.Input.isDown('fire', i)) this.fire(p);
      } else {
        g.Input.consumeFire(i);
      }
      p.update(dt, this);
    }

    // 敌人生成
    if (this.queue.length > 0 && this.enemies.length < this.maxAlive()) {
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

    // 道具（任一玩家碰到都算拾取，先到先得）
    for (i = this.powerups.length - 1; i >= 0; i--) {
      var pu = this.powerups[i];
      pu.update(dt);
      for (var k = 0; k < this.mode && pu.alive; k++) {
        var pl = this.players[k];
        if (!pl || pl.spawnT > 0) continue;
        if (overlap(pl.x, pl.y, pl.size, pl.size, pu.x, pu.y, pu.size, pu.size)) {
          this.applyPowerUp(pu.type, pl);
          pu.alive = false;
        }
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
      if (this.mode === CFG.MODE_COOP) iv -= 0.25;   // 双人上限高，生成也快一点，别让两人干等
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
      var r = RNG.rand();
      var tgt = this.nearestPlayer(e);
      if (r < 0.32 && tgt) {
        // 朝最近的玩家
        var dx = tgt.centerX() - e.centerX();
        var dy = tgt.centerY() - e.centerY();
        e.setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
      } else if (r < 0.46) {
        // 朝基地
        var bx = this.baseX - e.centerX();
        var by = this.baseY - e.centerY();
        e.setDir(Math.abs(bx) > Math.abs(by) ? (bx > 0 ? 'RIGHT' : 'LEFT') : (by > 0 ? 'DOWN' : 'UP'));
      } else {
        this.aiTurn(e, false);
      }
      e.aiDirTimer = 0.5 + RNG.rand() * 1.3;
    }
    if (e.fireTimer <= 0) {
      this.fire(e);
      e.fireTimer = e.fireCdMin + RNG.rand() * (e.fireCdMax - e.fireCdMin);
    }
    e.moving = true;
  };

  Game.prototype.aiTurn = function (e, forced) {
    var r = RNG.rand();
    var perp = (e.dir === 'UP' || e.dir === 'DOWN') ? (r < 0.5 ? 'LEFT' : 'RIGHT') : (r < 0.5 ? 'UP' : 'DOWN');
    var back = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }[e.dir];
    e.setDir(r < 0.72 ? perp : back);
    e.aiDirTimer = 0.5 + RNG.rand() * 1.0;
  };

  Game.prototype.setFrozen = function (v) {
    for (var i = 0; i < this.enemies.length; i++) this.enemies[i].frozen = v;
  };

  /* ==================== 射击与伤害 ==================== */

  Game.prototype.fire = function (tank) {
    if (!tank || !tank.alive || tank.spawnT > 0 || tank.frozen) return false;
    if (tank.fireTimer > 0) return false;
    var isP = tank.isPlayer;
    // 玩家子弹统一 owner='player'：玩家之间天然不会误伤，也不判定对撞
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
      for (i = 0; i < this.players.length; i++) {
        var pl = this.players[i];
        if (!pl || !pl.alive || pl.spawnT > 0) continue;
        if (overlap(b.x, b.y, b.size, b.size, pl.x, pl.y, pl.size, pl.size)) {
          this.hitPlayer(pl, b);
          return true;
        }
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

  /** 玩家被击中：双人时必须按 pid 分开结算，否则会扣错人的命 */
  Game.prototype.hitPlayer = function (p, b) {
    if (!p) return;
    var i = p.pid;
    if (p.shield > 0) {
      this.explosions.push(new Explosion({ x: b.x - 8, y: b.y - 8 }));
      Sfx.play('hitSteel');
      return;
    }
    this.explosions.push(new Explosion({ x: p.x - 4, y: p.y - 4, big: true }));
    Sfx.play('explodeBig');
    P.vibrate(60);
    this.shakeT = 0.3;
    p.alive = false;
    this.players[i] = null;
    this.seats[i].lives -= 1;

    if (this.seats[i].lives <= 0) {
      this.seats[i].lives = 0;
      if (this.aliveSeats() <= 0) {
        this.gameOver('玩家全部出局');
        Sfx.play('gameover');
      }
      // 否则这一位彻底出局，队友继续打
    } else {
      this.respawnT[i] = CFG.TIMING.respawn;
    }
  };

  Game.prototype.gameOver = function (reason) {
    this.state = ST.GAMEOVER;
    this.overT = CFG.TIMING.gameOver;
    this.overReason = reason || '';
    if (this.score > this.best) { this.best = this.score; P.setStorage(CFG.STORAGE_KEY, String(this.best)); }
  };

  Game.prototype.destroyBase = function () {
    this.baseAlive = false;
    this.explosions.push(new Explosion({ x: this.baseX - 4, y: this.baseY - 4, big: true }));
    Sfx.play('explodeBig');
    Sfx.play('gameover');
    P.vibrate(80);
    this.shakeT = 0.5;
    this.gameOver('基地被摧毁');
  };

  /* ==================== 道具 ==================== */

  Game.prototype.dropPowerUp = function (x, y) {
    // 优先落在击毁处，其次随机找一个空砖块
    var bx = clamp(Math.round(x / CFG.BRICK) * CFG.BRICK, 0, FIELD - CFG.BRICK);
    var by = clamp(Math.round(y / CFG.BRICK) * CFG.BRICK, 0, FIELD - CFG.BRICK);
    if (this.rectBlocked(bx, by, CFG.BRICK, CFG.BRICK, null)) {
      var found = false;
      for (var i = 0; i < 40 && !found; i++) {
        var rx = RNG.int(0, 12) * CFG.BRICK;
        var ry = RNG.int(0, 12) * CFG.BRICK;
        if (!this.rectBlocked(rx, ry, CFG.BRICK, CFG.BRICK, null)) { bx = rx; by = ry; found = true; }
      }
    }
    var type = RNG.pick(POWER_TYPES);
    this.powerups.push(new PowerUp({ x: bx, y: by, type: type }));
    Sfx.play('powerupDrop');
  };

  /** 道具生效。tank 是拾取它的那位玩家（升级/护盾/加命只作用于拾取者） */
  Game.prototype.applyPowerUp = function (type, tank) {
    this.score += 500;
    Sfx.play('powerup');
    var seat = (tank && tank.pid >= 0) ? this.seats[tank.pid] : null;
    switch (type) {
      case 'star':
        if (tank) {
          tank.level = Math.min(CFG.PLAYER.maxLevel, tank.level + 1);
          tank.bulletSpeed = CFG.PLAYER.bulletSpeed[tank.level];
          if (seat) seat.level = tank.level;
        }
        break;
      case 'helmet':
        if (tank) tank.shield = Math.max(tank.shield, CFG.POWERUP.helmet);
        break;
      case 'tank':
        if (seat) seat.lives += 1;      // 加命只给拾取者
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
    // 所有玩家 + 所有敌人都算阻挡（队友之间也不能重叠）
    for (var i = 0; i < this.players.length; i++) if (chk(this.players[i])) return true;
    for (var j = 0; j < this.enemies.length; j++) if (chk(this.enemies[j])) return true;
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
