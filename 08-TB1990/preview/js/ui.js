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
      if (game.player) this.drawTank(ctx, game, game.player);
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

      // 玩家生命
      var py = CFG.FIELD - 118;
      ctx.drawImage(S.icon.player, x0 + 20, py);
      text(ctx, '×' + Math.max(0, game.lives), x0 + 44, py + 13, { size: 16, color: '#ffe066' });

      // 关卡
      var fy = CFG.FIELD - 78;
      ctx.drawImage(S.flag, x0 + 20, fy);
      text(ctx, 'STAGE', x0 + 44, fy + 8, { size: 11, color: CFG.COLORS.dim });
      text(ctx, pad(game.stage, 2), x0 + 44, fy + 24, { size: 18, color: CFG.COLORS.text });

      // 状态图标
      var sy = CFG.FIELD - 40;
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
      if (g.__isTouch) {
        text(ctx, '左摇杆拖动移动 · 右按钮开火', CFG.W - 20, y0 + 36,
          { size: 13, color: '#8f95a3', align: 'right', cn: true });
      } else {
        text(ctx, '方向键/WASD 移动 · 空格/J 射击 · P 暂停', CFG.W - 14, y0 + 28,
          { size: 12, color: CFG.COLORS.dim, align: 'right', cn: true });
        text(ctx, '道具：升级 · 无敌 · 加命 · 清场 · 钢化 · 冻结', CFG.W - 14, y0 + 50,
          { size: 11, color: '#6f7480', align: 'right', cn: true, stroke: false });
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

    drawTitle: function (ctx, game) {
      this.dim(ctx, 1);
      var cx = CFG.W / 2;
      // 装饰坦克
      ctx.drawImage(S.tank.p1.UP[0], 60, 150, 48, 48);
      ctx.drawImage(S.tank.armor4.DOWN[0], 400, 150, 48, 48);

      text(ctx, '坦 克 大 战', cx, 120, { size: 46, align: 'center', cn: true, color: '#ffe066' });
      text(ctx, 'TANK BATTLE 1990', cx, 155, { size: 18, align: 'center', color: '#e8e8ee' });
      text(ctx, '经典复刻 · 单机战役 · 10 关', cx, 185, { size: 14, align: 'center', cn: true, color: CFG.COLORS.dim });

      // 开始按钮
      var bw = 220, bh = 54, bx = cx - bw / 2, by = 220;
      ctx.fillStyle = '#ffe066'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#c8901a'; ctx.fillRect(bx, by + bh - 5, bw, 5);
      text(ctx, '开 始 游 戏', cx, by + 36, { size: 24, align: 'center', cn: true, color: '#20222a', stroke: false });

      text(ctx, g.__isTouch ? '点击屏幕开始' : '按 空格 / Enter 开始', cx, 300,
        { size: 14, align: 'center', cn: true, color: '#b9bcc8' });

      var lines = g.__isTouch
        ? ['左下方十字键：移动', '右下方圆钮：射击', '右上角按钮：暂停 / 静音']
        : ['↑ ↓ ← → 或 W A S D：移动', '空格 / J：射击', 'P 或 ESC：暂停'];
      for (var i = 0; i < lines.length; i++) {
        text(ctx, lines[i], cx, 340 + i * 24, { size: 13, align: 'center', cn: true, color: CFG.COLORS.dim });
      }
      text(ctx, '守住基地老鹰 · 消灭全部 20 辆敌方坦克', cx, 424,
        { size: 12, align: 'center', cn: true, color: '#6f7480' });

      // 合规展示：适龄提示 + 健康游戏忠告（提审需提供截图）
      text(ctx, '适龄提示  8+    本游戏为像素风休闲射击，无社交与付费系统',
        cx, 442, { size: 10, align: 'center', cn: true, color: '#8f95a3', stroke: false });
      text(ctx, '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
        cx, 461, { size: 10, align: 'center', cn: true, color: '#7a8090', stroke: false });
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
      text(ctx, '第 ' + game.stage + ' 关 · 敌方 20 辆', cx, CFG.H / 2 + 34,
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
      text(ctx, game.baseAlive ? '坦克全部损毁' : '基地被摧毁', cx, 210,
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
