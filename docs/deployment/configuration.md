# 配置说明

完整变量表在仓库根目录 [README](../../README.md#配置) 和 [`.env.example`](../../.env.example)。这里只说明部署时最容易出错的几项。

## 必填

### `AUTH_SECRET`

会话签名密钥。生产环境必须满足：

- 已配置，且不是 `.env.example` 里的示例值；
- 至少 32 个字符。

不满足时，`instrumentation.ts` 会在服务启动阶段抛错，容器反复重启并在日志里给出原因。生成方式：

```bash
openssl rand -base64 48
```

`deploy.sh` 在首次创建 `.env` 时会自动生成并写入。

## 版本与镜像

### `HOMEHI_VERSION`

`docker-compose.yml` 用 `${HOMEHI_VERSION:-latest}` 选择 `homehi-web` 与 `homehi-worker` 的标签。`deploy.sh` / `update.sh` 会把版本写回 `.env`，确保 web 与 worker 始终同版本。

生产环境建议固定具体版本，不要长期跟随 `latest`。

## 数据导出

### `DATA_EXPORT_ENABLED`

- 默认 `false`：前端入口隐藏，直接访问 `/api/export` 也会返回 403。
- 设为 `true` / `1` 后：只有家庭管理员（OWNER）能导出；每次导出写入 `AuditLog`。
- 导出 ZIP 只通过鉴权接口实时打包，不写入 `public/`。
- 导出包含私密内容，使用后建议改回 `false`。

## 存储

### `STORAGE_DRIVER` / `STORAGE_DIR` / OSS 变量

- `local`（默认）：文件写入 `STORAGE_DIR`，Docker 内是 `/app/storage`。
- `oss`：新上传文件写入阿里云 OSS；历史文件按上传时记录的后端读取。
- 切换后端不会迁移已有文件，也不会删除本地目录。两种后端可能需要同时保留。
- OSS AccessKey Secret 以明文保存在数据库中，请限制数据库文件权限，并为 HomeHi 创建只授予目标 Bucket 所需读写权限的 RAM 子账号。

## 备份

### `BACKUP_DIR` / `BACKUP_KEEP`

- `BACKUP_DIR` 默认 `./backups`，Docker 内是 `/app/backups`。
- `BACKUP_KEEP` 默认 `7`，最小 `1`，最大 `365`。
- 只清理形如 `homehi-YYYYMMDD-HHMMSS` 的目录，不会动其他文件。

## 邮件与提醒

### `SMTP_*`

提醒由 worker 发送。SMTP 未配置完整时，提醒记录会显示失败原因。配置后请在「设置 → 邮件」发送测试邮件。

### `WORKER_POLL_SECONDS` / `WORKER_REMINDER_HORIZON_DAYS`

- 轮询间隔默认 30 秒。
- 重复日程的提醒默认向后生成 180 天。

## 上传

### `MAX_UPLOAD_MB`

单个文件上传上限，默认 100。反向代理的请求体上限必须不小于这个值（见[反向代理](reverse-proxy.md)）。

## 其他

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | 邮件和绝对链接使用的公开地址，不要带结尾斜杠 |
| `DEFAULT_TIMEZONE` | 新家庭默认时区，IANA 名称 |
| `COOKIE_SECURE` | 留空自动判断；局域网 HTTP 访问时不要设 true |
| `AMAP_API_KEY` / `AMAP_CITY` | 高德**Web 服务** Key，仅服务端使用；不配置时手填地点 |
| `FFMPEG_PATH` | 自定义 ffmpeg 路径；Docker worker 镜像自带系统 ffmpeg |
