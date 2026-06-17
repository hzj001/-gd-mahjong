import Emitter from '../libs/tinyemitter';
import { API_BASE, WS_URL, Endpoints, WsMsgType } from './endpoints';
import MockServer from './MockServer';
import WinDetector from '../rules/WinDetector';

/**
 * API 客户端 — useMock=false 时对接 Go 后端
 */
export default class ApiClient extends Emitter {
  constructor(options = {}) {
    super();
    this.useMock = options.useMock !== false;
    this.apiBase = options.apiBase || API_BASE;
    this.wsUrl = options.wsUrl || WS_URL;
    this.token = '';
    this.user = null;
    this.room = null;
    this.snapshot = null;
    this._paused = false;
    this._ws = null;
    this._wsConnected = false;
    this._intentionalClose = false;
    this._reconnectTimer = null;
    this._reconnectAttempt = 0;
    this._reactOptions = [];
    this._reactTile = null;
    this._wsConnectResolve = null;
    this._wsConnectReject = null;
    this.mockServer = new MockServer();
    if (this.useMock) {
      this._bindMockServer();
    } else {
      this._bindWsOnce();
    }
  }

  _bindMockServer() {
    this.mockServer.on('message', (msg) => this._handleWsMessage(msg));
    this.mockServer.on('sync', (snap) => {
      this.snapshot = snap;
      this.emit('sync', snap);
    });
  }

  /** 微信全局 WS 监听只注册一次 */
  _bindWsOnce() {
    if (this._wsHandlersBound) return;
    this._wsHandlersBound = true;

    wx.onSocketOpen(() => {
      this._wsConnected = true;
      this._reconnectAttempt = 0;
      this.emit('ws_connected');
      if (this._wsConnectResolve) {
        this._wsConnectResolve();
        this._wsConnectResolve = null;
        this._wsConnectReject = null;
      }
    });

    wx.onSocketError((e) => {
      if (this._wsConnectReject) {
        this._wsConnectReject(e);
        this._wsConnectResolve = null;
        this._wsConnectReject = null;
      }
      this.emit('ws_error', e);
    });

    wx.onSocketMessage((res) => {
      try {
        const msg = JSON.parse(res.data);
        this._handleWsMessage(msg);
      } catch (err) {
        /* ignore */
      }
    });

    wx.onSocketClose(() => {
      this._wsConnected = false;
      this._ws = null;
      if (this._intentionalClose) {
        this._intentionalClose = false;
        return;
      }
      if (this.room?.status === 'playing') {
        this.emit('ws_disconnect');
        this._scheduleReconnect();
      }
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this.useMock) return;
    const delay = Math.min(1000 * 2 ** this._reconnectAttempt, 16000);
    this._reconnectAttempt += 1;
    this.emit('ws_reconnecting', { attempt: this._reconnectAttempt, delay });
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      try {
        await this._connectWs();
        this.emit('ws_reconnected');
      } catch (e) {
        this._scheduleReconnect();
      }
    }, delay);
  }

  async login() {
    if (this.useMock) {
      await this._delay(200);
      this.user = {
        id: 'u_local_001',
        nickName: '玩家',
        avatarUrl: '',
        coin: 10000,
        rank: '青铜III',
      };
      this.token = 'mock_token_' + Date.now();
      return { code: 0, data: this.user };
    }
    const profile = await this._getWxUserInfo();
    const wxCode = await this._wxLoginCode();
    const res = await this._safeHttp(Endpoints.wxLogin, 'POST', {
      code: wxCode,
      nickName: profile.nickName,
      avatarUrl: profile.avatarUrl,
    });
    if (res.code !== 0) return res;
    this.token = res.data.token;
    this._applyProfile(res.data.user);
    return { code: 0, data: this.user };
  }

  _getWxUserInfo() {
    return new Promise((resolve) => {
      if (typeof wx.getUserProfile !== 'function') {
        resolve({ nickName: '玩家', avatarUrl: '' });
        return;
      }
      wx.getUserProfile({
        desc: '用于显示昵称和头像',
        success: (res) =>
          resolve({
            nickName: res.userInfo?.nickName || '玩家',
            avatarUrl: res.userInfo?.avatarUrl || '',
          }),
        fail: () => resolve({ nickName: '玩家', avatarUrl: '' }),
      });
    });
  }

  _wxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) resolve(res.code);
          else reject(new Error('wx.login 无 code'));
        },
        fail: reject,
      });
    });
  }

  async getProfile() {
    if (this.useMock) return { code: 0, data: this.user };
    const res = await this._safeHttp(Endpoints.userProfile, 'GET');
    if (res.code === 0 && res.data) this._applyProfile(res.data);
    return res;
  }

  async getStats() {
    if (this.useMock) {
      return {
        code: 0,
        data: {
          totalGames: 0,
          winCount: 0,
          maxFan: 0,
          rankScore: 0,
          coin: this.user?.coin || 0,
          rank: this.user?.rank,
        },
      };
    }
    return this._safeHttp(Endpoints.userStats, 'GET');
  }

  async getRankList() {
    if (this.useMock) {
      return {
        code: 0,
        data: [
          { nickName: '玩家', rank: '青铜III', rankScore: 0 },
        ],
      };
    }
    return this._safeHttp(Endpoints.rankList, 'GET');
  }

  async getGameRecords(roomId) {
    if (this.useMock) return { code: 0, data: [] };
    return this._safeHttp(`${Endpoints.gameRecord}?roomId=${encodeURIComponent(roomId)}`, 'GET');
  }

  async getRoomInfo() {
    if (this.useMock) return { code: 0, data: this.room };
    if (!this.room?.roomId) return { code: 400, message: '无房间' };
    const res = await this._safeHttp(
      `${Endpoints.roomInfo}?roomId=${encodeURIComponent(this.room.roomId)}`,
      'GET',
    );
    if (res.code === 0) this.room = res.data;
    return res;
  }

  async checkHealth() {
    if (this.useMock) return { code: 0, data: { status: 'mock' } };
    return new Promise((resolve) => {
      wx.request({
        url: this.apiBase.replace('/api/v1', '/health'),
        success: (res) => resolve(res.data || { code: 0 }),
        fail: () => resolve({ code: -1, message: 'offline' }),
      });
    });
  }

  async refreshProfile() {
    const res = await this.getProfile();
    return res.code === 0 ? this.user : null;
  }

  _applyProfile(data) {
    this.user = {
      id: String(data.id),
      nickName: data.nickName,
      avatarUrl: data.avatarUrl || '',
      coin: data.coin,
      rank: data.rank,
      rankScore: data.rankScore,
      wins: data.wins,
      losses: data.losses,
    };
  }

  async createRoom(opts = {}) {
    if (this.useMock) {
      await this._delay(150);
      this.room = {
        roomId: 'R' + (100000 + Math.floor(Math.random() * 899999)),
        ruleId: opts.ruleId || 'gd_tuidaohu_v1',
        baseScore: opts.baseScore || 1,
        ownerId: this.user.id,
        players: [this._selfPlayer()],
        maxPlayers: 4,
        status: 'waiting',
      };
      return { code: 0, data: this.room };
    }
    const res = await this._safeHttp(Endpoints.roomCreate, 'POST', opts);
    if (res.code === 0) this.room = res.data;
    return res;
  }

  async joinRoom(roomId) {
    if (this.useMock) {
      await this._delay(150);
      if (!this.room || this.room.roomId !== roomId) {
        this.room = {
          roomId,
          ruleId: 'gd_tuidaohu_v1',
          baseScore: 1,
          ownerId: 'ai_host',
          players: [],
          maxPlayers: 4,
          status: 'waiting',
        };
      }
      if (!this.room.players.find((p) => p.id === this.user.id)) {
        this.room.players.push(this._selfPlayer());
      }
      while (this.room.players.length < 4) {
        const n = this.room.players.length;
        this.room.players.push({
          id: `ai_${n}`,
          nickName: `电脑${n}`,
          isHuman: false,
          ready: true,
        });
      }
      return { code: 0, data: this.room };
    }
    const res = await this._safeHttp(Endpoints.roomJoin, 'POST', { roomId });
    if (res.code === 0) this.room = res.data;
    return res;
  }

  async quickMatch() {
    if (this.useMock) {
      const res = await this.createRoom({ quick: true });
      await this.joinRoom(res.data.roomId);
      return { code: 0, data: this.room };
    }
    const res = await this._safeHttp(Endpoints.matchQuick, 'POST');
    if (res.code === 0) this.room = res.data;
    return res;
  }

  async setReady(ready = true) {
    if (this.useMock) {
      const me = this.room.players.find((p) => p.id === this.user.id);
      if (me) me.ready = ready;
      return { code: 0, data: this.room };
    }
    const res = await this._safeHttp(Endpoints.roomReady, 'POST', { ready });
    if (res.code === 0) this.room = res.data;
    return res;
  }

  async startGame() {
    if (this.useMock) {
      if (this.room) this.room.status = 'playing';
      const players = this.room.players.map((p, i) => ({
        id: p.id,
        name: p.nickName,
        isHuman: p.isHuman !== false && p.id === this.user.id,
        seat: i,
        score: 0,
      }));
      const humanSeat = players.findIndex((p) => p.isHuman);
      this.mockServer.startGame(players, humanSeat >= 0 ? humanSeat : 0);
      return { code: 0 };
    }
    await this._connectWs();
    const waitDeal = this._waitGameStart();
    const res = await this._safeHttp(Endpoints.roomStart, 'POST', {});
    if (res.code !== 0) return res;
    try {
      await waitDeal;
    } catch (e) {
      return { code: 500, message: e.message || '开局超时' };
    }
    if (this.room) this.room.status = 'playing';
    return { code: 0 };
  }

  _waitGameStart() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('等待发牌超时'));
      }, 15000);
      const done = () => {
        clearTimeout(timer);
        cleanup();
        resolve();
      };
      const onWs = (msg) => {
        if (msg.type === 'deal' || msg.type === 'game_start') done();
      };
      const onSync = (snap) => {
        if (snap?.players?.some((p) => p.hand?.length > 0)) done();
      };
      const cleanup = () => {
        this.off('ws', onWs);
        this.off('sync', onSync);
      };
      this.on('ws', onWs);
      this.on('sync', onSync);
      if (this.snapshot?.players?.some((p) => p.hand?.length > 0)) done();
    });
  }

  sendGameAction(action, payload = {}) {
    if (this.useMock) {
      const ms = this.mockServer;
      switch (action) {
        case 'draw':
          return ms.humanDraw();
        case 'discard':
          return ms.humanDiscard(payload.tile);
        case 'peng':
        case 'gang':
        case 'win':
        case 'pass':
          return ms.humanAction(action, payload.tile);
        default:
          return { ok: false };
      }
    }
    this._wsSend({ action, ...payload });
    return { ok: true };
  }

  getSnapshot() {
    if (this.useMock) return this.mockServer.getSnapshot();
    return this.snapshot;
  }

  getAvailableActions() {
    if (this.useMock) return this.mockServer.getAvailableActions();
    const snap = this.snapshot;
    if (!snap || this._paused || snap.paused) return { self: [], react: [] };
    const acts = { self: [], react: [] };
    const humanSeat = snap.humanSeat;
    if (this._reactOptions?.length && snap.phase === 'reaction') {
      acts.react = [...this._reactOptions];
      return acts;
    }
    if (snap.phase === 'playing' && snap.current === humanSeat) {
      const hand = snap.players[humanSeat]?.hand || [];
      const melds = snap.melds?.[humanSeat] || [];
      const gt = snap.ghostTile ? [snap.ghostTile] : [];
      if (hand.length % 3 === 1) {
        acts.self.push('draw');
      } else {
        acts.self.push('discard');
        if (WinDetector.canWin(hand, melds, gt).ok) acts.self.push('win');
      }
    }
    return acts;
  }

  isPaused() {
    if (this.useMock) return !!this.mockServer.paused;
    return this._paused;
  }

  pauseGame() {
    if (this.useMock) {
      this.mockServer.pause();
      return { code: 0, paused: true };
    }
    this._wsSend({ action: 'pause' });
    this._paused = true;
    return { code: 0, paused: true };
  }

  resumeGame() {
    if (this.useMock) {
      this.mockServer.resume();
      return { code: 0, paused: false };
    }
    this._wsSend({ action: 'resume' });
    this._paused = false;
    return { code: 0, paused: false };
  }

  togglePause() {
    if (this.useMock) {
      const paused = this.mockServer.togglePause();
      return { code: 0, paused };
    }
    if (this._paused) return this.resumeGame();
    return this.pauseGame();
  }

  nextRound() {
    if (this.useMock) {
      this.mockServer._startRound();
      return { code: 0 };
    }
    this._wsSend({ action: 'next_round' });
    return { code: 0 };
  }

  async abortGame() {
    if (this.useMock) {
      this.mockServer.reset();
      if (this.room) {
        this.room.status = 'waiting';
        this.room.players?.forEach((p) => {
          p.ready = p.id === this.user?.id ? false : p.ready;
        });
      }
      this.emit('game_aborted');
      return { code: 0 };
    }
    await this._safeHttp(Endpoints.roomLeave, 'POST', { abort: true });
    this._closeWs();
    if (this.room) this.room.status = 'waiting';
    this.snapshot = null;
    this.emit('game_aborted');
    return { code: 0 };
  }

  async leaveRoom() {
    if (this.useMock) {
      this.mockServer.reset();
      this.room = null;
      return { code: 0 };
    }
    await this._safeHttp(Endpoints.roomLeave, 'POST', {});
    this._closeWs();
    this.room = null;
    this.snapshot = null;
    return { code: 0 };
  }

  _selfPlayer() {
    return {
      id: this.user.id,
      nickName: this.user.nickName,
      isHuman: true,
      ready: false,
    };
  }

  _connectWs() {
    if (this._wsConnected && this._ws) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this._wsConnectResolve = resolve;
      this._wsConnectReject = reject;
      if (this._ws) this._closeWs();
      const url = `${this.wsUrl}?token=${encodeURIComponent(this.token)}`;
      this._ws = wx.connectSocket({ url });
      setTimeout(() => {
        if (this._wsConnectReject) {
          this._wsConnectReject(new Error('WS 连接超时'));
          this._wsConnectResolve = null;
          this._wsConnectReject = null;
        }
      }, 8000);
    });
  }

  _handleWsMessage(msg) {
    const type = msg.type;
    if (type === WsMsgType.ERROR || type === 'error') {
      this.emit('ws', msg);
      this.emit('error', msg);
      return;
    }
    if (type === WsMsgType.SYNC || type === 'sync') {
      this.snapshot = msg.snapshot;
      if (this.snapshot?.phase !== 'reaction') {
        this._reactOptions = [];
        this._reactTile = null;
      }
      if (this.snapshot?.paused != null) this._paused = !!this.snapshot.paused;
      this.emit('sync', this.snapshot);
      this.emit('ws', msg);
      return;
    }
    if (type === WsMsgType.ACTION_REQUEST || type === 'action_request') {
      this._reactOptions = msg.options || [];
      this._reactTile = msg.tile;
      this.emit('ws', msg);
      return;
    }
    if (type === WsMsgType.GAME_PAUSE || type === 'game_pause') {
      this._paused = true;
      this.emit('ws', msg);
      return;
    }
    if (type === WsMsgType.GAME_RESUME || type === 'game_resume') {
      this._paused = false;
      this.emit('ws', msg);
      return;
    }
    if (type === WsMsgType.SETTLE || type === 'settle') {
      this._reactOptions = [];
    }
    this.emit('ws', msg);
  }

  _closeWs() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._intentionalClose = true;
    try {
      wx.closeSocket();
    } catch (e) {
      /* ignore */
    }
    this._ws = null;
    this._wsConnected = false;
  }

  _wsSend(data) {
    if (!this._wsConnected) return;
    wx.sendSocketMessage({ data: JSON.stringify(data) });
  }

  async _safeHttp(path, method, body) {
    try {
      return await this._http(path, method, body);
    } catch (e) {
      return { code: -1, message: e.errMsg || e.message || '网络错误' };
    }
  }

  async _http(path, method, body) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.apiBase}${path}`,
        method,
        data: body,
        header: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        success: (res) => {
          const data = res.data;
          if (data && typeof data.code === 'number') resolve(data);
          else resolve({ code: res.statusCode === 200 ? 0 : res.statusCode, data });
        },
        fail: reject,
      });
    });
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export { WsMsgType };
