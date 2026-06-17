import { W, H, drawText, roundRect, glassPanel, drawGlowText } from './drawUtil';
import BackgroundArt from './BackgroundArt';
import TileRenderer from './TileRenderer';
import { tileLabel } from '../constants/tiles';
import theme from './theme';

const WIND_LABEL = ['东', '南', '西', '北'];
const ACTION_STYLE = {
  draw: { label: '摸牌', bg: '#2980b9', bgEnd: '#1a5276' },
  discard: { label: '出牌', bg: '#27ae60', bgEnd: '#1e8449' },
  peng: { label: '碰', bg: '#d68910', bgEnd: '#b7950b' },
  gang: { label: '杠', bg: '#8e44ad', bgEnd: '#6c3483' },
  win: { label: '胡', bg: '#c0392b', bgEnd: '#922b21' },
  pass: { label: '过', bg: '#5d6d7e', bgEnd: '#34495e' },
};

const NAV_STYLE = {
  pause: { label: '暂停', bg: '#2980b9', bgEnd: '#1a5276' },
  resume: { label: '继续', bg: '#27ae60', bgEnd: '#1e8449' },
  abort: { label: '中止', bg: '#d68910', bgEnd: '#b7950b' },
  exit: { label: '退出', bg: '#c0392b', bgEnd: '#922b21' },
};

export default class TableRenderer {
  constructor() {
    this.handRects = [];
    this.buttons = [];
    this.navButtons = [];
  }

  render(ctx, state) {
    const { snapshot, selectedIndex, toast, actionBar, pendingReact, paused } = state;
    this.handRects = [];
    this.buttons = [];
    this.navButtons = [];

    BackgroundArt.drawTable(ctx);

    const w = W();
    const h = H();
    const cx = w * 0.5;
    const cy = h * 0.44;

    glassPanel(ctx, 12, 8, w * 0.28, 40, 10);
    drawGlowText(ctx, '粤麻 · 广东推倒胡', 12 + (w * 0.28) / 2, 18, 15);

    if (!snapshot) return;

    const humanSeat = snapshot.humanSeat;
    const human = snapshot.players[humanSeat];

    glassPanel(ctx, w / 2 - 100, 52, 200, 32, 8);
    drawText(ctx, `牌墙 ${snapshot.wallRemaining}`, w / 2, 60, {
      size: 13,
      color: theme.goldLight,
      align: 'center',
      bold: true,
    });

    if (snapshot.ghostTile) {
      glassPanel(ctx, w - 130, 52, 118, 32, 8);
      drawText(ctx, `鬼 ${tileLabel(snapshot.ghostTile)}`, w - 71, 60, {
        size: 13,
        color: '#e8daef',
        align: 'center',
        bold: true,
      });
    }

    if (snapshot.lastDiscard) {
      TileRenderer.drawTile(ctx, cx - 24, cy - 34, 48, 66, snapshot.lastDiscard, {
        lift: 4,
      });
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, cx - 50, cy + 38, 100, 22, 6);
      ctx.fill();
      drawText(ctx, '出牌区', cx, cy + 44, {
        size: 11,
        color: '#ddd',
        align: 'center',
      });
    }

    snapshot.players.forEach((p, i) => {
      if (i === humanSeat) return;
      this._drawOpponent(ctx, p, i, snapshot, humanSeat);
    });

    const handY = h * 0.72;
    const tileW = Math.min(50, (w - 80) / Math.max(human?.hand?.length || 14, 14));
    const tileH = tileW * 1.35;

    if (human?.melds?.length) {
      let mx = w / 2 - (human.melds.length * 80) / 2;
      const my = handY - 58;
      human.melds.forEach((m) => {
        m.tiles.forEach((t, ti) => {
          TileRenderer.drawTile(ctx, mx + ti * 36, my, 34, 46, t);
        });
        mx += m.tiles.length * 36 + 10;
      });
    }

    if (human?.hand) {
      this.handRects = TileRenderer.layoutHand(
        ctx,
        human.hand,
        { x: 40, y: handY, w: w - 80, h: h - handY },
        tileW,
        tileH,
        selectedIndex,
      );
    }

    const cur = snapshot.players[snapshot.current];
    if (cur) {
      glassPanel(ctx, 12, h - 52, 160, 36, 8);
      const tag = snapshot.current === humanSeat ? '轮到你了' : `${cur.name} 思考中`;
      drawText(ctx, tag, 24, h - 40, {
        size: 13,
        color: snapshot.current === humanSeat ? '#abebc6' : '#bdc3c7',
        bold: true,
      });
    }

    if (actionBar?.length) {
      this._drawActionBar(ctx, actionBar, pendingReact, handY - 56);
    }

    if (toast && !paused) {
      glassPanel(ctx, w / 2 - 140, h / 2 - 28, 280, 56, 12);
      drawText(ctx, toast, w / 2, h / 2, {
        size: 16,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
        bold: true,
      });
    }

    if (paused) this._drawPauseOverlay(ctx, w, h);
    this._drawNavBar(ctx, w, paused);
  }

  _drawPauseOverlay(ctx, w, h) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(0, 0, w, h);
    glassPanel(ctx, w / 2 - 150, h / 2 - 70, 300, 140, 16);
    drawGlowText(ctx, '游戏已暂停', w / 2, h / 2 - 28, 24);
    drawText(ctx, 'AI 与计时已冻结', w / 2, h / 2 + 8, {
      size: 14,
      color: 'rgba(255,255,255,0.75)',
      align: 'center',
    });
    drawText(ctx, '点击右上角「继续」恢复', w / 2, h / 2 + 36, {
      size: 13,
      color: theme.goldLight,
      align: 'center',
    });
  }

  _seatPosition(seat, humanSeat, w, h) {
    const rel = (seat - humanSeat + 4) % 4;
    const pad = 20;
    switch (rel) {
      case 1:
        return { side: 'right', x: w - pad - 100, y: h * 0.38, align: 'right' };
      case 2:
        return { side: 'top', x: w / 2 - 50, y: pad + 50, align: 'center' };
      case 3:
        return { side: 'left', x: pad, y: h * 0.38, align: 'left' };
      default:
        return null;
    }
  }

  _drawOpponent(ctx, p, seat, snapshot, humanSeat) {
    const pos = this._seatPosition(seat, humanSeat, W(), H());
    if (!pos) return;

    const pw = 96;
    const ph = 72;
    glassPanel(ctx, pos.x - (pos.align === 'center' ? pw / 2 : 0), pos.y, pw, ph, 10);

    const tx = pos.align === 'center' ? pos.x : pos.x + 8;
    drawText(ctx, p.name, tx, pos.y + 10, {
      size: 13,
      color: '#fff',
      align: pos.align === 'center' ? 'center' : 'left',
      bold: true,
    });
    const wind = WIND_LABEL[(seat - snapshot.dealer + 4) % 4];
    drawText(ctx, `${wind} · ${p.handCount}张`, tx, pos.y + 28, {
      size: 11,
      color: theme.gold,
      align: pos.align === 'center' ? 'center' : 'left',
    });
    drawText(ctx, `分 ${p.score}`, tx, pos.y + 46, {
      size: 11,
      color: '#aed6f1',
      align: pos.align === 'center' ? 'center' : 'left',
    });

    const discards = (p.discards || []).slice(-5);
    let dx = pos.side === 'right' ? pos.x - 150 : pos.x + pw + 8;
    let dy = pos.y + 8;
    if (pos.side === 'top') {
      dx = W() / 2 - discards.length * 16;
      dy = pos.y + ph + 8;
    }
    discards.forEach((t) => {
      TileRenderer.drawTile(ctx, dx, dy, 30, 40, t);
      dx += pos.side === 'top' ? 32 : 0;
      if (pos.side !== 'top') dy += 42;
    });
  }

  _drawActionBar(ctx, actions, isReact, barY) {
    const keys = isReact
      ? ['win', 'gang', 'peng', 'pass'].filter((k) => actions.includes(k))
      : actions.filter((k) => ACTION_STYLE[k]);

    const bw = 78;
    const gap = 12;
    const total = keys.length * bw + (keys.length - 1) * gap;
    let x = (W() - total) / 2;

    keys.forEach((key) => {
      const st = ACTION_STYLE[key];
      roundRect(ctx, x, barY, bw, 46, 10);
      const g = ctx.createLinearGradient(x, barY, x, barY + 46);
      g.addColorStop(0, st.bg);
      g.addColorStop(1, st.bgEnd);
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();
      drawText(ctx, st.label, x + bw / 2, barY + 23, {
        size: 17,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
        bold: true,
        shadow: true,
      });
      this.buttons.push({ key, x, y: barY, w: bw, h: 46 });
      x += bw + gap;
    });
  }

  hitTestHand(x, y) {
    for (let i = this.handRects.length - 1; i >= 0; i--) {
      const r = this.handRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y - 14 && y <= r.y + r.h + 8) return i;
    }
    return -1;
  }

  _drawNavBar(ctx, w, paused = false) {
    const keys = [paused ? 'resume' : 'pause', 'abort', 'exit'];
    const bw = 64;
    const bh = 34;
    const gap = 10;
    let x = w - 16 - keys.length * bw - (keys.length - 1) * gap;
    const y = 10;
    keys.forEach((key) => {
      const st = NAV_STYLE[key];
      roundRect(ctx, x, y, bw, bh, 8);
      const g = ctx.createLinearGradient(x, y, x, y + bh);
      g.addColorStop(0, st.bg);
      g.addColorStop(1, st.bgEnd);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawText(ctx, st.label, x + bw / 2, y + bh / 2, {
        size: 14,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
        bold: true,
      });
      this.navButtons.push({ key, x, y, w: bw, h: bh });
      x += bw + gap;
    });
  }

  hitTestButton(x, y) {
    for (const b of this.navButtons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.key;
    }
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.key;
    }
    return null;
  }
}
