import BaseScene from './BaseScene';
import TableRenderer from '../render/TableRenderer';
import { WsMsgType } from '../network/endpoints';
import VoiceManager from '../runtime/VoiceManager';
import { W, H, glassPanel, drawText, drawGlowText } from '../render/drawUtil';
import theme from '../render/theme';

export default class TableScene extends BaseScene {
  constructor(databus, confirmDialog) {
    super('table');
    this.databus = databus;
    this.confirmDialog = confirmDialog;
    this.renderer = new TableRenderer();
    this.selectedIndex = -1;
    this.toast = '';
    this.toastTimer = 0;
    this.actionBar = [];
    this.pendingReact = false;
    this.settleData = null;
    this.voice = null;
    this.paused = false;
    this.reconnecting = false;
  }

  enter() {
    GameGlobal.musicManager?.onUserInteract?.();
    GameGlobal.musicManager?.playBgm('table');
    this.voice = new VoiceManager(GameGlobal.musicManager);
    this.selectedIndex = -1;
    this.settleData = null;
    this.reconnecting = false;
    const api = this.databus.api;
    api.on('sync', this._onSync, this);
    api.on('ws', this._onWs, this);
    api.on('ws_disconnect', this._onDisconnect, this);
    api.on('ws_reconnected', this._onReconnected, this);
    api.on('ws_reconnecting', this._onReconnecting, this);
    api.on('error', this._onError, this);
    this._refresh();
  }

  exit() {
    const api = this.databus.api;
    api.off('sync', this._onSync, this);
    api.off('ws', this._onWs, this);
    api.off('ws_disconnect', this._onDisconnect, this);
    api.off('ws_reconnected', this._onReconnected, this);
    api.off('ws_reconnecting', this._onReconnecting, this);
    api.off('error', this._onError, this);
  }

  _onDisconnect = () => {
    this.reconnecting = true;
    this._showToast('连接断开，重连中...', 5000);
  };

  _onReconnecting = () => {
    this.reconnecting = true;
  };

  _onReconnected = () => {
    this.reconnecting = false;
    this._showToast('已重新连接', 1500);
    this._refresh();
  };

  _onError = (msg) => {
    this._showToast(msg.message || '操作失败', 2500);
  };

  _onSync = (snap) => {
    this.databus.snapshot = snap;
    this._refresh();
  };

  _onWs = (msg) => {
    if (msg.type === WsMsgType.SETTLE) {
      this.settleData = msg;
      const tag = msg.isZimo ? '自摸' : '点炮';
      this._showToast(`${tag}胡牌！${msg.totalFan} 番`);
      GameGlobal.musicManager?.playSfx('win');
      this.voice?.onAction('win');
      Promise.all([this.databus.api.refreshProfile(), this.databus.api.getStats()]).then(
        ([u]) => {
          if (u) this.databus.user = u;
        },
      );
    }
    if (msg.type === WsMsgType.DISCARD) {
      if (msg.player !== this.databus.snapshot?.humanSeat) {
        GameGlobal.musicManager?.playSfx('discard');
      }
    }
    if (msg.type === WsMsgType.ACTION_REQUEST) {
      this.pendingReact = true;
      this._showToast('请选择操作');
    }
    if (msg.type === WsMsgType.ROUND_END) {
      this._showToast('流局');
    }
    if (msg.type === 'game_pause') {
      this.paused = true;
      GameGlobal.musicManager?.pauseBgm();
    }
    if (msg.type === 'game_resume') {
      this.paused = false;
      GameGlobal.musicManager?.resumeBgm();
    }
    this._refresh();
  };

  _refresh() {
    const api = this.databus.api;
    this.databus.snapshot = api.getSnapshot();
    this.paused = api.isPaused();
    const acts = api.getAvailableActions();
    if (acts.react.length) {
      this.actionBar = acts.react;
      this.pendingReact = true;
    } else if (acts.self.includes('draw')) {
      this.actionBar = ['draw'];
      this.pendingReact = false;
    } else if (acts.self.includes('win')) {
      this.actionBar = ['win', 'discard'];
      this.pendingReact = false;
    } else if (acts.self.includes('discard')) {
      this.actionBar = ['discard'];
      this.pendingReact = false;
    } else {
      this.actionBar = [];
      this.pendingReact = false;
    }
  }

  _showToast(text, ms = 2000) {
    this.toast = text;
    this.toastTimer = Date.now() + ms;
  }

  update() {
    if (this.toast && Date.now() > this.toastTimer) this.toast = '';
  }

  render(ctx) {
    this.renderer.render(ctx, {
      snapshot: this.databus.snapshot,
      selectedIndex: this.selectedIndex,
      toast: this.toast,
      actionBar: this.paused ? [] : this.actionBar,
      pendingReact: this.pendingReact,
      paused: this.paused,
    });
    if (this.settleData) this._renderSettle(ctx);
    if (this.reconnecting) this._renderReconnect(ctx);
  }

  _renderReconnect(ctx) {
    const w = W();
    const h = H();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);
    drawGlowText(ctx, '重连中...', w / 2, h / 2, 22);
  }

  _renderSettle(ctx) {
    const s = this.settleData;
    const snap = this.databus.snapshot;
    const w = W();
    const h = H();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    const pw = Math.min(400, w * 0.85);
    const ph = 280;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    glassPanel(ctx, px, py, pw, ph, 16);
    const title = s.isZimo ? '自摸胡牌' : '点炮胡牌';
    drawGlowText(ctx, title, w / 2, py + 36, 22);

    const winner = snap?.players?.[s.winner];
    if (winner) {
      drawText(ctx, `${winner.name}  胡 ${s.winTile || ''}`, w / 2, py + 64, {
        size: 14,
        color: theme.goldLight,
        align: 'center',
      });
    }

    let ly = py + 92;
    (s.fans || []).forEach((f) => {
      drawText(ctx, `${f.name}  +${f.fan} 番`, w / 2, ly, {
        size: 15,
        color: theme.goldLight,
        align: 'center',
      });
      ly += 24;
    });
    drawText(ctx, `共计 ${s.totalFan} 番  ·  本局 ${s.score || 0} 分`, w / 2, ly + 6, {
      size: 16,
      color: '#fff',
      align: 'center',
      bold: true,
    });
    if (snap?.players) {
      ly += 32;
      snap.players.forEach((p, i) => {
        drawText(ctx, `${p.name}  ${p.score >= 0 ? '+' : ''}${p.score}`, w / 2, ly + i * 22, {
          size: 13,
          color: i === s.winner ? theme.gold : '#bdc3c7',
          align: 'center',
        });
      });
    }
    drawText(ctx, '点击任意处继续', w / 2, py + ph - 28, {
      size: 13,
      color: 'rgba(255,255,255,0.55)',
      align: 'center',
    });
  }

  _confirmAbort() {
    this.confirmDialog.show({
      title: '中止本局',
      message: '确定中止当前对局？\n将返回房间，可重新开始。',
      confirmText: '中止',
      onConfirm: () => {
        GameGlobal.musicManager?.playSfx('click');
        this.paused = false;
        GameGlobal.musicManager?.resumeBgm();
        this.databus.api.abortGame();
        this.settleData = null;
        this.emit('goto', 'room');
      },
    });
  }

  _togglePause() {
    const res = this.databus.api.togglePause();
    this.paused = res.paused;
    GameGlobal.musicManager?.playSfx('click');
    if (this.paused) {
      GameGlobal.musicManager?.pauseBgm();
      this._showToast('游戏已暂停', 1500);
    } else {
      GameGlobal.musicManager?.resumeBgm();
      this._showToast('已继续对局', 1500);
    }
    this._refresh();
  }

  _confirmExit() {
    this.confirmDialog.show({
      title: '退出游戏',
      message: '确定退出？\n将离开房间并返回大厅。',
      confirmText: '退出',
      onConfirm: () => {
        GameGlobal.musicManager?.playSfx('click');
        this.databus.api.leaveRoom();
        this.settleData = null;
        GameGlobal.musicManager?.playBgm('lobby');
        this.emit('goto', 'lobby');
      },
    });
  }

  onTouchEnd(e) {
    if (this.confirmDialog.visible) return;

    GameGlobal.musicManager?.onUserInteract?.();
    const t = e.changedTouches[0];
    const x = t.clientX;
    const y = t.clientY;

    if (this.settleData) {
      this.settleData = null;
      this.databus.api.nextRound();
      this._refresh();
      return;
    }

    const btn = this.renderer.hitTestButton(x, y);
    if (btn === 'pause') {
      this._togglePause();
      return;
    }
    if (btn === 'resume') {
      this._togglePause();
      return;
    }
    if (btn === 'abort') {
      GameGlobal.musicManager?.playSfx('click');
      this._confirmAbort();
      return;
    }
    if (btn === 'exit') {
      GameGlobal.musicManager?.playSfx('click');
      this._confirmExit();
      return;
    }
    if (this.paused) return;
    if (btn) {
      this._handleAction(btn);
      return;
    }

    if (this.pendingReact) return;

    const idx = this.renderer.hitTestHand(x, y);
    if (idx >= 0) {
      this.selectedIndex = idx;
      const snap = this.databus.snapshot;
      const hand = snap?.players[snap.humanSeat]?.hand;
      if (hand && this.actionBar.includes('discard')) {
        this._doDiscard(hand[idx]);
      }
    }
  }

  _handleAction(key) {
    const api = this.databus.api;
    const snap = this.databus.snapshot;
    const hand = snap?.players[snap.humanSeat]?.hand;

    if (key === 'draw') {
      const r = api.sendGameAction('draw');
      if (!r.ok) this._showToast(r.reason || '无法摸牌');
      else GameGlobal.musicManager?.playSfx('draw');
    } else if (key === 'discard') {
      if (this.selectedIndex < 0) this._showToast('请先选择要打出的牌');
      else if (hand) this._doDiscard(hand[this.selectedIndex]);
    } else if (key === 'pass') {
      api.sendGameAction('pass');
      this.pendingReact = false;
      this._refresh();
    } else if (['peng', 'gang', 'win'].includes(key)) {
      const tile =
        snap?.lastDiscard || this.databus.api._reactTile || hand?.[hand.length - 1];
      const r = api.sendGameAction(key, { tile });
      if (r.ok) {
        GameGlobal.musicManager?.playSfx(key);
        this.voice?.onAction(key);
        this.pendingReact = false;
      }
      this._refresh();
    }
  }

  _doDiscard(tile) {
    const r = this.databus.api.sendGameAction('discard', { tile });
    if (!r.ok) {
      this._showToast(r.reason || '出牌失败');
      return;
    }
    GameGlobal.musicManager?.playSfx('discard');
    this.voice?.onDiscard(tile);
    this.selectedIndex = -1;
    this._refresh();
  }
}
