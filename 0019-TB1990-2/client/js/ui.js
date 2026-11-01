/**
 * ui.js - 全部绘制逻辑（战场 / 实体 / HUD / 界面）
 * 战场静态层做缓存，仅在地形变化时重绘，水面每帧动画。
 */
(function (g) {
  'use strict';
  var CFG = g.CFG, P = g.Platform, ST = g.GAME_ST;
  var S = null;
  var FONT_CN = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  var FONT_EN = '"Courier New",monospace';

  function text(ctx, str, x, y, opt) {
    opt = opt || {};
    var size = opt.size || 14;
    ctx.font = 'bold ' + size + 'px ' + (opt.cn ? FONT_CN : FONT_EN);
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'alphabetic';
    if (opt.stroke !== false) {
      ctx.lineWidth = opt.strokeW || 3;
      ctx.strokeStyle = opt.strokeColor || 'rgba(0,0,0,0.75)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opt.color || CFG.COLORS.text;
    ctx.fillText(str, x, y);
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  var UI = {
    fieldCache: null,
    cacheVersion: -1,

    init: function () {
      S = g.Sprites;
      this.fieldCache = P.createCanvas(CFG.FIELD, CFG.FIELD);
      this.cacheVersion = -1;
    },

    /* ==================== 主绘制 ==================== */
    draw: function (ctx, game) {
      var W = CFG.W, H = CFG.H;
      ctx.save();
      ctx.fillStyle = CFG.COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      // 屏幕震动
      if (game.shakeT > 0) {
        var mag = game.shakeT * 8;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      if (game.grid) {
        this.drawField(ctx, game);
        this.drawPowerups(ctx, game);
        this.drawBase(ctx, game);
        this.drawBullets(ctx, game);
        this.drawTanks(ctx, game);
        this.drawGrass(ctx, game);
        this.drawExplosions(ctx, game);
      }
      this.drawPanel(ctx, game);
      this.drawBottom(ctx, game);
      ctx.restore();

      this.drawOverlay(ctx, game);
    },

    /* ---------- 战场 ---------- */
    drawField: function (ctx, game) {
      var F = CFG.FIELD, TILE = CFG.TILE, GRID = CFG.GRID;
      var grid = game.grid;
      if (this.cacheVersion !== game.gridVersion) {
        var c = this.fieldCache, cx = c.getContext('2d');
        cx.fillStyle = CFG.COLORS.field;
        cx.fillRect(0, 0, F, F);
        for (var r = 0; r < GRID; r++) {
          for (var col = 0; col < GRID; col++) {
            var t = grid[r][col];
            if (t === CFG.T_BRICK) cx.drawImage(S.terrain.brick, col * TILE, r * TILE);
            else if (t === CFG.T_STEEL) cx.drawImage(S.terrain.steel, col * TILE, r * TILE);
            else if (t === CFG.T_ICE) cx.drawImage(S.terrain.ice, col * TILE, r * TILE);
          }
        }
        this.cacheVersion = game.gridVersion;
      }
      ctx.drawImage(this.fieldCache, 0, 0);

      // 水面动画
      var wf = Math.floor(game.time * 3) % 2;
      for (var rr = 0; rr < GRID; rr++) {
        for (var cc = 0; cc < GRID; cc++) {
          if (grid[rr][cc] === CFG.T_WATER) ctx.drawImage(S.terrain.water[wf], cc * TILE, rr * TILE);
        }
      }
    },

    drawBase: function (ctx, game) {
      var img = game.baseAlive ? S.eagle : S.eagleDead;
      ctx.drawImage(img, game.baseX, game.baseY);
    },

    drawGrass: function (ctx, game) {
      if (!game.grass) return;
      for (var r = 0; r < 13; r++) {
        for (var c = 0; c < 13; c++) {
          if (game.grass[r][c]) ctx.drawImage(S.terrain.grass, c * CFG.BRICK, r * CFG.BRICK);
        }
      }
    },

    drawPowerups: function (ctx, game) {
      for (var i = 0; i < game.powerups.length; i++) {
        var pu = game.powerups[i];
        if (!pu.visible()) continue;
        ctx.drawImage(S.powerup[pu.type], pu.x, pu.y);
      }
    },

    drawBullets: function (ctx, game) {
      for (var i = 0; i < game.bullets.length; i++) {
        var b = game.bullets[i];
        ctx.fillStyle = b.owner === 'player' ? '#ffffff' : '#ffd9a0';
        ctx.fillRect(b.x, b.y, b.size, b.size);
        ctx.fillStyle = b.owner === 'player' ? '#ffe066' : '#ff8a3c';
        ctx.fillRect(b.x + 2, b.y + 2, b.size - 4, b.size - 4);
      }
    },

    drawTanks: function (ctx, game) {
      var i;
      for (i = 0; i < game.enemies.length; i++) this.drawTank(ctx, game, game.enemies[i]);
      for (i = 0; i < game.players.length; i++) {
        if (game.players[i]) this.drawTank(ctx, game, game.players[i]);
      }
    },

    drawTank: function (ctx, game, tank) {
      if (tank.spawnT > 0) {
        var fi = Math.floor((CFG.TIMING.spawnStar - tank.spawnT) * 12) % 4;
        ctx.drawImage(S.star[fi], tank.x, tank.y);
        return;
      }
      var set = S.tank[tank.spriteKey()] || S.tank.basic;
      var img = set[tank.dir][tank.frame];
      ctx.drawImage(img, tank.x, tank.y);

      // 携带道具的敌人闪烁
      if (tank.carrying && Math.floor(game.time * 8) % 2 === 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, tank.x, tank.y);
        ctx.restore();
      }
      // 冻结状态
      if (tank.frozen || game.freezeT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#5fc8ff';
        ctx.fillRect(tank.x, tank.y, tank.size, tank.size);
        ctx.restore();
      }
      // 护盾
      if (tank.shield > 0) {
        ctx.save();
        ctx.lineWidth = 2;
        if (Math.floor(game.time * 10) % 2 === 0) {
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(tank.x - 1.5, tank.y - 1.5, 35, 35);
        } else {
          ctx.strokeStyle = '#ffe066';
          ctx.strokeRect(tank.x + 4.5, tank.y + 4.5, 23, 23);
        }
        ctx.restore();
      }
    },

    drawExplosions: function (ctx, game) {
      for (var i = 0; i < game.explosions.length; i++) {
        var e = game.explosions[i];
        var idx = e.frameIndex();
        var img = S.explode[e.big ? idx : Math.min(idx, 1)];
        var size = img.width;
        ctx.drawImage(img, e.x + 8 - size / 2, e.y + 8 - size / 2);
      }
    },

    /* ---------- 右侧信息栏 ---------- */
    drawPanel: function (ctx, game) {
      var x0 = CFG.FIELD, w = CFG.PANEL_W;
      ctx.fillStyle = CFG.COLORS.panel;
      ctx.fillRect(x0, 0, w, CFG.FIELD);
      ctx.strokeStyle = CFG.COLORS.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 + 1, 0); ctx.lineTo(x0 + 1, CFG.FIELD);
      ctx.stroke();

      // 剩余敌人图标（2 列）
      var left = game.enemiesLeft();
      var cols = [x0 + 22, x0 + 56];
      var y = 16;
      for (var i = 0; i < left; i++) {
        var cx = cols[i % 2], cy = y + Math.floor(i / 2) * 17;
        if (cy > CFG.FIELD - 130) break;
        ctx.drawImage(S.icon.enemy, cx, cy);
      }

      // 玩家生命：双人时上下两行，各自颜色与场上坦克一致
      var coop = game.mode === CFG.MODE_COOP;
      var py = coop ? CFG.FIELD - 128 : CFG.FIELD - 118;
      for (var k = 0; k < game.seats.length; k++) {
        var iy = py + k * 24;
        var ic = k === 1 ? S.icon.player2 : S.icon.player;
        ctx.drawImage(ic, x0 + 20, iy);
        var lv = Math.max(0, game.seats[k].lives);
        text(ctx, '×' + lv, x0 + 44, iy + 13, {
          size: 15,
          color: lv > 0 ? (k === 1 ? '#4ade80' : '#ffe066') : '#5a5d68'
        });
      }

      // 关卡
      var fy = coop ? CFG.FIELD - 66 : CFG.FIELD - 78;
      ctx.drawImage(S.flag, x0 + 20, fy);
      text(ctx, 'STAGE', x0 + 44, fy + 8, { size: 11, color: CFG.COLORS.dim });
      text(ctx, pad(game.stage, 2), x0 + 44, fy + 24, { size: 18, color: CFG.COLORS.text });

      // 状态图标
      var sy = CFG.FIELD - 36;
      if (game.freezeT > 0) ctx.drawImage(S.powerup.clock, x0 + 8, sy, 24, 24);
      if (game.shovelT > 0) ctx.drawImage(S.powerup.shovel, x0 + 36, sy, 24, 24);
    },

    /* ---------- 底部状态条 ---------- */
    drawBottom: function (ctx, game) {
      var y0 = CFG.FIELD, H = CFG.BOTTOM_H;
      ctx.fillStyle = '#101116';
      ctx.fillRect(0, y0, CFG.W, H);
      ctx.strokeStyle = CFG.COLORS.border;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y0 + 1); ctx.lineTo(CFG.W, y0 + 1); ctx.stroke();

      text(ctx, 'SCORE', 14, y0 + 22, { size: 11, color: CFG.COLORS.dim });
      text(ctx, pad(game.score, 6), 14, y0 + 44, { size: 20, color: '#ffe066' });
      text(ctx, 'HI-SCORE', 150, y0 + 22, { size: 11, color: CFG.COLORS.dim });
      text(ctx, pad(Math.max(game.best, game.score), 6), 150, y0 + 44, { size: 20, color: '#ff8a3c' });

      // 触摸端底部空间窄、缩放后字号小，只留一行精简提示，避免挤成一团
      var net = g.__netInfo ? g.__netInfo() : null;
      if (net) {
        // 联机局：显示房号与延迟，比操作提示有用得多
        var line = '房间 ' + (net.code || '----') + ' · ' + (net.slot === 0 ? 'P1 黄' : 'P2 绿')
          + ' · 延迟 ' + (net.rtt || 0) + 'ms';
        text(ctx, line, CFG.W - 20, y0 + 36,
          { size: 12, color: '#8fb6ff', align: 'right', cn: true });
      } else if (g.__isTouch) {
        var tip = game.mode === CFG.MODE_COOP
          ? '左摇杆 P1 黄 · 右摇杆 P2 绿 · 各自开火'
          : '左摇杆拖动移动 · 右按钮开火';
        text(ctx, tip, CFG.W - 20, y0 + 36,
          { size: 13, color: '#8f95a3', align: 'right', cn: true });
      } else {
        if (game.mode === CFG.MODE_COOP) {
          // 注意别写长：底部条右侧只有约 230px，写长了会压到 HI-SCORE 数字上
          text(ctx, 'P1  WASD+J     P2  方向键+空格', CFG.W - 14, y0 + 30,
            { size: 12, color: CFG.COLORS.dim, align: 'right', cn: true });
          text(ctx, '两人合作 · 守住老鹰 · P 暂停', CFG.W - 14, y0 + 52,
            { size: 11, color: '#6f7480', align: 'right', cn: true, stroke: false });
        } else {
          text(ctx, '方向键/WASD 移动 · 空格/J 射击 · P 暂停', CFG.W - 14, y0 + 28,
            { size: 12, color: CFG.COLORS.dim, align: 'right', cn: true });
          text(ctx, '道具：升级 · 无敌 · 加命 · 清场 · 钢化 · 冻结', CFG.W - 14, y0 + 50,
            { size: 11, color: '#6f7480', align: 'right', cn: true, stroke: false });
        }
      }
    },

    /* ---------- 界面覆盖层 ---------- */
    drawOverlay: function (ctx, game) {
      var W = CFG.W, H = CFG.H;
      switch (game.state) {
        case ST.TITLE: this.drawTitle(ctx, game); break;
        case ST.INTRO: this.drawStageIntro(ctx, game); break;
        case ST.PAUSED: this.drawPause(ctx, game); break;
        case ST.CLEAR: this.drawClear(ctx, game); break;
        case ST.GAMEOVER: this.drawGameOver(ctx, game); break;
        case ST.WIN: this.drawWin(ctx, game); break;
        default: break;
      }
    },

    dim: function (ctx, alpha) {
      ctx.fillStyle = 'rgba(6,7,12,' + (alpha === undefined ? 0.82 : alpha) + ')';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    },

    /** 标题页按钮坐标（逻辑坐标系 512x480），main.js 用它做点击命中 */
    titleLayout: function () {
      return {
        p1: { x: 88, y: 150, w: 156, h: 46 },
        p2: { x: 268, y: 150, w: 156, h: 46 },
        start: { x: 88, y: 206, w: 156, h: 50 },
        online: { x: 268, y: 206, w: 156, h: 50 }
      };
    },

    /** 返回 'p1' | 'p2' | 'online' | 'start' | null */
    titleHit: function (x, y) {
      var L = this.titleLayout();
      function inside(b) { return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h; }
      if (inside(L.p1)) return 'p1';
      if (inside(L.p2)) return 'p2';
      if (inside(L.online)) return 'online';
      if (inside(L.start)) return 'start';
      return null;
    },

    drawTitle: function (ctx, game) {
      this.dim(ctx, 1);
      var cx = CFG.W / 2;
      var L = this.titleLayout();
      var coop = game.mode === CFG.MODE_COOP;

      // 装饰坦克：必须按整数倍（2x = 64px）绘制，非整数倍会让 32px 像素错位发糊
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(S.tank.p1.UP[0], 40, 112, 64, 64);
      ctx.drawImage(S.tank.q1.UP[0], 408, 112, 64, 64);

      text(ctx, '坦 克 大 战', cx, 100, { size: 42, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, 'TANK BATTLE 1990', cx, 128, { size: 16, align: 'center', color: '#e8e8ee' });

      // ---- 人数选择 ----
      this.modeButton(ctx, L.p1, '1 人', '单独闯关', !coop, '#ffe066');
      this.modeButton(ctx, L.p2, '2 人同屏', '合作守家', coop, '#4ade80');

      // ---- 开始 / 联机 ----
      var s = L.start, o = L.online;
      ctx.fillStyle = '#ffe066'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#c8901a'; ctx.fillRect(s.x, s.y + s.h - 5, s.w, 5);
      text(ctx, '本 地 开 始', s.x + s.w / 2, s.y + 33, { size: 21, align: 'center', cn: true, color: '#20222a', stroke: false });

      ctx.fillStyle = '#2a3550'; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.lineWidth = 2; ctx.strokeStyle = '#5b9cff'; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      ctx.fillStyle = '#3f6fbf'; ctx.fillRect(o.x, o.y + o.h - 5, o.w, 5);
      text(ctx, '在 线 联 机', o.x + o.w / 2, o.y + 33, { size: 20, align: 'center', cn: true, color: '#dce8ff', stroke: false });

      text(ctx, g.__isTouch ? '点「在线联机」用房号和朋友各用一台手机一起打'
        : '空格 / Enter 开始 · ← → 换人数 · 点「在线联机」开房',
        cx, 276, { size: 12, align: 'center', cn: true, color: '#b9bcc8' });

      // ---- 操作说明 ----
      var lines;
      if (!coop) {
        lines = g.__isTouch
          ? ['左下摇杆：按住拖向任意方向移动', '右下橙色按钮：按住连发', '右上角按钮：暂停 / 静音']
          : ['↑ ↓ ← → 或 W A S D：移动', '空格 / J：射击', 'P 或 ESC：暂停'];
      } else if (g.__isTouch) {
        lines = [
          '横屏最佳：左边黄色摇杆控 P1，右边绿色摇杆控 P2',
          '各自按自己那侧上方的开火键，两人一起守家',
          '一人命耗尽后由队友继续，两人都倒下才算输'
        ];
      } else {
        lines = [
          'P1 黄：W A S D 移动，J / F 开火',
          'P2 绿：↑ ↓ ← → 移动，空格 开火',
          '两人各 3 条命，共享基地，一人倒下队友顶上'
        ];
      }
      for (var i = 0; i < lines.length; i++) {
        text(ctx, lines[i], cx, 312 + i * 24, { size: 13, align: 'center', cn: true, color: CFG.COLORS.dim });
      }

      var total = coop ? CFG.ENEMY.totalCoop : CFG.ENEMY.total;
      text(ctx, '目标：守住基地老鹰，消灭全部 ' + total + ' 辆敌方坦克',
        cx, 392, { size: 12, align: 'center', cn: true, color: '#6f7480' });

      // 合规展示：适龄提示 + 健康游戏忠告（提审需提供截图）
      text(ctx, '适龄提示  8+    本游戏为像素风休闲射击，无社交与付费系统',
        cx, 420, { size: 10, align: 'center', cn: true, color: '#8f95a3', stroke: false });
      text(ctx, '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
        cx, 443, { size: 10, align: 'center', cn: true, color: '#7a8090', stroke: false });
    },

    /** 标题页人数按钮：选中态用主色填充，未选中用暗底 + 灰字 */
    modeButton: function (ctx, b, title, sub, on, color) {
      ctx.fillStyle = on ? color : '#1b1d24';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = on ? color : '#3a3d47';
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

      text(ctx, title, b.x + b.w / 2, b.y + 24, {
        size: 19, align: 'center', cn: true,
        color: on ? '#20222a' : '#c8ccd8', stroke: !on
      });
      text(ctx, sub, b.x + b.w / 2, b.y + 40, {
        size: 10, align: 'center', cn: true,
        color: on ? 'rgba(32,34,42,0.72)' : '#6f7480', stroke: false
      });
    },

    drawStageIntro: function (ctx, game) {
      this.dim(ctx, 0.94);
      var cx = CFG.W / 2;
      var t = game.introT;
      // 经典黑屏过场：上下黑边收拢
      var p = Math.min(1, t / CFG.TIMING.stageIntro);
      ctx.fillStyle = '#000';
      var bar = 120 * p;
      ctx.fillRect(0, 0, CFG.W, bar);
      ctx.fillRect(0, CFG.H - bar, CFG.W, bar);
      text(ctx, 'STAGE ' + pad(game.stage, 2), cx, CFG.H / 2, { size: 44, align: 'center', color: '#ffe066' });
      var sub = '第 ' + game.stage + ' 关 · 敌方 ' + game.enemyTotal() + ' 辆';
      if (game.mode === CFG.MODE_COOP) sub += ' · 双人合作';
      text(ctx, sub, cx, CFG.H / 2 + 34,
        { size: 14, align: 'center', cn: true, color: CFG.COLORS.dim });
    },

    drawPause: function (ctx, game) {
      this.dim(ctx, 0.7);
      var cx = CFG.W / 2;
      text(ctx, '暂 停', cx, CFG.H / 2 - 10, { size: 40, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, g.__isTouch ? '点击屏幕继续' : '按 P 或 空格 继续', cx, CFG.H / 2 + 30,
        { size: 14, align: 'center', cn: true, color: CFG.COLORS.dim });
    },

    drawClear: function (ctx, game) {
      this.dim(ctx, 0.85);
      var cx = CFG.W / 2, y = 90;
      text(ctx, 'STAGE ' + pad(game.stage, 2) + ' CLEAR', cx, y, { size: 30, align: 'center', color: '#ffe066' });
      y += 40;
      text(ctx, '— 战 果 统 计 —', cx, y, { size: 14, align: 'center', cn: true, color: CFG.COLORS.dim });
      y += 32;
      var rows = [
        { n: '普通坦克', v: game.kills.basic, p: 100 },
        { n: '快速坦克', v: game.kills.fast, p: 200 },
        { n: '火力坦克', v: game.kills.power, p: 300 },
        { n: '装甲坦克', v: game.kills.armor, p: 400 }
      ];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        ctx.drawImage(S.icon.enemy, cx - 130, y + i * 28 - 13);
        text(ctx, r.n, cx - 105, y + i * 28, { size: 14, cn: true, color: '#d8dae2' });
        text(ctx, r.v + ' 辆', cx + 20, y + i * 28, { size: 14, align: 'right', cn: true, color: '#ffffff' });
        text(ctx, r.p * r.v + ' 分', cx + 120, y + i * 28, { size: 14, align: 'right', cn: true, color: '#ffe066' });
      }
      y += 4 * 28 + 30;
      text(ctx, '本关得分  ' + (game.score - game.lastStageScore), cx, y, { size: 16, align: 'center', cn: true, color: '#ffffff' });
      text(ctx, '总分  ' + pad(game.score, 6), cx, y + 28, { size: 18, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, g.__isTouch ? '点击继续' : '按 空格 继续', cx, CFG.H - 60,
        { size: 13, align: 'center', cn: true, color: CFG.COLORS.dim });
    },

    drawGameOver: function (ctx, game) {
      this.dim(ctx, 0.85);
      var cx = CFG.W / 2;
      text(ctx, 'GAME OVER', cx, 170, { size: 46, align: 'center', color: '#ff5a4a' });
      var why = game.overReason || (!game.baseAlive ? '基地被摧毁' : '坦克全部损毁');
      text(ctx, why, cx, 210,
        { size: 15, align: 'center', cn: true, color: CFG.COLORS.dim });
      text(ctx, '总分  ' + pad(game.score, 6), cx, 268, { size: 22, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, 'HI-SCORE  ' + pad(game.best, 6), cx, 300, { size: 14, align: 'center', color: '#ff8a3c' });
      if (game.overT <= 0) {
        text(ctx, g.__isTouch ? '点击返回标题' : '按 空格 返回标题', cx, 360,
          { size: 14, align: 'center', cn: true, color: '#b9bcc8' });
      }
    },

    drawWin: function (ctx, game) {
      this.dim(ctx, 0.88);
      var cx = CFG.W / 2;
      text(ctx, '全 部 通 关', cx, 160, { size: 42, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, 'CONGRATULATIONS!', cx, 200, { size: 16, align: 'center', color: '#e8e8ee' });
      text(ctx, '总分  ' + pad(game.score, 6), cx, 266, { size: 22, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, 'HI-SCORE  ' + pad(game.best, 6), cx, 298, { size: 14, align: 'center', color: '#ff8a3c' });
      if (game.overT <= 0) {
        text(ctx, g.__isTouch ? '点击返回标题' : '按 空格 返回标题', cx, 360,
          { size: 14, align: 'center', cn: true, color: '#b9bcc8' });
      }
    }
  };

  g.UI = UI;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
