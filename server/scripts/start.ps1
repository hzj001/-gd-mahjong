# 一键启动后端（Windows PowerShell）
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "已创建 .env，可按需填写 WECHAT_APP_ID / WECHAT_APP_SECRET"
}

Write-Host ">>> 启动 MySQL + Redis + API ..."
docker compose up -d --build

Write-Host ""
Write-Host ">>> 等待 API 就绪 ..."
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      Write-Host "OK  后端已启动: http://127.0.0.1:8080"
      Write-Host "    健康检查: http://127.0.0.1:8080/health"
      Write-Host "    WebSocket: ws://127.0.0.1:8080/ws"
      exit 0
    }
  } catch {}
  Start-Sleep -Seconds 2
}
Write-Host "WARN API 尚未响应，请执行: docker compose logs -f api"
exit 1
