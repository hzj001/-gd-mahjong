# 粤麻 Go 后端服务

广东麻将微信小游戏权威服务端：**HTTP API + WebSocket + MySQL + Redis**。

## 架构

```
客户端 (微信小游戏)
    │  HTTP  /api/v1/*
    │  WS    /ws?token=JWT
    ▼
┌─────────────────────────────────────┐
│  Gin Router                         │
│  ├── Auth (JWT + 微信 code2session) │
│  ├── Room / Match                   │
│  └── WebSocket Hub                  │
├─────────────────────────────────────┤
│  RoomManager + Game Engine (权威)   │
├─────────────────────────────────────┤
│  MySQL (用户/房间/战绩)  Redis (缓存) │
└─────────────────────────────────────┘
```

## Docker 一键联调（推荐）

```powershell
cd server
.\scripts\start.ps1
```

Linux / macOS：

```bash
cd server
chmod +x scripts/start.sh
./scripts/start.sh
```

脚本会：复制 `.env.example` → `.env`（若不存在）、`docker compose up -d --build`、轮询 `http://127.0.0.1:8080/health`。

服务就绪后：

- API：`http://127.0.0.1:8080/api/v1`
- WebSocket：`ws://127.0.0.1:8080/ws`
- MySQL：`127.0.0.1:3306`（root / root123，库 `gd_mahjong`）
- Redis：`127.0.0.1:6379`

## 本地开发（不用 Docker 跑 API）

### 1. 启动 MySQL + Redis

```bash
cd server
docker compose up -d mysql redis
```

### 2. 运行 API

```bash
cd server
go mod tidy
go run ./cmd/api
```

默认读取 `config/config.example.yaml`，监听 `http://127.0.0.1:8080`。

## 微信登录配置

### 开发模式（默认）

`wechat.mock_login: true` 时，任意 `wx.login()` 返回的 code 均可登录（OpenID 为 `mock_<code>`）。

### 正式模式

在 `server/.env` 中填写：

```env
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的AppSecret
WECHAT_MOCK_LOGIN=false
```

或在 `config/config.yaml` 中设置 `app_id` / `app_secret`。两者都填时自动关闭 mock 登录。

环境变量也可覆盖：`MYSQL_DSN`、`REDIS_ADDR`、`JWT_SECRET`。

## 前端对接

编辑 `js/config/env.js`：

```javascript
export default {
  useMock: false,   // 对接 Go 后端
  apiBase: 'http://127.0.0.1:8080/api/v1',
  wsUrl: 'ws://127.0.0.1:8080/ws',
};
```

- 单机 Mock：设 `useMock: true`，无需启动后端
- 真机调试：将 `apiBase` / `wsUrl` 改为电脑局域网 IP，微信开发者工具勾选「不校验合法域名」
- 登录：`ApiClient.login()` 已调用 `wx.login()` 获取真实 code

## API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/v1/auth/wx-login` | 登录，body: `{ "code", "nickName?", "avatarUrl?" }` |
| GET | `/api/v1/user/profile` | 用户信息（含段位/积分/胜负） |
| GET | `/api/v1/user/stats` | 战绩统计（总局/胜场/最大番） |
| POST | `/api/v1/room/create` | 创建房间 |
| POST | `/api/v1/room/join` | 加入房间 |
| GET | `/api/v1/room/info?roomId=` | 房间详情 |
| POST | `/api/v1/room/ready` | 准备 |
| POST | `/api/v1/room/start` | 开始对局（需先连 WS） |
| POST | `/api/v1/room/leave` | 离开，`{ "abort": true }` 中止本局 |
| POST | `/api/v1/match/quick` | 快速匹配（自动补 AI） |
| GET | `/api/v1/game/record?roomId=` | 房间战绩 |
| GET | `/api/v1/rank/list` | 排行榜 |
| GET | `/ws?token=JWT` | WebSocket 对局 |

## 战绩与段位持久化

胡牌结算时 `RankService.PersistSettle` 会：

1. 写入 `game_records`（番数、赢家、完整结算 JSON）
2. 更新真人玩家 `users`（金币、rank_score、rank_tier、wins/losses）
3. 更新 `user_stats`（总局数、胜场、最大番）

段位由积分自动映射：青铜 → 白银 → 黄金 → 铂金 → 钻石 → 大师。

## WebSocket 协议

**客户端 → 服务端**

```json
{ "action": "draw" }
{ "action": "discard", "tile": "3w" }
{ "action": "peng" | "gang" | "win" | "pass", "tile": "3w" }
{ "action": "pause" | "resume" | "next_round" }
```

**服务端 → 客户端**

`game_start`, `deal`, `turn`, `draw`, `discard`, `action_request`, `settle`, `round_end`, `sync`, `game_pause`, `game_resume`, `error`

`sync` 消息含完整 `snapshot`（仅自己可见手牌）。

## 配置

| 文件 | 用途 |
|------|------|
| `config/config.example.yaml` | 本地 `go run` 默认 |
| `config/config.docker.yaml` | Docker 容器内（服务名 mysql/redis） |
| `.env` | Docker Compose 环境变量（从 `.env.example` 复制） |

## 目录结构

```
server/
├── cmd/api/main.go
├── config/
├── scripts/start.ps1, start.sh
├── internal/
│   ├── auth/          JWT + 微信
│   ├── cache/         Redis
│   ├── game/          权威麻将引擎
│   ├── handler/
│   ├── repository/    MySQL + 战绩
│   ├── service/       rank.go 段位持久化
│   └── ws/
├── migrations/001_init.sql
├── docker-compose.yml
└── Dockerfile
```

## 开发说明

- 对局逻辑在 `internal/game/engine.go`，与前端 MockServer 协议对齐
- 房间热数据在内存 + Redis，战绩持久化在 MySQL
- 快速匹配自动补 3 个 AI（`user_id >= 900000`）
- 生产建议：Nginx 反代 + WSS、JWT 密钥轮换、MySQL 主从
