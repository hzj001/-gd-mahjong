import { sortTiles } from '../constants/tiles';
import ActionValidator from '../rules/ActionValidator';
import WinDetector from '../rules/WinDetector';

/**
 * 简易麻将 AI — 向听启发 + 随机扰动
 */
export default class MahjongAI {
  static chooseDiscard(hand, melds, ghostTiles) {
    const sorted = sortTiles(hand);
    if (WinDetector.canWin(sorted, melds, ghostTiles).ok) {
      return sorted[sorted.length - 1];
    }
    const scores = sorted.map((tile) => ({
      tile,
      score: MahjongAI._tileValue(tile, sorted),
    }));
    scores.sort((a, b) => a.score - b.score);
    const worst = scores.filter((s) => s.score === scores[0].score);
    return worst[Math.floor(Math.random() * worst.length)].tile;
  }

  static _tileValue(tile, hand) {
    if (tile === 'ghost') return 100;
    const counts = {};
    hand.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
    const c = counts[tile] || 0;
    if (c >= 3) return 50;
    if (c === 2) return 30;
    const suit = tile.slice(-1);
    const num = parseInt(tile[0], 10);
    let seq = 0;
    if (num > 1 && hand.includes(`${num - 1}${suit}`)) seq++;
    if (num < 9 && hand.includes(`${num + 1}${suit}`)) seq++;
    return 10 - seq * 3;
  }

  static chooseReaction(hand, tile, melds, ghostTiles, options) {
    if (options.includes('win') && ActionValidator.canWin(hand, tile, melds, ghostTiles)) {
      return 'win';
    }
    if (options.includes('gang') && ActionValidator.canGang(hand, tile, 'ming')) {
      return Math.random() > 0.6 ? 'gang' : 'pass';
    }
    if (options.includes('peng') && ActionValidator.canPeng(hand, tile)) {
      return Math.random() > 0.5 ? 'peng' : 'pass';
    }
    return 'pass';
  }
}
