import { sortTiles, HONORS, DRAGONS, WINDS, isHonor } from '../constants/tiles';

/**
 * 胡牌判定：标准型（4面子+将）、七对、十三幺
 */
export default class WinDetector {
  /**
   * @param {string[]} handTiles 手牌（含刚摸未打的牌）
   * @param {object[]} melds 副露 [{ type, tiles, from? }]
   * @param {string[]} ghostTiles 鬼牌原始牌面列表
   */
  static canWin(handTiles, melds = [], ghostTiles = []) {
    const hand = [...handTiles];
    const ghostCount = hand.filter((t) => t === 'ghost').length;
    const normal = hand.filter((t) => t !== 'ghost');

    if (WinDetector.isSevenPairs(normal, ghostCount)) return { ok: true, type: 'qiDui' };
    if (WinDetector.isShiSanYao(normal, ghostCount)) return { ok: true, type: 'shiSanYao' };
    if (WinDetector.canFormStandard(normal, ghostCount, melds)) {
      return { ok: true, type: 'standard' };
    }
    return { ok: false };
  }

  static isSevenPairs(tiles, ghostCount) {
    if (tiles.length + ghostCount !== 14) return false;
    const counts = WinDetector.countMap(tiles);
    let pairs = 0;
    let singles = 0;
    for (const c of Object.values(counts)) {
      if (c === 2) pairs++;
      else if (c === 4) pairs += 2;
      else if (c === 1) singles++;
      else if (c === 3) return false;
    }
    const needPairs = 7;
    const needSingles = (14 - tiles.length) ? 0 : singles;
    return pairs + ghostCount >= needPairs && (pairs * 2 + singles + ghostCount) === 14;
  }

  static isShiSanYao(tiles, ghostCount) {
    const yaojiu = [];
    for (let n = 1; n <= 9; n++) {
      for (const s of ['w', 't', 'b']) {
        if (n === 1 || n === 9) yaojiu.push(`${n}${s}`);
      }
    }
    [...WINDS, ...DRAGONS].forEach((h) => yaojiu.push(h));
    const need = [...yaojiu];
    const counts = WinDetector.countMap(tiles);
    let pairUsed = false;
    let missing = 0;
    for (const t of need) {
      const c = counts[t] || 0;
      if (c === 0) missing++;
      else if (c === 1) {
        /* one of each */
      } else if (c === 2 && !pairUsed) pairUsed = true;
      else if (c > 2) return false;
    }
    return missing <= ghostCount && (missing + ghostCount) % 2 === (pairUsed ? 0 : 1);
  }

  static canFormStandard(tiles, ghostCount, melds) {
    const meldSets = melds.length;
    const needSets = 4 - meldSets;
    return WinDetector._solve(tiles, ghostCount, needSets, true);
  }

  static _solve(tiles, ghosts, setsNeeded, needPair) {
    if (tiles.length === 0 && ghosts === 0) {
      return setsNeeded === 0 && !needPair;
    }
    const sorted = sortTiles(tiles);
    const counts = WinDetector.countMap(sorted);

    if (needPair) {
      for (const [tile, cnt] of Object.entries(counts)) {
        if (cnt >= 2) {
          const rest = WinDetector.removeTiles(sorted, [tile, tile]);
          if (WinDetector._solve(rest, ghosts, setsNeeded, false)) return true;
        }
        if (cnt >= 1 && ghosts >= 1) {
          const rest = WinDetector.removeTiles(sorted, [tile]);
          if (WinDetector._solve(rest, ghosts - 1, setsNeeded, false)) return true;
        }
      }
      if (ghosts >= 2) {
        if (WinDetector._solve(sorted, ghosts - 2, setsNeeded, false)) return true;
      }
      return false;
    }

    if (setsNeeded === 0) return tiles.length === 0 && ghosts === 0;

    const first = sorted[0];
    if (!first) {
      if (ghosts >= 3 && setsNeeded > 0) {
        return WinDetector._solve([], ghosts - 3, setsNeeded - 1, false);
      }
      return false;
    }

    // 刻子
    const c0 = counts[first] || 0;
    if (c0 >= 3) {
      const rest = WinDetector.removeTiles(sorted, [first, first, first]);
      if (WinDetector._solve(rest, ghosts, setsNeeded - 1, false)) return true;
    }
    if (c0 >= 2 && ghosts >= 1) {
      const rest = WinDetector.removeTiles(sorted, [first, first]);
      if (WinDetector._solve(rest, ghosts - 1, setsNeeded - 1, false)) return true;
    }
    if (c0 >= 1 && ghosts >= 2) {
      const rest = WinDetector.removeTiles(sorted, [first]);
      if (WinDetector._solve(rest, ghosts - 2, setsNeeded - 1, false)) return true;
    }
    if (ghosts >= 3) {
      const rest = WinDetector.removeTiles(sorted, []);
      if (WinDetector._solve(rest, ghosts - 3, setsNeeded - 1, false)) return true;
    }

    // 顺子（数牌）
    if (!isHonor(first)) {
      const suit = first.slice(-1);
      const num = parseInt(first[0], 10);
      if (num <= 7) {
        const t2 = `${num + 1}${suit}`;
        const t3 = `${num + 2}${suit}`;
        if (WinDetector.canTakeSequence(sorted, ghosts, first, t2, t3)) {
          let rest = WinDetector.removeTiles(sorted, [first]);
          rest = WinDetector.removeTiles(rest, [t2]);
          rest = WinDetector.removeTiles(rest, [t3]);
          if (WinDetector._solve(rest, ghosts, setsNeeded - 1, false)) return true;
        }
      }
    }

    return false;
  }

  static canTakeSequence(tiles, ghosts, a, b, c) {
    const counts = WinDetector.countMap(tiles);
    let g = ghosts;
    for (const t of [a, b, c]) {
      if (counts[t] > 0) counts[t]--;
      else if (g > 0) g--;
      else return false;
    }
    return true;
  }

  static removeTiles(tiles, remove) {
    const arr = [...tiles];
    for (const t of remove) {
      const i = arr.indexOf(t);
      if (i >= 0) arr.splice(i, 1);
    }
    return arr;
  }

  static countMap(tiles) {
    const m = {};
    for (const t of tiles) m[t] = (m[t] || 0) + 1;
    return m;
  }

  /** 听牌：打出每张后是否听胡（简化） */
  static getTingTiles(handTiles, melds, ghostTiles) {
    const result = [];
    const unique = [...new Set(handTiles)];
    for (const discard of unique) {
      const rest = handTiles.filter((t, i, arr) => {
        const idx = arr.indexOf(discard);
        return i !== idx || arr.filter((x) => x === discard).length > 1
          ? true
          : handTiles.indexOf(discard) !== i;
      });
      const hand = [...handTiles];
      const di = hand.indexOf(discard);
      if (di < 0) continue;
      hand.splice(di, 1);
      const wallTry = [...new Set([...SUITS_WILDCARD()])];
      for (const draw of buildTryTiles()) {
        const test = [...hand, draw];
        if (WinDetector.canWin(test, melds, ghostTiles).ok) {
          result.push({ discard, ting: draw });
        }
      }
    }
    return result;
  }
}

function SUITS_WILDCARD() {
  return [];
}

function buildTryTiles() {
  const t = [];
  for (const s of ['w', 't', 'b']) {
    for (let n = 1; n <= 9; n++) t.push(`${n}${s}`);
  }
  [...WINDS, ...DRAGONS].forEach((h) => t.push(h));
  return t;
}
