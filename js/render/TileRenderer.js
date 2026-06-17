import { roundRect, drawText } from './drawUtil';
import { tileLabel } from '../constants/tiles';
import theme from './theme';

const SUIT_COLORS = {
  w: '#c0392b',
  t: '#2471a3',
  b: '#1e8449',
  honor: '#5d4037',
  ghost: '#8e44ad',
};

const SUIT_STRIPE = {
  w: '#e74c3c',
  t: '#3498db',
  b: '#27ae60',
  honor: '#d4af37',
  ghost: '#9b59b6',
};

export default class TileRenderer {
  static drawTile(ctx, x, y, w, h, code, opts = {}) {
    const { selected = false, faceDown = false, dim = false, lift = 0 } = opts;
    const ty = y - (selected ? 10 : lift);
    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(255, 213, 74, 0.9)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = -4;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
    }

    roundRect(ctx, x, ty, w, h, Math.min(8, w * 0.15));
    if (faceDown) {
      const g = ctx.createLinearGradient(x, ty, x + w, ty + h);
      g.addColorStop(0, '#1a5276');
      g.addColorStop(1, '#0d3349');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = theme.goldDark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      roundRect(ctx, x + 4, ty + 4, w - 8, h - 8, 4);
      ctx.fillStyle = 'rgba(255,215,120,0.15)';
      ctx.fill();
    } else {
      const g = ctx.createLinearGradient(x, ty, x + w, ty + h);
      g.addColorStop(0, dim ? '#ddd' : theme.ivory);
      g.addColorStop(1, dim ? '#bbb' : theme.ivoryShadow);
      ctx.fillStyle = g;
      ctx.fill();
      const suit = code === 'ghost' ? 'ghost' : code?.slice(-1);
      const stripe = SUIT_STRIPE[suit] || SUIT_STRIPE.honor;
      ctx.fillStyle = stripe;
      ctx.fillRect(x + 3, ty + 3, 5, h - 6);
      ctx.strokeStyle = theme.goldDark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (code === 'ghost') {
        ctx.fillStyle = 'rgba(142, 68, 173, 0.25)';
        roundRect(ctx, x + 2, ty + 2, w - 4, h - 4, 6);
        ctx.fill();
      }
      const color = SUIT_COLORS[suit] || SUIT_COLORS.honor;
      drawText(ctx, tileLabel(code), x + w / 2 + 2, ty + h / 2, {
        size: Math.max(11, w * 0.36),
        color,
        align: 'center',
        baseline: 'middle',
        bold: true,
        shadow: true,
      });
    }
    ctx.restore();
    return { x, y: ty, w, h, code };
  }

  static layoutHand(ctx, tiles, area, tileW, tileH, selectedIndex = -1) {
    const { x, y, w, h } = area;
    const gap = 3;
    const totalW = tiles.length * (tileW + gap) - gap;
    let startX = x + (w - totalW) / 2;
    const rects = [];
    tiles.forEach((code, i) => {
      const tx = startX + i * (tileW + gap);
      const ty = y + h - tileH - 6;
      const sel = i === selectedIndex;
      if (!sel) {
        TileRenderer.drawTile(ctx, tx, ty, tileW, tileH, code, { lift: 0 });
      }
      rects.push({ x: tx, y: ty, w: tileW, h: tileH, code, index: i });
    });
    if (selectedIndex >= 0 && rects[selectedIndex]) {
      const r = rects[selectedIndex];
      TileRenderer.drawTile(ctx, r.x, r.y, r.w, r.h, r.code, { selected: true });
    }
    return rects;
  }
}
