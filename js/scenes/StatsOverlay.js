import { W, H, drawText, glassPanel, drawGlowText, roundRect } from '../render/drawUtil';
import theme from '../render/theme';

/** 战绩 / 排行榜弹层 */
export default class StatsOverlay {
  constructor(databus) {
    this.databus = databus;
    this.visible = false;
    this.tab = 'stats';
    this.loading = false;
    this.stats = null;
    this.rankList = [];
    this.closeHit = null;
    this.tabHits = [];
  }

  show(tab = 'stats') {
    this.visible = true;
    this.tab = tab;
    this._layout();
    this._load();
  }

  hide() {
    this.visible = false;
  }

  async _load() {
    this.loading = true;
    const api = this.databus.api;
    try {
      const [statsRes, rankRes] = await Promise.all([
        api.getStats(),
        api.getRankList(),
      ]);
      if (statsRes.code === 0) this.stats = statsRes.data;
      if (rankRes.code === 0) this.rankList = rankRes.data || [];
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.loading = false;
    }
  }

  _layout() {
    const w = W();
    const h = H();
    this.panel = { x: w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.8 };
    this.closeHit = { x: w / 2 - 60, y: h * 0.82, w: 120, h: 40 };
    const tx = this.panel.x + 20;
    this.tabHits = [
      { key: 'stats', x: tx, y: this.panel.y + 52, w: 100, h: 32 },
      { key: 'rank', x: tx + 110, y: this.panel.y + 52, w: 100, h: 32 },
    ];
  }

  onResize() {
    if (this.visible) this._layout();
  }

  render(ctx) {
    if (!this.visible) return;
    const w = W();
    const h = H();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    glassPanel(ctx, this.panel.x, this.panel.y, this.panel.w, this.panel.h, 16);
    drawGlowText(ctx, '数据中心', w / 2, this.panel.y + 32, 22);

    this.tabHits.forEach((t) => {
      const active = this.tab === t.key;
      roundRect(ctx, t.x, t.y, t.w, t.h, 8);
      ctx.fillStyle = active ? '#c0392b' : '#34495e';
      ctx.fill();
      drawText(ctx, t.key === 'stats' ? '我的战绩' : '排行榜', t.x + t.w / 2, t.y + 16, {
        size: 13,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
      });
    });

    const contentY = this.panel.y + 100;
    if (this.loading) {
      drawText(ctx, '加载中...', w / 2, h / 2, {
        size: 16,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
      });
    } else if (this.tab === 'stats') {
      this._renderStats(ctx, contentY);
    } else {
      this._renderRank(ctx, contentY);
    }

    roundRect(ctx, this.closeHit.x, this.closeHit.y, this.closeHit.w, this.closeHit.h, 10);
    ctx.fillStyle = theme.accentBlue;
    ctx.fill();
    drawText(ctx, '关闭', w / 2, this.closeHit.y + 20, {
      size: 15,
      color: '#fff',
      align: 'center',
    });
  }

  _renderStats(ctx, y) {
    const w = W();
    const s = this.stats;
    const u = this.databus.user;
    if (!s && !u) {
      drawText(ctx, '暂无数据', w / 2, y + 40, { size: 14, color: '#95a5a6', align: 'center' });
      return;
    }
    const lines = [
      `段位  ${s?.rank || u?.rank || '-'}`,
      `积分  ${s?.rankScore ?? u?.rankScore ?? 0}`,
      `金币  ${s?.coin ?? u?.coin ?? 0}`,
      `总局  ${s?.totalGames ?? 0}  胜 ${s?.winCount ?? u?.wins ?? 0}  负 ${u?.losses ?? 0}`,
      `最大番  ${s?.maxFan ?? 0}`,
    ];
    lines.forEach((line, i) => {
      drawText(ctx, line, w / 2, y + i * 32, {
        size: 15,
        color: i === 0 ? theme.gold : '#ecf0f1',
        align: 'center',
      });
    });
  }

  _renderRank(ctx, y) {
    const w = W();
    if (!this.rankList.length) {
      drawText(ctx, '暂无排行', w / 2, y + 40, { size: 14, color: '#95a5a6', align: 'center' });
      return;
    }
    this.rankList.slice(0, 10).forEach((item, i) => {
      drawText(
        ctx,
        `${i + 1}. ${item.nickName}  ${item.rank}  积分${item.rankScore}`,
        w / 2,
        y + i * 28,
        { size: 13, color: i < 3 ? theme.goldLight : '#bdc3c7', align: 'center' },
      );
    });
  }

  onTouchEnd(x, y) {
    if (!this.visible) return false;
    if (this._hit(this.closeHit, x, y)) {
      this.hide();
      return true;
    }
    for (const t of this.tabHits) {
      if (this._hit(t, x, y) && t.key !== this.tab) {
        this.tab = t.key;
        return true;
      }
    }
    return true;
  }

  _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
