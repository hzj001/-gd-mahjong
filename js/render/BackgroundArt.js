import { W, H, fillGradientRect, fillRadial, roundRect, drawText } from './drawUtil';
import theme from './theme';

let lobbyPhase = 0;

/**
 * 程序化场景背景 — 不依赖图片资源
 */
export default class BackgroundArt {
  static tick(frame) {
    lobbyPhase = frame * 0.02;
  }

  static drawLobby(ctx) {
    const w = W();
    const h = H();
    fillGradientRect(ctx, 0, 0, w, h, '#0f1a2e', '#1a2840', false);
    fillRadial(ctx, w * 0.25, h * 0.5, h * 0.7, 'rgba(180, 120, 40, 0.12)', 'transparent');
    fillRadial(ctx, w * 0.75, h * 0.4, h * 0.5, 'rgba(200, 60, 60, 0.08)', 'transparent');

    for (let i = 0; i < 8; i++) {
      const lx = w * 0.08 + i * 45;
      const ly = h * 0.15 + Math.sin(lobbyPhase + i) * 6;
      BackgroundArt._lantern(ctx, lx, ly, 22);
    }
    for (let i = 0; i < 12; i++) {
      const px = (w * 0.2 + i * 73 + lobbyPhase * 20) % w;
      const py = h * 0.2 + Math.sin(lobbyPhase * 2 + i) * h * 0.25;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 120, ${0.15 + (i % 3) * 0.1})`;
      ctx.fill();
    }

    roundRect(ctx, w * 0.04, h * 0.1, w * 0.38, h * 0.8, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  static drawRoom(ctx) {
    const w = W();
    const h = H();
    fillGradientRect(ctx, 0, 0, w, h, '#12243a', '#1e3a52', false);
    fillRadial(ctx, w / 2, h / 2, Math.min(w, h) * 0.55, 'rgba(46, 139, 87, 0.15)', 'transparent');
    roundRect(ctx, w * 0.05, h * 0.08, w * 0.9, h * 0.84, 16);
    ctx.strokeStyle = 'rgba(255, 215, 120, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  static drawTable(ctx) {
    const w = W();
    const h = H();
    fillGradientRect(ctx, 0, 0, w, h, '#0a1520', '#142a38', false);

    const cx = w * 0.5;
    const cy = h * 0.46;
    const rx = Math.min(w, h) * 0.38;
    const ry = Math.min(w, h) * 0.3;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 28, ry + 28, 0, 0, Math.PI * 2);
    const wood = ctx.createRadialGradient(cx, cy, rx * 0.3, cx, cy, rx + 30);
    wood.addColorStop(0, theme.woodLight);
    wood.addColorStop(0.6, theme.wood);
    wood.addColorStop(1, '#3d2814');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    const felt = ctx.createRadialGradient(cx - 20, cy - 15, 10, cx, cy, rx);
    felt.addColorStop(0, theme.feltLight);
    felt.addColorStop(0.5, theme.felt);
    felt.addColorStop(1, theme.feltDark);
    ctx.fillStyle = felt;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * 18, cy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    BackgroundArt._cornerPattern(ctx, 16, 16);
    BackgroundArt._cornerPattern(ctx, w - 16, 16, true);
    BackgroundArt._cornerPattern(ctx, 16, h - 16, false, true);
    BackgroundArt._cornerPattern(ctx, w - 16, h - 16, true, true);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, 36);
    ctx.fillRect(0, h - 8, w, 8);
  }

  static _lantern(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#8b2500';
    ctx.fillRect(-1, -size, 2, size * 0.3);
    roundRect(ctx, -size / 2, -size * 0.2, size, size * 0.9, size * 0.3);
    const g = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
    g.addColorStop(0, '#c0392b');
    g.addColorStop(0.5, '#ff6b4a');
    g.addColorStop(1, '#922b21');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = theme.gold;
    ctx.fillRect(-size / 2 - 2, -size * 0.25, size + 4, 4);
    ctx.fillRect(-size / 2 - 2, size * 0.55, size + 4, 4);
    ctx.restore();
  }

  static _cornerPattern(ctx, x, y, flipX = false, flipY = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(30 + i * 8, 0);
      ctx.lineTo(0, 30 + i * 8);
      ctx.stroke();
    }
    drawText(ctx, '福', 8, 8, { size: 18, color: 'rgba(232,197,71,0.35)', bold: true });
    ctx.restore();
  }
}
