import { W, H, drawText, glassPanel, drawGlowText, roundRect } from '../render/drawUtil';
import theme from '../render/theme';

/** 简易文本输入弹层（用于输入房间号等） */
export default class PromptOverlay {
  constructor() {
    this.visible = false;
    this.title = '';
    this.value = '';
    this.placeholder = '';
    this._onConfirm = null;
    this._onCancel = null;
  }

  show({ title, placeholder = '', defaultValue = '', onConfirm, onCancel }) {
    this.visible = true;
    this.title = title;
    this.placeholder = placeholder;
    this.value = defaultValue;
    this._onConfirm = onConfirm;
    this._onCancel = onCancel;
    this._layout();
  }

  hide() {
    this.visible = false;
  }

  _layout() {
    const w = W();
    const h = H();
    this.panel = { x: w / 2 - 180, y: h * 0.2, w: 360, h: 300 };
    this.inputHit = { x: this.panel.x + 24, y: this.panel.y + 56, w: this.panel.w - 48, h: 44 };
    this.confirmHit = { x: w / 2 - 150, y: this.panel.y + 240, w: 130, h: 40 };
    this.cancelHit = { x: w / 2 + 20, y: this.panel.y + 240, w: 130, h: 40 };
    this.keys = [];
    const keyW = 36;
    const keyH = 32;
    const rows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['R', '⌫'],
    ];
    let y = this.panel.y + 112;
    rows.forEach((row) => {
      let x = this.panel.x + 24;
      row.forEach((k) => {
        const wk = k === '⌫' ? 72 : keyW;
        this.keys.push({ key: k, x, y, w: wk, h: keyH });
        x += wk + 6;
      });
      y += keyH + 6;
    });
  }

  onResize() {
    if (this.visible) this._layout();
  }

  render(ctx) {
    if (!this.visible) return;
    const w = W();
    const h = H();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, h);

    glassPanel(ctx, this.panel.x, this.panel.y, this.panel.w, this.panel.h, 14);
    drawGlowText(ctx, this.title, w / 2, this.panel.y + 32, 20);

    roundRect(ctx, this.inputHit.x, this.inputHit.y, this.inputHit.w, this.inputHit.h, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    const display = this.value || this.placeholder;
    drawText(ctx, display, this.inputHit.x + 12, this.inputHit.y + 22, {
      size: 16,
      color: this.value ? '#fff' : 'rgba(255,255,255,0.4)',
    });

    this.keys.forEach((k) => {
      roundRect(ctx, k.x, k.y, k.w, k.h, 6);
      ctx.fillStyle = k.key === '⌫' ? '#c0392b' : '#34495e';
      ctx.fill();
      drawText(ctx, k.key, k.x + k.w / 2, k.y + k.h / 2, {
        size: 14,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
      });
    });

    roundRect(ctx, this.confirmHit.x, this.confirmHit.y, this.confirmHit.w, this.confirmHit.h, 8);
    ctx.fillStyle = '#27ae60';
    ctx.fill();
    drawText(ctx, '确定', this.confirmHit.x + this.confirmHit.w / 2, this.confirmHit.y + 20, {
      size: 15,
      color: '#fff',
      align: 'center',
    });

    roundRect(ctx, this.cancelHit.x, this.cancelHit.y, this.cancelHit.w, this.cancelHit.h, 8);
    ctx.fillStyle = '#5d6d7e';
    ctx.fill();
    drawText(ctx, '取消', this.cancelHit.x + this.cancelHit.w / 2, this.cancelHit.y + 20, {
      size: 15,
      color: '#fff',
      align: 'center',
    });
  }

  onTouchEnd(x, y) {
    if (!this.visible) return false;

    if (this._hit(this.confirmHit, x, y)) {
      this.hide();
      this._onConfirm?.(this.value.trim());
      return true;
    }
    if (this._hit(this.cancelHit, x, y)) {
      this.hide();
      this._onCancel?.();
      return true;
    }
    for (const k of this.keys) {
      if (this._hit(k, x, y)) {
        if (k.key === '⌫') this.value = this.value.slice(0, -1);
        else if (this.value.length < 12) this.value += k.key;
        return true;
      }
    }
    return true;
  }

  _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
