/**
 * 前端运行环境配置
 *
 * useMock: true  = 本地 Mock，无需后端（单机调试）
 * useMock: false = 对接 Go 服务（先启动 server/scripts/start.ps1）
 *
 * 真机联调：将 apiBase / wsUrl 改为电脑局域网 IP
 */
export default {
  useMock: false,
  apiBase: 'http://127.0.0.1:8080/api/v1',
  wsUrl: 'ws://127.0.0.1:8080/ws',
};
