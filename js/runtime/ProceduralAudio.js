/**
 * 程序化音频 — 无 mp3 时提供氛围 BGM 与音效（WebAudio）
 */
export default class ProceduralAudio {
  constructor() {
    this.ctx = null;
    this.bgmNodes = [];
    this.bgmTimer = null;
    this.masterGain = null;
    this._inited = false;
  }

  init() {
    if (this._inited) return !!this.ctx;
    try {
      if (typeof wx.createWebAudioContext !== 'function') return false;
      this.ctx = wx.createWebAudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
      this._inited = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    if (this.ctx?.resume) this.ctx.resume();
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmNodes.forEach((n) => {
      try {
        n.osc?.stop?.();
        n.osc?.disconnect?.();
      } catch (e) {
        /* ignore */
      }
    });
    this.bgmNodes = [];
  }

  /** 大厅：舒缓五声 ambient */
  playLobbyBgm() {
    this.stopBgm();
    if (!this.init()) return;
    this.resume();
    const base = 261.63;
    const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
    let step = 0;
    const playNote = () => {
      if (!this.ctx) return;
      const freq = base * scale[step % scale.length];
      step++;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 2);
      this.bgmNodes.push({ osc, gain });
    };
    playNote();
    this.bgmTimer = setInterval(playNote, 900);
  }

  /** 牌桌：略快、带轻柔节奏 */
  playTableBgm() {
    this.stopBgm();
    if (!this.init()) return;
    this.resume();
    const base = 196;
    const pat = [1, 1.125, 1.25, 1.125, 1.5, 1.25];
    let step = 0;
    const playNote = () => {
      if (!this.ctx) return;
      const freq = base * pat[step % pat.length];
      step++;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = step % 3 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.6);
      this.bgmNodes.push({ osc });
    };
    playNote();
    this.bgmTimer = setInterval(playNote, 480);
  }

  playSfx(type) {
    if (!this.init()) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    const cfg = {
      click: { type: 'sine', f0: 880, f1: 1200, dur: 0.06, vol: 0.15 },
      draw: { type: 'triangle', f0: 400, f1: 600, dur: 0.12, vol: 0.12 },
      discard: { type: 'sine', f0: 520, f1: 380, dur: 0.1, vol: 0.14 },
      peng: { type: 'square', f0: 330, f1: 440, dur: 0.15, vol: 0.1 },
      gang: { type: 'square', f0: 220, f1: 330, dur: 0.2, vol: 0.12 },
      win: { type: 'sine', f0: 523, f1: 784, dur: 0.5, vol: 0.18 },
    }[type] || { type: 'sine', f0: 600, f1: 600, dur: 0.08, vol: 0.1 };

    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.f0, t);
    osc.frequency.exponentialRampToValueAtTime(cfg.f1, t + cfg.dur);
    gain.gain.setValueAtTime(cfg.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
    osc.start(t);
    osc.stop(t + cfg.dur + 0.05);
  }
}
