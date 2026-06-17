const KEY = 'gd_mahjong_settings';

const defaults = {
  bgm: true,
  sfx: true,
  voice: true,
  voiceLang: 'cantonese',
  vibrate: true,
};

let cache = null;

export function loadSettings() {
  if (cache) return cache;
  try {
    const raw = wx.getStorageSync(KEY);
    cache = { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    cache = { ...defaults };
  }
  return cache;
}

export function saveSettings(partial) {
  cache = { ...loadSettings(), ...partial };
  wx.setStorageSync(KEY, JSON.stringify(cache));
  return cache;
}
