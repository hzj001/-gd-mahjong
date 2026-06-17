import { W, H, drawText, roundRect, glassPanel } from '../render/drawUtil';

/**
 * 二次确认弹窗
 */
export default class ConfirmDialog {
  constructor() {
    this.visible = false;
    this.opts = null;
  }

  show(opts) {
    this.visible = true;
    this.opts = {
      title: '提示',
      message: '',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => {},
      onCancel: () => {},
      ...opts,
    };
    this._layout();
  }

  hide() {
    this.visible = false;
    this.opts = null;
  }

  _layout() {
    const w = W();
    const h = H();
    const pw = Math.min(340, w * 0.55);
    const ph = 200;
    this.panel = { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
    const btnW = 120;
    const btnH = 42;
    const gap = 20;
    const total = btnW * 2 + gap;
    const bx = this.panel.x + (pw - total) / 2;
    const by = this.panel.y + ph - btnH - 24;
    this.cancelHit = { x: bx, y: by, w: btnW, h: btnH };
    this.confirmHit = { x: bx + btnW + gap, y: by, w: btnW, h: btnH };
  }

  onResize() {
    if (this.visible) this._layout();
  }

  render(ctx) {
    if (!this.visible || !this.opts) return;
    const w = W();
    const h = H();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, w, h);

    const p = this.panel;
    glassPanel(ctx, p.x, p.y, p.w, p.h, 14);
    drawText(ctx, this.opts.title, p.x + p.w / 2, p.y + 36, {
      size: 18,
      color: '#fff',
      align: 'center',
      bold: true,
    });
    drawText(ctx, this.opts.message, p.x + p.w / 2, p.y + 78, {
      size: 14,
      color: 'rgba(255,255,255,0.85)',
      align: 'center',
      baseline: 'middle',
    });

    roundRect(ctx, this.cancelHit.x, this.cancelHit.y, this.cancelHit.w, this.cancelHit.h, 8);
    ctx.fillStyle = '#5d6d7e';
    ctx.fill();
    drawText(ctx, this.opts.cancelText, this.cancelHit.x + this.cancelHit.w / 2, this.cancelHit.y + 21, {
      size: 15,
      color: '#fff',
      align: 'center',
      baseline: 'middle',
      bold: true,
    });

    roundRect(ctx, this.confirmHit.x, this.confirmHit.y, this.confirmHit.w, this.confirmHit.h, 8);
    const g = ctx.createLinearGradient(this.confirmHit.x, this.confirmHit.y, this.confirmHit.x, this.confirmHit.y + this.confirmHit.h);
    g.addColorStop(0, '#e74c3c');
    g.addColorStop(1, '#c0392b');
    ctx.fillStyle = g;
    ctx.fill();
    drawText(ctx, this.opts.confirmText, this.confirmHit.x + this.confirmHit.w / 2, this.confirmHit.y + 21, {
      size: 15,
      color: '#fff',
      align: 'center',
      baseline: 'middle',
      bold: true,
    });
  }

  onTouchEnd(x, y) {
    if (!this.visible) return false;
    if (this._in(this.cancelHit, x, y)) {
      const cb = this.opts?.onCancel;
      this.hide();
      cb?.();
      return true;
    }
    if (this._in(this.confirmHit, x, y)) {
      const cb = this.opts?.onConfirm;
      this.hide();
      cb?.();
      return true;
    }
    return true;
  }

  _in(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
