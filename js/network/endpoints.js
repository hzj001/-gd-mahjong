/**
 * Go 后端 API — 本地开发默认 localhost:8080
 * 真机调试请改为电脑局域网 IP，并在微信后台配置 request 合法域名
 */
export const API_BASE = 'http://127.0.0.1:8080/api/v1';
export const WS_URL = 'ws://127.0.0.1:8080/ws';

export const Endpoints = {
  wxLogin: '/auth/wx-login',
  userProfile: '/user/profile',
  userStats: '/user/stats',
  roomCreate: '/room/create',
  roomJoin: '/room/join',
  roomInfo: '/room/info',
  roomReady: '/room/ready',
  roomLeave: '/room/leave',
  roomStart: '/room/start',
  matchQuick: '/match/quick',
  gameRecord: '/game/record',
  rankList: '/rank/list',
};

/** WebSocket 消息类型 — 与 Go 协议一致 */
export const WsMsgType = {
  GAME_START: 'game_start',
  DEAL: 'deal',
  TURN: 'turn',
  DRAW: 'draw',
  DISCARD: 'discard',
  ACTION_REQUEST: 'action_request',
  ACTION_RESULT: 'action_result',
  REACTION: 'reaction',
  SETTLE: 'settle',
  ROUND_END: 'round_end',
  SYNC: 'sync',
  ERROR: 'error',
  GAME_PAUSE: 'game_pause',
  GAME_RESUME: 'game_resume',
  GAME_ABORTED: 'game_aborted',
};
