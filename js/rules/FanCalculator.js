import fanTable from '../config/fanGd';
import { tileSuit, isHonor, DRAGONS, WINDS } from '../constants/tiles';
import WinDetector from './WinDetector';

/**
 * 番型结算 — 取不互斥最高番组合（简化：累加独立番 + 取互斥最高）
 */
export default class FanCalculator {
  static calculate(ctx) {
    const {
      handTiles,
      melds = [],
      winTile,
      isZimo,
      isMenqing,
      isGangShang,
      isQiangGang,
      ghostTiles = [],
      ghostCountInHand = 0,
      rule = {},
    } = ctx;

    const allTiles = [...handTiles];
    const hits = [];

    const winCheck = WinDetector.canWin(allTiles, melds, ghostTiles);
    if (!winCheck.ok) return { fans: [], totalFan: 0 };

    if (winCheck.type === 'shiSanYao') hits.push('shiSanYao');
    else if (winCheck.type === 'qiDui') hits.push('qiDui');
    else {
      if (FanCalculator.isQingYise(allTiles, melds)) hits.push('qingYise');
      else if (FanCalculator.isHunYise(allTiles, melds)) hits.push('hunYise');
      else if (FanCalculator.isPengPeng(allTiles, melds)) hits.push('pengpeng');
      else hits.push('pinghu');
    }

    if (FanCalculator.isDaSanYuan(allTiles, melds)) hits.push('daSanYuan');
    else if (FanCalculator.isXiaoSanYuan(allTiles, melds)) hits.push('xiaoSanYuan');

    if (FanCalculator.isDaSiXi(allTiles, melds)) hits.push('daSiXi');
    else if (FanCalculator.isXiaoSiXi(allTiles, melds)) hits.push('xiaoSiXi');

    if (isZimo) hits.push('zimo');
    if (isMenqing && melds.length === 0) hits.push('menqing');
    if (isGangShang) hits.push('gangShang');
    if (isQiangGang) hits.push('qiangGang');

    const ghosts = allTiles.filter((t) => t === 'ghost').length;
    if (ghosts === 0 && (rule.ghostCount || 0) > 0) hits.push('wuGui');
    if (ghosts >= 4) hits.push('siGui');

    const fans = FanCalculator.resolveFans(hits, fanTable);
    let totalFan = fans.reduce((s, f) => s + f.fan, 0);
    const maxFan = rule.maxFan || 64;
    totalFan = Math.min(totalFan, maxFan);

    return { fans, totalFan, fanIds: hits };
  }

  static resolveFans(hits, table) {
    const map = Object.fromEntries(table.map((f) => [f.fanId, f]));
    const selected = [];
    const usedMutex = new Set();

    const sorted = [...hits].sort((a, b) => (map[b]?.fan || 0) - (map[a]?.fan || 0));
    for (const id of sorted) {
      const def = map[id];
      if (!def) continue;
      if (def.mutex.some((m) => usedMutex.has(m) || hits.includes(m) && selected.find((s) => s.fanId === m))) {
        const conflict = def.mutex.find((m) => hits.includes(m) && selected.some((s) => s.fanId === m));
        if (conflict) continue;
      }
      if (selected.some((s) => s.fanId === id)) continue;
      selected.push(def);
      def.mutex.forEach((m) => usedMutex.add(m));
    }
    return selected;
  }

  static allTileCodes(hand, melds) {
    const t = [...hand.filter((x) => x !== 'ghost')];
    melds.forEach((m) => m.tiles.forEach((x) => t.push(x)));
    return t;
  }

  static isQingYise(hand, melds) {
    const t = FanCalculator.allTileCodes(hand, melds);
    const suits = new Set(t.map(tileSuit).filter((s) => s !== 'honor'));
    return suits.size === 1 && !t.some(isHonor);
  }

  static isHunYise(hand, melds) {
    const t = FanCalculator.allTileCodes(hand, melds);
    const suits = new Set(t.map(tileSuit).filter((s) => s !== 'honor'));
    return suits.size === 1 && t.some(isHonor);
  }

  static isPengPeng(hand, melds) {
    const counts = WinDetector.countMap(FanCalculator.allTileCodes(hand, melds));
    let pairs = 0;
    for (const c of Object.values(counts)) {
      if (c === 2) pairs++;
      else if (c !== 3 && c !== 4) return false;
    }
    return pairs === 1 || pairs === 0;
  }

  static honorPonCount(hand, melds, honorList) {
    const t = FanCalculator.allTileCodes(hand, melds);
    const counts = WinDetector.countMap(t);
    return honorList.filter((h) => (counts[h] || 0) >= 3).length;
  }

  static isXiaoSanYuan(hand, melds) {
    const n = FanCalculator.honorPonCount(hand, melds, DRAGONS);
    const counts = WinDetector.countMap(FanCalculator.allTileCodes(hand, melds));
    const pairDragons = DRAGONS.filter((d) => counts[d] === 2).length;
    return n === 2 && pairDragons === 1;
  }

  static isDaSanYuan(hand, melds) {
    return FanCalculator.honorPonCount(hand, melds, DRAGONS) === 3;
  }

  static isXiaoSiXi(hand, melds) {
    const n = FanCalculator.honorPonCount(hand, melds, WINDS);
    const counts = WinDetector.countMap(FanCalculator.allTileCodes(hand, melds));
    const pairW = WINDS.filter((d) => counts[d] === 2).length;
    return n === 3 && pairW === 1;
  }

  static isDaSiXi(hand, melds) {
    return FanCalculator.honorPonCount(hand, melds, WINDS) === 4;
  }
}
