import { W, H, drawText, roundRect, glassPanel, drawGlowText } from '../render/drawUtil';
import { loadSettings, saveSettings } from '../runtime/Settings';
import theme from '../render/theme';

export default class SettingsOverlay {
  constructor() {
    this.visible = false;
    this.items = [];
  }

  show() {
    this.visible = true;
    this.settings = loadSettings();
    this._layout();
  }

  hide() {
    this.visible = false;
  }

  _layout() {
    const w = W();
    const h = H();
    const y0 = h * 0.32;
    this.items = [
      { key: 'bgm', label: '背景音乐', y: y0 },
      { key: 'sfx', label: '游戏音效', y: y0 + 52 },
      { key: 'voice', label: '方言语音', y: y0 + 104 },
    ];
    this.panel = { x: w / 2 - 160, y: h * 0.18, w: 320, h: h * 0.64 };
    this.closeHit = { x: w / 2 - 70, y: h * 0.72, w: 140, h: 44 };
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

    glassPanel(ctx, this.panel.x, this.panel.y, this.panel.w, this.panel.h, 16);
    drawGlowText(ctx, '设置', w / 2, this.panel.y + 28, 22);

    this.items.forEach((it) => {
      const on = this.settings[it.key];
      drawText(ctx, it.label, this.panel.x + 28, it.y, {
        size: 16,
        color: '#ecf0f1',
      });
      roundRect(ctx, this.panel.x + this.panel.w - 100, it.y - 6, 72, 34, 8);
      const g = ctx.createLinearGradient(0, 0, 0, 34);
      g.addColorStop(0, on ? '#27ae60' : '#7f8c8d');
      g.addColorStop(1, on ? '#1e8449' : '#566573');
      ctx.fillStyle = g;
      ctx.fill();
      drawText(ctx, on ? '开' : '关', this.panel.x + this.panel.w - 64, it.y + 10, {
        size: 14,
        color: '#fff',
        align: 'center',
        bold: true,
      });
      it.hit = {
        x: this.panel.x + this.panel.w - 100,
        y: it.y - 6,
        w: 72,
        h: 34,
        key: it.key,
      };
    });

    roundRect(ctx, this.closeHit.x, this.closeHit.y, this.closeHit.w, this.closeHit.h, 10);
    ctx.fillStyle = theme.accentBlue;
    ctx.fill();
    drawText(ctx, '关闭', w / 2, this.closeHit.y + 22, {
      size: 16,
      color: '#fff',
      align: 'center',
      baseline: 'middle',
      bold: true,
    });
  }

  onTouchEnd(x, y) {
    if (!this.visible) return false;
    for (const it of this.items) {
      if (
        x >= it.hit.x &&
        x <= it.hit.x + it.hit.w &&
        y >= it.hit.y &&
        y <= it.hit.y + it.hit.h
      ) {
        this.settings[it.key] = !this.settings[it.key];
        saveSettings({ [it.key]: this.settings[it.key] });
        if (it.key === 'bgm' && !this.settings.bgm) GameGlobal.musicManager?.stopBgm();
        return true;
      }
    }
    const c = this.closeHit;
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
      this.hide();
      return true;
    }
    return true;
  }
}
