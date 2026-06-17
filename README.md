# 粤麻 · 广东推倒胡（微信小游戏）

广东麻将微信小游戏。支持 **Mock 单机** 与 **Go 权威后端** 两种模式。

## 快速运行（Mock 单机）

1. 用 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 打开本项目
2. 确认 `project.config.json` 中 `compileType` 为 `game`
3. 编辑 `js/config/env.js`，设 `useMock: true`
4. 编译运行 → 大厅 → 快速开始 → 开始对局

游戏默认 **横屏**；无 mp3 时使用程序化 BGM/音效（见 `audio/README.md`）。

## 联调 Go 后端

### 1. 启动后端

```powershell
cd server
.\scripts\start.ps1
```

或仅启动数据库后本地跑 API：

```bash
cd server
docker compose up -d mysql redis
go run ./cmd/api
```

### 2. 前端切真实后端

编辑 `js/config/env.js`：

```javascript
export default {
  useMock: false,
  apiBase: 'http://127.0.0.1:8080/api/v1',
  wsUrl: 'ws://127.0.0.1:8080/ws',
};
```

真机调试时将地址改为电脑局域网 IP，并在开发者工具勾选「不校验合法域名」。

### 3. 微信登录

- 开发：`server` 默认 `mock_login: true`，`wx.login()` code 可直接登录
- 正式：在 `server/.env` 填写 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`

详细 API 与 Docker 说明：[server/README.md](server/README.md)

## 目录结构

```
├── js/
│   ├── config/env.js      # useMock / API 地址开关
│   ├── network/           # ApiClient、MockServer
│   ├── scenes/            # 大厅、房间、牌桌
│   └── ...
├── server/                # Go 后端（HTTP + WS + MySQL + Redis）
├── docs/                  # 产品方案
├── game.js
└── game.json
```

## 操作说明

- **房间准备**：房间内可「准备 / 取消准备」；房主开局后，其他玩家会自动进入牌桌
- **摸牌 / 出牌 / 自摸胡 / 碰杠胡过**：牌桌底部操作栏
- **出牌确认**：先点击手牌选中，再点击「出牌」按钮确认，避免误触
- **结算 / 流局**：显示自摸/点炮、番型、各家得分；胡牌或流局后点屏幕继续
- **我的战绩 / 排行榜**：大厅「我的战绩」按钮
- **加入房间**：大厅输入房间号，或好友分享链接带 `roomId` 参数
- **暂停 / 继续 / 中止 / 退出**：牌桌右上角

## 文档

- [广东麻将微信小游戏-方案说明.md](docs/广东麻将微信小游戏-方案说明.md)
- [server/README.md](server/README.md)
