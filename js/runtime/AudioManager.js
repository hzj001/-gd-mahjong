import { loadSettings } from './Settings';
import ProceduralAudio from './ProceduralAudio';

let instance;

/**
 * 分层音频 — 优先 mp3，缺失时用程序化 WebAudio
 */
export default class AudioManager {
  constructor() {
    if (instance) return instance;
    instance = this;
    this.procedural = new ProceduralAudio();
    this.bgm = wx.createInnerAudioContext();
    this.bgm.loop = true;
    this.bgm.volume = 0.55;
    this.sfxPool = {};
    this.currentScene = '';
    this.mp3Ready = { bgm: false, sfx: false };

    this.bgmPaths = {
      lobby: 'audio/bgm_lobby.mp3',
      table: 'audio/bgm_table.mp3',
      default: 'audio/bgm.mp3',
    };
    this.sfxPaths = {
      click: 'audio/sfx_click.mp3',
      draw: 'audio/sfx_draw.mp3',
      discard: 'audio/sfx_discard.mp3',
      peng: 'audio/sfx_peng.mp3',
      gang: 'audio/sfx_gang.mp3',
      win: 'audio/sfx_win.mp3',
    };
    this._probeAssets();
  }

  _probeAssets() {
    const probe = wx.createInnerAudioContext();
    probe.src = this.bgmPaths.lobby;
    probe.onCanplay(() => {
      this.mp3Ready.bgm = true;
      probe.destroy();
    });
    probe.onError(() => probe.destroy());
  }

  playBgm(scene = 'lobby') {
    const s = loadSettings();
    if (!s.bgm) return;
    if (this.currentScene === scene) return;
    this.currentScene = scene;
    this.stopBgm();

    const path = this.bgmPaths[scene] || this.bgmPaths.default;
    const useMp3 = this._tryPlayMp3Bgm(path, scene);
    if (!useMp3) {
      if (scene === 'table') this.procedural.playTableBgm();
      else this.procedural.playLobbyBgm();
    }
  }

  _tryPlayMp3Bgm(path, scene) {
    try {
      this.bgm.stop();
      this.bgm.src = path;
      const played = { ok: false };
      this.bgm.onCanplay(() => {
        played.ok = true;
        this.bgm.play();
      });
      this.bgm.onError(() => {
        if (!played.ok) {
          if (scene === 'table') this.procedural.playTableBgm();
          else this.procedural.playLobbyBgm();
        }
      });
      return this.mp3Ready.bgm;
    } catch (e) {
      return false;
    }
  }

  stopBgm() {
    try {
      this.bgm.stop();
    } catch (e) {
      /* ignore */
    }
    this.procedural.stopBgm();
    this.currentScene = '';
    this._bgmPaused = false;
  }

  /** 对局暂停时静音 BGM */
  pauseBgm() {
    this._bgmPaused = true;
    try {
      this.bgm.pause();
    } catch (e) {
      /* ignore */
    }
    this.procedural.stopBgm();
  }

  /** 恢复暂停前的 BGM */
  resumeBgm() {
    if (!this._bgmPaused) return;
    this._bgmPaused = false;
    const scene = this.currentScene || 'table';
    this.currentScene = '';
    this.playBgm(scene);
  }

  playSfx(name) {
    const s = loadSettings();
    if (!s.sfx) return;
    this.procedural.resume();

    const src = this.sfxPaths[name];
    if (src && this._playMp3Sfx(name, src)) return;
    this.procedural.playSfx(name);
  }

  _playMp3Sfx(name, src) {
    try {
      if (!this.sfxPool[name]) {
        const ctx = wx.createInnerAudioContext();
        ctx.src = src;
        ctx.volume = 0.7;
        ctx.onError(() => {
          this.sfxPool[name] = null;
        });
        this.sfxPool[name] = ctx;
      }
      const a = this.sfxPool[name];
      if (!a) return false;
      a.stop();
      a.play();
      return true;
    } catch (e) {
      return false;
    }
  }

  playVoice(event, tileCode) {
    const s = loadSettings();
    if (!s.voice) return;
    const path = `audio/voice/${s.voiceLang}/${event}.mp3`;
    try {
      const v = wx.createInnerAudioContext();
      v.src = path;
      v.volume = 0.85;
      v.onError(() => {
        if (tileCode) this.playSfx('discard');
      });
      v.play();
    } catch (e) {
      if (tileCode) this.playSfx('discard');
    }
  }

  onUserInteract() {
    this.procedural.init();
    this.procedural.resume();
  }
}
