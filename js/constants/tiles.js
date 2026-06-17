/** 牌编码 — 与 Go 后端 tile 字符串一致 */

export const SUITS = ['w', 't', 'b'];
export const SUIT_NAMES = { w: '万', t: '筒', b: '条' };

export const WINDS = ['dong', 'nan', 'xi', 'bei'];
export const WIND_NAMES = { dong: '东', nan: '南', xi: '西', bei: '北' };

export const DRAGONS = ['zhong', 'fa', 'bai'];
export const DRAGON_NAMES = { zhong: '中', fa: '发', bai: '白' };

export const HONORS = [...WINDS, ...DRAGONS];

/** 生成完整 136 张牌墙 */
export function buildFullWall() {
  const wall = [];
  for (const s of SUITS) {
    for (let n = 1; n <= 9; n++) {
      const code = `${n}${s}`;
      for (let i = 0; i < 4; i++) wall.push(code);
    }
  }
  for (const h of HONORS) {
    for (let i = 0; i < 4; i++) wall.push(h);
  }
  return wall;
}

export function tileLabel(code) {
  if (!code) return '';
  if (code === 'ghost') return '鬼';
  const m = /^(\d)([wtb])$/.exec(code);
  if (m) return `${m[1]}${SUIT_NAMES[m[2]]}`;
  if (WIND_NAMES[code]) return WIND_NAMES[code];
  if (DRAGON_NAMES[code]) return DRAGON_NAMES[code];
  return code;
}

export function tileSuit(code) {
  const m = /^(\d)([wtb])$/.exec(code);
  return m ? m[2] : 'honor';
}

export function tileRank(code) {
  const m = /^(\d)([wtb])$/.exec(code);
  if (m) return parseInt(m[1], 10);
  if (WINDS.includes(code)) return WINDS.indexOf(code) + 1;
  if (DRAGONS.includes(code)) return DRAGONS.indexOf(code) + 10;
  return 0;
}

export function sortTiles(tiles) {
  const order = (c) => {
    const s = tileSuit(c);
    const si = s === 'w' ? 0 : s === 't' ? 1 : s === 'b' ? 2 : 3;
    return si * 20 + tileRank(c);
  };
  return [...tiles].sort((a, b) => order(a) - order(b));
}

export function isHonor(code) {
  return HONORS.includes(code);
}

export function isTerminalOrHonor(code) {
  if (isHonor(code)) return true;
  const r = tileRank(code);
  return r === 1 || r === 9;
}
