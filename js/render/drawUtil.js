/** 当前布局尺寸（横屏，随窗口变化） */
export function W() {
  return GameGlobal.layout?.width ?? 667;
}

export function H() {
  return GameGlobal.layout?.height ?? 375;
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function fillGradientRect(ctx, x, y, w, h, c1, c2, vertical = true) {
  const g = vertical
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

export function fillRadial(ctx, cx, cy, r, inner, outer) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawText(ctx, text, x, y, opts = {}) {
  const {
    size = 14,
    color = '#fff',
    align = 'left',
    baseline = 'top',
    bold = false,
    shadow = false,
  } = opts;
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 毛玻璃面板 */
export function glassPanel(ctx, x, y, w, h, radius = 14) {
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = 'rgba(20, 30, 48, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 215, 120, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawGlowText(ctx, text, x, y, size, color = '#ffd56a') {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  drawText(ctx, text, x, y, { size, color, align: 'center', bold: true });
  ctx.restore();
}
