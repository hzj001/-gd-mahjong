import BaseScene from './BaseScene';
import Button from '../ui/Button';
import { W, H, drawText, glassPanel, drawGlowText, roundRect } from '../render/drawUtil';
import BackgroundArt from '../render/BackgroundArt';
import theme from '../render/theme';
import ruleGd from '../config/ruleGd';

export default class RoomScene extends BaseScene {
  constructor(databus, confirmDialog) {
    super('room');
    this.databus = databus;
    this.confirmDialog = confirmDialog;
    this.buttons = [];
    this.starting = false;
    this._pollTimer = null;
  }

  enter() {
    GameGlobal.musicManager?.playBgm('lobby');
    this._layout();
    this._setupShare();
    this._pollTimer = setInterval(() => this._refreshRoom(), 2500);
  }

  exit() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _setupShare() {
    const room = this.databus.api.room;
    if (!room?.roomId) return;
    wx.onShareAppMessage(() => ({
      title: `来一局粤麻！房间 ${room.roomId}`,
      query: `roomId=${room.roomId}`,
    }));
  }

  async _refreshRoom() {
    if (this.databus.api.useMock || this.starting) return;
    const res = await this.databus.api.getRoomInfo();
    if (res.code !== 0 && res.code !== -1) {
      wx.showToast({ title: res.message || '房间已失效', icon: 'none' });
    }
  }

  onResize() {
    this._layout();
  }

  _layout() {
    const w = W();
    const h = H();
    const btnW = 160;
    const btnH = 44;
    this.buttons = [
      new Button(w - btnW - 24, h - btnH * 5 - 64, btnW, btnH, '准备', {
        key: 'ready',
        bg: '#27ae60',
        bgEnd: '#1e8449',
      }),
      new Button(w - btnW - 24, h - btnH * 4 - 52, btnW, btnH, '开始对局', {
        key: 'start',
        bg: '#c0392b',
        bgEnd: '#922b21',
      }),
      new Button(w - btnW - 24, h - btnH * 3 - 40, btnW, btnH, '分享房间', {
        key: 'share',
        bg: '#2471a3',
        bgEnd: '#1a5276',
      }),
      new Button(16, 12, 88, 36, '退出', {
        key: 'exit',
        bg: '#c0392b',
        bgEnd: '#922b21',
      }),
    ];
  }

  _isOwner() {
    const room = this.databus.api.room;
    const uid = this.databus.user?.id;
    return room && String(room.ownerId) === String(uid);
  }

  render(ctx) {
    BackgroundArt.drawRoom(ctx);
    const w = W();
    const h = H();
    const room = this.databus.api.room;

    glassPanel(ctx, w * 0.06, h * 0.12, w * 0.35, h * 0.76, 16);
    drawGlowText(ctx, '房间', w * 0.235, h * 0.2, 24);
    if (room) {
      drawText(ctx, room.roomId, w * 0.235, h * 0.3, {
        size: 22,
        color: theme.gold,
        align: 'center',
        bold: true,
      });
      drawText(ctx, ruleGd.name, w * 0.235, h * 0.38, {
        size: 14,
        color: '#aed6f1',
        align: 'center',
      });
      drawText(ctx, `底分 ${room.baseScore || 1}`, w * 0.235, h * 0.44, {
        size: 12,
        color: 'rgba(255,255,255,0.6)',
        align: 'center',
      });
      const statusText = room.status === 'playing' ? '对局进行中' : '等待开始';
      drawText(ctx, statusText, w * 0.235, h * 0.5, {
        size: 12,
        color: room.status === 'playing' ? '#f39c12' : '#95a5a6',
        align: 'center',
      });
      if (this._isOwner()) {
        drawText(ctx, '你是房主', w * 0.235, h * 0.56, {
          size: 11,
          color: theme.goldLight,
          align: 'center',
        });
      }
    }

    if (room?.players) {
      const cardW = Math.min(140, (w * 0.5 - 40) / 4);
      const startX = w * 0.44;
      const cardY = h * 0.25;
      room.players.forEach((p, i) => {
        const px = startX + i * (cardW + 12);
        glassPanel(ctx, px, cardY, cardW, h * 0.5, 12);
        const ready = p.ready;
        ctx.fillStyle = ready ? 'rgba(46, 204, 113, 0.3)' : 'rgba(0,0,0,0.2)';
        roundRect(ctx, px, cardY, cardW, h * 0.5, 12);
        ctx.fill();
        drawText(ctx, p.nickName, px + cardW / 2, cardY + 40, {
          size: 14,
          color: '#fff',
          align: 'center',
          bold: true,
        });
        drawText(ctx, ready ? '已准备' : '等待中', px + cardW / 2, cardY + 70, {
          size: 12,
          color: ready ? '#2ecc71' : '#95a5a6',
          align: 'center',
        });
        drawText(ctx, `座位 ${i + 1}`, px + cardW / 2, cardY + 100, {
          size: 11,
          color: theme.gold,
          align: 'center',
        });
      });
    }

    this.buttons.forEach((b) => b.render(ctx));

    if (this.starting) {
      drawText(ctx, '正在开局...', w / 2, h - 40, {
        size: 14,
        color: '#fff',
        align: 'center',
      });
    }

    drawText(ctx, '对局中请用「中止」返回房间', w - 16, h - 12, {
      size: 10,
      color: 'rgba(255,255,255,0.35)',
      align: 'right',
    });
  }

  _confirmExit() {
    this.confirmDialog.show({
      title: '退出房间',
      message: '确定退出房间？\n将返回游戏大厅。',
      confirmText: '退出',
      onConfirm: async () => {
        GameGlobal.musicManager?.playSfx('click');
        await this.databus.api.leaveRoom();
        this.emit('goto', 'lobby');
      },
    });
  }

  async onTouchEnd(e) {
    if (this.confirmDialog.visible || this.starting) return;

    const t = e.changedTouches[0];
    const key = this.buttons.find((b) => b.hitTest(t.clientX, t.clientY))?.key;
    if (!key) return;
    GameGlobal.musicManager?.playSfx('click');
    if (key === 'exit') {
      this._confirmExit();
      return;
    }
    if (key === 'ready') {
      const res = await this.databus.api.setReady(true);
      if (res.code !== 0) wx.showToast({ title: res.message || '准备失败', icon: 'none' });
      return;
    }
    if (key === 'share') {
      wx.showShareMenu?.({ withShareTicket: true, menus: ['shareAppMessage'] });
      wx.showToast({ title: '请点击右上角分享', icon: 'none' });
      return;
    }
    if (key === 'start') {
      if (!this._isOwner() && !this.databus.api.useMock) {
        wx.showToast({ title: '请等待房主开始', icon: 'none' });
        return;
      }
      this.starting = true;
      try {
        await this.databus.api.setReady(true);
        const res = await this.databus.api.startGame();
        if (res.code !== 0) {
          wx.showToast({ title: res.message || '开局失败', icon: 'none' });
          return;
        }
        this.emit('goto', 'table');
      } catch (err) {
        wx.showToast({ title: err.message || '开局失败', icon: 'none' });
      } finally {
        this.starting = false;
      }
    }
  }
}
