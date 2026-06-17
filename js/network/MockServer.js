import Emitter from '../libs/tinyemitter';
import ruleGd from '../config/ruleGd';
import Wall from '../game/Wall';
import ActionValidator from '../rules/ActionValidator';
import WinDetector from '../rules/WinDetector';
import FanCalculator from '../rules/FanCalculator';
import MahjongAI from '../ai/MahjongAI';
import { sortTiles } from '../constants/tiles';
import { WsMsgType } from './endpoints';

const PHASE = {
  IDLE: 'idle',
  PLAYING: 'playing',
  REACTION: 'reaction',
  SETTLE: 'settle',
};

/**
 * 本地权威对局模拟 — 接口形态对齐未来 Go WebSocket 推送
 */
export default class MockServer extends Emitter {
  constructor() {
    super();
    this.rule = { ...ruleGd };
    this.reset();
  }

  reset() {
    this.phase = PHASE.IDLE;
    this.players = [];
    this.dealer = 0;
    this.current = 0;
    this.wall = new Wall();
    this.discards = [[], [], [], []];
    this.melds = [[], [], [], []];
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.ghostTile = null;
    this.round = 0;
    this.reactionQueue = [];
    this.pendingWin = null;
    this.gangDraw = false;
    this.actionLog = [];
    this.paused = false;
    this._aiTimers = [];
    this._clearAiTimers();
  }

  _clearAiTimers() {
    this._aiTimers.forEach((id) => clearTimeout(id));
    this._aiTimers = [];
  }

  _scheduleAi(fn, delay) {
    if (this.paused) return;
    const id = setTimeout(() => {
      if (this.paused) return;
      fn();
    }, delay);
    this._aiTimers.push(id);
  }

  pause() {
    if (this.paused || this.phase === PHASE.IDLE || this.phase === PHASE.SETTLE) return;
    this.paused = true;
    this._clearAiTimers();
    this._emitState();
    this.emit('message', { type: 'game_pause' });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this._emitState();
    this.emit('message', { type: 'game_resume' });
    if (this.phase === PHASE.SETTLE) return;
    if (this.phase === PHASE.REACTION) {
      this._continueReaction();
      return;
    }
    if (this.phase === PHASE.PLAYING && this.current !== this.humanSeat) {
      this._scheduleAi(() => this._aiLoop(), 400);
    }
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
    return this.paused;
  }

  _rejectIfPaused() {
    if (this.paused) return { ok: false, reason: '游戏已暂停' };
    return null;
  }

  /**
   * @param {object[]} players { id, name, isHuman, seat }
   */
  startGame(players, humanSeat = 0) {
    this.reset();
    this.players = players.map((p, i) => ({
      ...p,
      seat: i,
      hand: [],
      score: p.score || 0,
    }));
    this.dealer = 0;
    this.humanSeat = humanSeat;
    this._startRound();
  }

  _startRound() {
    this.round++;
    this.phase = PHASE.PLAYING;
    this.wall = new Wall();
    this.wall.shuffle(Date.now() + this.round);
    this.discards = [[], [], [], []];
    this.melds = [[], [], [], []];
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.gangDraw = false;

    for (const p of this.players) p.hand = [];

    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 4; i++) {
        for (let k = 0; k < 4; k++) this.players[i].hand.push(this.wall.draw());
      }
    }
    for (let i = 0; i < 4; i++) this.players[i].hand.push(this.wall.draw());
    this.players[this.dealer].hand.push(this.wall.draw());

    if (this.rule.ghostCount > 0) {
      const g = this.wall.draw();
      this.ghostTile = g;
      this.rule._ghostDisplay = g;
    }

    this.players.forEach((p) => {
      p.hand = this._applyGhostToHand(p.hand);
    });

    this.current = this.dealer;
    this._log(WsMsgType.GAME_START, { dealer: this.dealer, round: this.round });
    this._emitState();
    this._broadcastDeal();
    this._notifyTurn();
    if (this.current !== this.humanSeat) {
      this._scheduleAi(() => this._aiLoop(), 600);
    }
  }

  _applyGhostToHand(hand) {
    if (!this.ghostTile) return sortTiles(hand);
    return sortTiles(
      hand.map((t) => (t === this.ghostTile ? 'ghost' : t)),
    );
  }

  _ghostTilesList() {
    return this.ghostTile ? [this.ghostTile] : [];
  }

  getSnapshot() {
    return {
      phase: this.phase,
      rule: this.rule,
      dealer: this.dealer,
      current: this.current,
      wallRemaining: this.wall.remaining(),
      ghostTile: this.ghostTile,
      players: this.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        seat: i,
        isHuman: p.isHuman,
        score: p.score,
        handCount: p.hand.length,
        hand: i === this.humanSeat ? [...p.hand] : null,
        melds: [...this.melds[i]],
        discards: [...this.discards[i]],
      })),
      lastDiscard: this.lastDiscard,
      lastDiscardPlayer: this.lastDiscardPlayer,
      humanSeat: this.humanSeat,
      paused: this.paused,
    };
  }

  _broadcastDeal() {
    const myHand = this.players[this.humanSeat].hand;
    this.emit('message', {
      type: WsMsgType.DEAL,
      hand: myHand,
      dealer: this.dealer,
      ghostTile: this.ghostTile,
    });
  }

  _emitState() {
    this.emit('sync', this.getSnapshot());
  }

  _log(type, payload) {
    this.actionLog.push({ type, payload, t: Date.now() });
  }

  _notifyTurn() {
    this.emit('message', {
      type: WsMsgType.TURN,
      player: this.current,
      mustDiscard: this._mustDiscard(),
    });
  }

  _mustDiscard() {
    const p = this.players[this.current];
    const c = p.hand.length;
    return c % 3 === 2;
  }

  humanDraw() {
    const p = this._rejectIfPaused();
    if (p) return p;
    if (this.current !== this.humanSeat || this.phase !== PHASE.PLAYING) return { ok: false };
    if (this._mustDiscard()) return { ok: false, reason: '请先出牌' };
    const tile = this.wall.draw();
    if (!tile) return this._doDrawGame();
    const display = tile === this.ghostTile ? 'ghost' : tile;
    this.players[this.humanSeat].hand.push(display);
    this.players[this.humanSeat].hand = sortTiles(this.players[this.humanSeat].hand);
    this._log(WsMsgType.DRAW, { player: this.humanSeat, tile: display });
    this.emit('message', { type: WsMsgType.DRAW, player: this.humanSeat, tile: display });
    this._emitState();
    return { ok: true, tile: display };
  }

  humanDiscard(tile) {
    const p = this._rejectIfPaused();
    if (p) return p;
    if (this.current !== this.humanSeat || this.phase !== PHASE.PLAYING) return { ok: false };
    if (!this._mustDiscard()) return { ok: false, reason: '请先摸牌' };
    return this._discard(this.humanSeat, tile);
  }

  humanAction(action, tile) {
    const p = this._rejectIfPaused();
    if (p) return p;
    if (action === 'win' && this.phase === PHASE.PLAYING && this.current === this.humanSeat) {
      const gt = this._ghostTilesList();
      const hand = this.players[this.humanSeat].hand;
      const melds = this.melds[this.humanSeat];
      if (!WinDetector.canWin(hand, melds, gt).ok) return { ok: false, reason: '不能胡' };
      this._doWin(this.humanSeat, true, tile || hand[hand.length - 1]);
      return { ok: true };
    }
    if (this.phase !== PHASE.REACTION) return { ok: false };
    const idx = this.reactionQueue.indexOf(this.humanSeat);
    if (idx < 0) return { ok: false };
    if (action === 'pass') {
      this.reactionQueue.splice(idx, 1);
      this._continueReaction();
      return { ok: true };
    }
    return this._applyReaction(this.humanSeat, action, tile);
  }

  getAvailableActions() {
    const acts = { self: [], react: [] };
    if (this.paused) return acts;
    if (this.phase === PHASE.PLAYING && this.current === this.humanSeat) {
      const hand = this.players[this.humanSeat].hand;
      const melds = this.melds[this.humanSeat];
      const gt = this._ghostTilesList();
      if (!this._mustDiscard()) acts.self.push('draw');
      else {
        acts.self.push('discard');
        if (WinDetector.canWin(hand, melds, gt).ok) acts.self.push('win');
      }
    }
    if (this.phase === PHASE.REACTION && this.reactionQueue.includes(this.humanSeat)) {
      const tile = this.lastDiscard;
      const hand = this.players[this.humanSeat].hand;
      const melds = this.melds[this.humanSeat];
      const gt = this._ghostTilesList();
      if (ActionValidator.canWin(hand, tile, melds, gt)) acts.react.push('win');
      if (ActionValidator.canPeng(hand, tile)) acts.react.push('peng');
      if (ActionValidator.canGang(hand, tile, 'ming')) acts.react.push('gang');
      acts.react.push('pass');
    }
    return acts;
  }

  _discard(seat, tile) {
    const p = this.players[seat];
    const idx = p.hand.indexOf(tile);
    if (idx < 0) return { ok: false, reason: '无此牌' };
    p.hand.splice(idx, 1);
    const raw = tile === 'ghost' ? this.ghostTile : tile;
    this.discards[seat].push(raw);
    this.lastDiscard = raw;
    this.lastDiscardPlayer = seat;
    this._log(WsMsgType.DISCARD, { player: seat, tile: raw });
    this.emit('message', { type: WsMsgType.DISCARD, player: seat, tile: raw });
    this._emitState();
    this._beginReaction(seat);
    return { ok: true };
  }

  _beginReaction(fromSeat) {
    this.phase = PHASE.REACTION;
    this.reactionQueue = [0, 1, 2, 3].filter((s) => s !== fromSeat);
    this._continueReaction();
  }

  _continueReaction() {
    if (this.paused) return;
    if (this.reactionQueue.length === 0) {
      this.phase = PHASE.PLAYING;
      this.current = (this.lastDiscardPlayer + 1) % 4;
      this._notifyTurn();
      this._emitState();
      if (this.current !== this.humanSeat) this._scheduleAi(() => this._aiLoop(), 500);
      return;
    }
    const seat = this.reactionQueue[0];
    if (seat === this.humanSeat) {
      this.emit('message', {
        type: WsMsgType.ACTION_REQUEST,
        player: seat,
        options: this.getAvailableActions().react,
        tile: this.lastDiscard,
      });
      return;
    }
    const hand = this.players[seat].hand;
    const opts = [];
    const tile = this.lastDiscard;
    const melds = this.melds[seat];
    const gt = this._ghostTilesList();
    if (ActionValidator.canWin(hand, tile, melds, gt)) opts.push('win');
    if (ActionValidator.canGang(hand, tile, 'ming')) opts.push('gang');
    if (ActionValidator.canPeng(hand, tile)) opts.push('peng');
    const act = MahjongAI.chooseReaction(hand, tile, melds, gt, opts.length ? opts : ['pass']);
    if (act === 'pass') {
      this.reactionQueue.shift();
      this._continueReaction();
    } else {
      this._applyReaction(seat, act, tile);
    }
  }

  _applyReaction(seat, action, tile) {
    const hand = this.players[seat].hand;
    if (action === 'win') {
      this.reactionQueue = [];
      this._doWin(seat, false, tile);
      return { ok: true };
    }
    if (action === 'peng') {
      this._removeFromHand(seat, tile, 2);
      this.melds[seat].push({ type: 'peng', tiles: [tile, tile, tile], from: this.lastDiscardPlayer });
      this.discards[this.lastDiscardPlayer].pop();
      this.lastDiscard = null;
      this.current = seat;
      this.phase = PHASE.PLAYING;
      this.reactionQueue = [];
      this._emitState();
      if (seat !== this.humanSeat) this._scheduleAi(() => this._aiDiscard(seat), 500);
      return { ok: true };
    }
    if (action === 'gang') {
      this._removeFromHand(seat, tile, 3);
      this.melds[seat].push({ type: 'ming', tiles: [tile, tile, tile, tile], from: this.lastDiscardPlayer });
      this.discards[this.lastDiscardPlayer].pop();
      this.current = seat;
      this.phase = PHASE.PLAYING;
      this.reactionQueue = [];
      const drawn = this.wall.draw();
      if (drawn) {
        const d = drawn === this.ghostTile ? 'ghost' : drawn;
        this.players[seat].hand.push(d);
        this.players[seat].hand = sortTiles(this.players[seat].hand);
      }
      this._emitState();
      if (seat !== this.humanSeat) this._scheduleAi(() => this._aiDiscard(seat), 500);
      return { ok: true };
    }
    return { ok: false };
  }

  _removeFromHand(seat, tile, n) {
    const p = this.players[seat];
    let left = n;
    for (let i = p.hand.length - 1; i >= 0 && left > 0; i--) {
      const t = p.hand[i];
      const match = t === tile || t === 'ghost' || (t === 'ghost' && tile === this.ghostTile);
      if (t === tile || (t === 'ghost' && this.ghostTile === tile)) {
        p.hand.splice(i, 1);
        left--;
      }
    }
    while (left > 0) {
      const idx = p.hand.findIndex((t) => t === tile || t === 'ghost');
      if (idx < 0) break;
      p.hand.splice(idx, 1);
      left--;
    }
    p.hand = sortTiles(p.hand);
  }

  _doWin(seat, isZimo, winTile) {
    this.phase = PHASE.SETTLE;
    const p = this.players[seat];
    const hand = isZimo ? [...p.hand] : [...p.hand, winTile === 'ghost' ? 'ghost' : winTile];
    if (!isZimo && winTile) {
      const d = winTile === this.ghostTile ? 'ghost' : winTile;
      if (!hand.includes(d)) hand.push(d);
    }
    const fanResult = FanCalculator.calculate({
      handTiles: hand.map((t) => (t === 'ghost' ? 'ghost' : t)),
      melds: this.melds[seat],
      isZimo,
      isMenqing: this.melds[seat].length === 0,
      isGangShang: false,
      isQiangGang: false,
      ghostTiles: this._ghostTilesList(),
      rule: this.rule,
    });
    const base = this.rule.baseScore || 1;
    const score = base * Math.max(1, fanResult.totalFan);
    p.score += score;
    if (!isZimo && this.lastDiscardPlayer >= 0) {
      this.players[this.lastDiscardPlayer].score -= score;
    } else {
      for (let i = 0; i < 4; i++) {
        if (i !== seat) this.players[i].score -= Math.floor(score / 3);
      }
    }
    const settle = {
      winner: seat,
      isZimo,
      winTile,
      fans: fanResult.fans,
      totalFan: fanResult.totalFan,
      score,
      players: this.players.map((pl) => ({ name: pl.name, score: pl.score })),
    };
    this._log(WsMsgType.SETTLE, settle);
    this.emit('message', { type: WsMsgType.SETTLE, ...settle });
    this.emit('sync', this.getSnapshot());
    return { ok: true };
  }

  _doDrawGame() {
    this.phase = PHASE.SETTLE;
    this.emit('message', { type: WsMsgType.ROUND_END, draw: true });
    return { ok: true };
  }

  _aiLoop() {
    if (this.paused || this.phase === PHASE.SETTLE) return;
    if (this.current !== this.humanSeat && this.phase === PHASE.PLAYING) {
      if (!this._mustDiscard()) {
        const tile = this.wall.draw();
        if (!tile) {
          this._doDrawGame();
          return;
        }
        const display = tile === this.ghostTile ? 'ghost' : tile;
        this.players[this.current].hand.push(display);
        this.players[this.current].hand = sortTiles(this.players[this.current].hand);
        this.emit('message', { type: WsMsgType.DRAW, player: this.current, tile: null });
        this._emitState();
      }
      this._scheduleAi(() => this._aiDiscard(this.current), 400);
    }
  }

  _aiDiscard(seat) {
    if (this.paused || this.phase === PHASE.SETTLE) return;
    const hand = this.players[seat].hand;
    const tile = MahjongAI.chooseDiscard(hand, this.melds[seat], this._ghostTilesList());
    this.current = seat;
    this._discard(seat, tile);
  }
}
