/**
 * statehash.js - 状态哈希（desync 检测用）
 *
 * 只混入「会影响后续推演」的字段。三处最容易漏、必须包含：
 *   1. 地形 grid        —— 墙被打掉的时间点不同，后面全歪
 *   2. RNG 取数次数     —— 说明某一端多/少用了一次随机数
 *   3. 每个实体的坐标   —— 浮点先转定点（*16 取整），避免 ULP 差异误报
 *
 * 渲染相关（动画计时、屏幕震动、音效）一律不进哈希——它们不影响逻辑。
 */
(function (g) {
  'use strict';

  function of(game) {
    var H = g.HASH.Hash;
    var h = new H();
    var i;

    h.int(game.stage).int(game.score)
      .int(game.queue.length).int(game.enemies.length)
      .int(game.bullets.length).int(game.powerups.length)
      .int(game.spawnedCount)
      .bool(game.baseAlive)
      .int(Math.round(game.freezeT * 16))
      .int(Math.round(game.shovelT * 16));

    if (g.RNG && g.RNG.state) h.int(g.RNG.state().count);

    for (i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      h.int(Math.round(e.x * 16)).int(Math.round(e.y * 16)).int(e.hp).str(e.dir);
    }
    for (i = 0; i < game.bullets.length; i++) {
      var b = game.bullets[i];
      h.int(Math.round(b.x * 16)).int(Math.round(b.y * 16))
        .int(b.owner === 'player' ? 1 : 0).str(b.dir || '');
    }
    for (i = 0; i < game.players.length; i++) {
      var p = game.players[i];
      if (p) h.int(Math.round(p.x * 16)).int(Math.round(p.y * 16)).int(p.hp).int(p.pid).str(p.dir);
      else h.int(-1);
    }
    for (i = 0; i < game.seats.length; i++) h.int(game.seats[i].lives).int(game.seats[i].level);

    if (game.grid) {
      for (var r = 0; r < game.grid.length; r++) {
        for (var c = 0; c < game.grid[r].length; c++) h.int(game.grid[r][c]);
      }
    }
    return h.value();
  }

  g.StateHash = { of: of };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : window));
