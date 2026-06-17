import { buildFullWall } from '../constants/tiles';

export default class Wall {
  constructor() {
    this.tiles = [];
    this.index = 0;
  }

  shuffle(seed) {
    this.tiles = buildFullWall();
    let s = seed || Date.now();
    for (let i = this.tiles.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
    this.index = 0;
  }

  draw() {
    if (this.index >= this.tiles.length) return null;
    return this.tiles[this.index++];
  }

  remaining() {
    return this.tiles.length - this.index;
  }

  peekTail(n) {
    return this.tiles.slice(-n);
  }
}
