import { tileLabel } from '../constants/tiles';

/** 语音事件映射 — 对接 AudioManager，资源到位后自动播放 */
const VOICE_EVENTS = {
  peng: 'peng',
  gang: 'gang',
  win: 'hu',
  zimo: 'zimo',
  pass: 'pass',
};

export default class VoiceManager {
  constructor(audioManager) {
    this.audio = audioManager;
  }

  onDiscard(tile) {
    const name = tileLabel(tile).replace(/\s/g, '');
    this.audio.playVoice(`tile_${name}`, tile);
  }

  onAction(action) {
    const ev = VOICE_EVENTS[action];
    if (ev) this.audio.playVoice(ev);
  }

  onFan(fanName) {
    this.audio.playVoice(`fan_${fanName}`);
  }
}
