import BaseScene from './BaseScene';
import Button from '../ui/Button';
import { W, H, drawText, glassPanel, drawGlowText, roundRect } from '../render/drawUtil';
import BackgroundArt from '../render/BackgroundArt';
import theme from '../render/theme';

export default class LobbyScene extends BaseScene {
  constructor(databus) {
    super('lobby');
    this.databus = databus;
    this.buttons = [];
    this.loading = false;
    this.backendStatus = '';
  }

  enter() {
    GameGlobal.musicManager?.onUserInteract?.();
    GameGlobal.musicManager?.playBgm('lobby');
    this._layoutButtons();
    this._refreshProfile();
    this._checkBackend();
  }

  async _refreshProfile() {
    if (!this.databus.user || this.databus.api.useMock) return;
    const u = await this.databus.api.refreshProfile();
    if (u) this.databus.user = u;
  }

  async _checkBackend() {
    if (this.databus.api.useMock) {
      this.backendStatus = 'Mock 单机';
      return;
    }
    const res = await this.databus.api.checkHealth();
    this.backendStatus = res.code === 0 ? '联机模式' : '后端离线';
  }

  onResize() {
    this._layoutButtons();
  }

  _layoutButtons() {
    const w = W();
    const h = H();
    const panelX = w * 0.52;
    const btnW = Math.min(240, w * 0.38);
    const btnH = 46;
    const gap = 14;
    const y0 = h * 0.18;
    this.buttons = [
      new Button(panelX, y0, btnW, btnH, '快速开始', {
        key: 'quick',
        bg: '#c0392b',
        bgEnd: '#922b21',
        icon: '⚡',
      }),
      new Button(panelX, y0 + (btnH + gap), btnW, btnH, '创建房间', {
        key: 'create',
        bg: '#2471a3',
        bgEnd: '#1a5276',
        icon: '＋',
      }),
      new Button(panelX, y0 + (btnH + gap) * 2, btnW, btnH, '加入房间', {
        key: 'join',
        bg: '#1e8449',
        bgEnd: '#145a32',
        icon: '⌁',
      }),
      new Button(panelX, y0 + (btnH + gap) * 3, btnW, btnH, '我的战绩', {
        key: 'stats',
        bg: '#8e44ad',
        bgEnd: '#6c3483',
        icon: '★',
      }),
      new Button(panelX, y0 + (btnH + gap) * 4, btnW, btnH, '设置', {
        key: 'settings',
        bg: '#5d6d7e',
        bgEnd: '#34495e',
        icon: '⚙',
      }),
    ];
  }

  render(ctx) {
    BackgroundArt.drawLobby(ctx);
    const w = W();
    const h = H();

    glassPanel(ctx, w * 0.05, h * 0.12, w * 0.42, h * 0.76, 18);
    drawGlowText(ctx, '粤麻', w * 0.26, h * 0.28, 42);
    drawText(ctx, '广东推倒胡', w * 0.26, h * 0.4, {
      size: 20,
      color: theme.goldLight,
      align: 'center',
    });
    drawText(ctx, '经典横屏 · 原汁原味', w * 0.26, h * 0.48, {
      size: 13,
      color: 'rgba(255,255,255,0.55)',
      align: 'center',
    });

    const u = this.databus.user;
    if (u) {
      const cardX = w * 0.08;
      const cardY = h * 0.56;
      const cardW = w * 0.36;
      glassPanel(ctx, cardX, cardY, cardW, 94, 12);
      this._drawAvatar(ctx, u, cardX + 42, cardY + 47, 28);
      drawText(ctx, u.nickName, cardX + 84, cardY + 18, {
        size: 16,
        color: '#fff',
        bold: true,
      });
      drawText(ctx, `${u.rank}  ·  金币 ${u.coin}`, cardX + 84, cardY + 44, {
        size: 12,
        color: theme.gold,
      });
      if (u.rankScore != null) {
        const wl = u.wins != null ? `  胜${u.wins}负${u.losses || 0}` : '';
        drawText(ctx, `积分 ${u.rankScore}${wl}`, cardX + 84, cardY + 68, {
          size: 11,
          color: 'rgba(255,255,255,0.55)',
        });
      }
    } else if (this.databus.loginError) {
      drawText(ctx, '登录失败，请重启', w * 0.26, h * 0.65, {
        size: 13,
        color: '#e74c3c',
        align: 'center',
      });
    }

    glassPanel(ctx, w * 0.5, h * 0.08, w * 0.44, h * 0.84, 16);
    this.buttons.forEach((b) => b.render(ctx));

    if (this.loading) {
      drawText(ctx, '加载中...', w * 0.72, h * 0.5, {
        size: 16,
        color: '#fff',
        align: 'center',
        baseline: 'middle',
      });
    }

    const statusColor =
      this.backendStatus === '后端离线' ? '#e74c3c' : 'rgba(255,255,255,0.35)';
    drawText(ctx, this.backendStatus || '', w - 16, h - 14, {
      size: 10,
      color: statusColor,
      align: 'right',
    });
  }

  _drawAvatar(ctx, user, cx, cy, r) {
    ctx.save();
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#2471a3');
    grad.addColorStop(1, '#1e8449');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.goldLight;
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, cx - r * 0.58, cy + r * 0.12, r * 1.16, r * 0.42, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    drawText(ctx, (user.nickName || '玩').slice(0, 1), cx, cy - 1, {
      size: 18,
      color: '#fff',
      align: 'center',
      baseline: 'middle',
      bold: true,
      shadow: true,
    });
    ctx.restore();
  }

  async onTouchEnd(e) {
    if (this.loading) return;
    GameGlobal.musicManager?.onUserInteract?.();
    const t = e.changedTouches[0];
    const key = this.buttons.find((b) => b.hitTest(t.clientX, t.clientY))?.key;
    if (!key) return;
    GameGlobal.musicManager?.playSfx('click');
    if (key === 'settings') {
      this.emit('openSettings');
      return;
    }
    if (key === 'stats') {
      this.emit('openStats');
      return;
    }
    if (key === 'join') {
      this.emit('joinRoom');
      return;
    }
    this.loading = true;
    try {
      if (key === 'quick') {
        const res = await this.databus.api.quickMatch();
        if (res.code !== 0) {
          wx.showToast({ title: res.message || '匹配失败', icon: 'none' });
          return;
        }
        this.emit('goto', 'room');
      } else if (key === 'create') {
        const res = await this.databus.api.createRoom();
        if (res.code !== 0) {
          wx.showToast({ title: res.message || '创建失败', icon: 'none' });
          return;
        }
        this.emit('goto', 'room');
      }
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally {
      this.loading = false;
    }
  }
}
