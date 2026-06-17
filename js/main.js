import './render';
import { updateScreen } from './render';
import DataBus from './databus';
import AudioManager from './runtime/AudioManager';
import LobbyScene from './scenes/LobbyScene';
import RoomScene from './scenes/RoomScene';
import TableScene from './scenes/TableScene';
import SettingsOverlay from './scenes/SettingsOverlay';
import StatsOverlay from './scenes/StatsOverlay';
import ConfirmDialog from './ui/ConfirmDialog';
import PromptOverlay from './ui/PromptOverlay';
import BackgroundArt from './render/BackgroundArt';

const ctx = canvas.getContext('2d');

export default class Main {
  constructor() {
    GameGlobal.main = this;
    GameGlobal.databus = new DataBus();
    GameGlobal.musicManager = new AudioManager();

    this.settingsOverlay = new SettingsOverlay();
    this.statsOverlay = new StatsOverlay(GameGlobal.databus);
    this.promptOverlay = new PromptOverlay();
    this.confirmDialog = new ConfirmDialog();
    this.scenes = {
      lobby: new LobbyScene(GameGlobal.databus),
      room: new RoomScene(GameGlobal.databus, this.confirmDialog),
      table: new TableScene(GameGlobal.databus, this.confirmDialog),
    };

    Object.values(this.scenes).forEach((s) => {
      s.on('goto', (name) => this.switchScene(name));
    });
    this.scenes.lobby.on('openSettings', () => this.settingsOverlay.show());
    this.scenes.lobby.on('openStats', () => this.statsOverlay.show('stats'));
    this.scenes.lobby.on('joinRoom', () => this._promptJoinRoom());

    wx.onTouchEnd((e) => this.onTouchEnd(e));

    this.bootstrap();
  }

  _promptJoinRoom() {
    this.promptOverlay.show({
      title: '加入房间',
      placeholder: '输入房间号 R123456',
      onConfirm: async (roomId) => {
        if (!roomId) {
          wx.showToast({ title: '请输入房间号', icon: 'none' });
          return;
        }
        const res = await GameGlobal.databus.api.joinRoom(roomId.toUpperCase());
        if (res.code !== 0) {
          wx.showToast({ title: res.message || '加入失败', icon: 'none' });
          return;
        }
        this.switchScene('room');
      },
    });
  }

  async bootstrap() {
    await GameGlobal.databus.init();

    const launch = wx.getLaunchOptionsSync?.()?.query || {};
    if (launch.roomId && GameGlobal.databus.user) {
      const res = await GameGlobal.databus.api.joinRoom(launch.roomId);
      if (res.code === 0) {
        this.switchScene('room');
        this.loop();
        return;
      }
    }

    this.switchScene('lobby');
    this.loop();
  }

  onResize() {
    updateScreen();
    this.settingsOverlay.onResize?.();
    this.statsOverlay.onResize?.();
    this.promptOverlay.onResize?.();
    this.confirmDialog.onResize?.();
    this.current?.onResize?.();
  }

  switchScene(name) {
    if (this.current) this.current.exit();
    this.current = this.scenes[name];
    GameGlobal.databus.scene = name;
    this.current.enter();
  }

  onTouchEnd(e) {
    GameGlobal.musicManager?.onUserInteract?.();
    const t = e.changedTouches[0];
    if (this.confirmDialog.visible) {
      this.confirmDialog.onTouchEnd(t.clientX, t.clientY);
      return;
    }
    if (this.promptOverlay.visible) {
      if (this.promptOverlay.onTouchEnd(t.clientX, t.clientY)) return;
    }
    if (this.statsOverlay.visible) {
      if (this.statsOverlay.onTouchEnd(t.clientX, t.clientY)) return;
    }
    if (this.settingsOverlay.visible) {
      if (this.settingsOverlay.onTouchEnd(t.clientX, t.clientY)) return;
    }
    this.current?.onTouchEnd?.(e);
  }

  update() {
    GameGlobal.databus.frame++;
    BackgroundArt.tick(GameGlobal.databus.frame);
    this.current?.update?.();
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.current?.render(ctx);
    this.statsOverlay.render(ctx);
    this.settingsOverlay.render(ctx);
    this.promptOverlay.render(ctx);
    this.confirmDialog.render(ctx);
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }
}
