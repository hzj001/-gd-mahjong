import WinDetector from './WinDetector';

/**
 * 行牌合法性校验（客户端预检，最终以 MockServer/Go 为准）
 */
export default class ActionValidator {
  static canPeng(hand, tile) {
    const normal = hand.filter((t) => t !== 'ghost');
    const ghosts = hand.filter((t) => t === 'ghost').length;
    const cnt = normal.filter((t) => t === tile).length;
    return cnt >= 2 || (cnt >= 1 && ghosts >= 1) || ghosts >= 2;
  }

  static canGang(hand, tile, type) {
    const normal = hand.filter((t) => t !== 'ghost');
    const ghosts = hand.filter((t) => t === 'ghost').length;
    const cnt = normal.filter((t) => t === tile).length;
    if (type === 'an') return cnt >= 4 || cnt + ghosts >= 4;
    if (type === 'ming' || type === 'bu') return cnt >= 3 || cnt + ghosts >= 3;
    return false;
  }

  static canWin(hand, tile, melds, ghostTiles) {
    const test = [...hand];
    if (tile) test.push(tile);
    return WinDetector.canWin(test, melds, ghostTiles).ok;
  }

  static canDiscard(hand, tile) {
    return hand.includes(tile);
  }
}
