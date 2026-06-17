import { roundRect, drawText } from '../render/drawUtil';
import theme from '../render/theme';

export default class Button {
  constructor(x, y, w, h, label, opts = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.bg = opts.bg || theme.accentBlue;
    this.bgEnd = opts.bgEnd || this._darken(this.bg);
    this.color = opts.color || '#fff';
    this.key = opts.key || label;
    this.visible = true;
    this.icon = opts.icon || '';
  }

  _darken(hex) {
    return hex;
  }

  render(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, this.x, this.y, this.w, this.h, 12);
    const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    g.addColorStop(0, this.bg);
    g.addColorStop(1, this.bgEnd || this.bg);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const label = this.icon ? `${this.icon} ${this.label}` : this.label;
    drawText(ctx, label, this.x + this.w / 2, this.y + this.h / 2, {
      size: Math.min(17, this.h * 0.38),
      color: this.color,
      align: 'center',
      baseline: 'middle',
      bold: true,
      shadow: true,
    });
  }

  hitTest(x, y) {
    return (
      this.visible &&
      x >= this.x &&
      x <= this.x + this.w &&
      y >= this.y &&
      y <= this.y + this.h
    );
  }
}
