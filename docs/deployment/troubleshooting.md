# 故障排查

先看容器状态和日志：

```bash
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 worker
```

## 部署阶段

### `当前架构是 aarch64 ... 不支持 ARM64`

HomeHi 只提供 AMD64 镜像。不要在 ARM NAS 上尝试 `--platform` 伪造；需要换用 AMD64 设备或由维护者另外构建。

### ACR 登录失败（401 / unauthorized）

- 确认 `deploy.sh` 中的只读账号和密码没有多余空格。
- 确认账号对 `opxk-public` 命名空间有拉取权限。
- 确认 NAS 能访问 `registry.cn-hangzhou.aliyuncs.com`。
- 凭证泄露或轮换后，更新脚本并重新执行。

### `manifest unknown` / 拉不到指定版本

`HOMEHI_VERSION` 指向的标签不存在。先试试 `bash deploy.sh latest`，或向维护者确认版本号。

### 端口被占用

默认映射 `3000:3000`。如果 NAS 上已有服务占用 3000，需要修改 `docker-compose.yml` 的端口映射，例如 `3001:3000`，并同步调整反向代理。

### 容器反复重启，日志出现 AUTH_SECRET 错误

生产环境要求 `AUTH_SECRET`：

- 已填写；
- 不是 `.env.example` 的示例值；
- 至少 32 个字符。

修改 `.env` 后执行 `docker compose up -d`。`deploy.sh` 首次运行会自动生成。

### 权限错误（`EACCES` / `permission denied`）

容器默认以 root 运行，挂载目录里的文件会归 root 所有。NAS 用户直接编辑 `data/` 或 `storage/` 可能没有权限。可以：

- 用 `sudo` 操作；
- 或调整目录所有者，但不要删除数据。

不要把目录权限开放给所有网络用户。

## 使用阶段

### 登录后立刻回到登录页

Cookie 的 `Secure` 设置与访问协议不一致。局域网 HTTP 访问时确保 `COOKIE_SECURE` 为 `false` 或留空；HTTPS 时确保代理传递 `X-Forwarded-Proto: https`。

### 提示「尝试次数过多」

登录失败会按邮箱和 IP 限流：同一邮箱 15 分钟内失败 5 次会锁定 15 分钟；同一 IP 失败 20 次会锁定。等待窗口结束，或由管理员在数据库中清理 `AuthThrottle` 表中对应的行。

### 修改密码后其他设备被退出

这是安全设计，不是故障。当前设备会保持登录，其他设备需要重新登录。

### 提醒没有发出

1. worker 是否在运行：`docker compose ps` 中 worker 应为 `running`。
2. SMTP 是否配置完整：在「设置 → 邮件」发送测试邮件。
3. 成员是否关闭了对应通知类型。
4. 查看提醒记录中的失败原因和 worker 日志。

### 照片没有缩略图 / 视频不能在线播放

- 图片变体由 web 和 worker 生成，稍等或检查 worker 日志。
- 视频转码依赖 ffmpeg；worker 镜像已内置。自定义部署时检查 `FFMPEG_PATH` 或系统 ffmpeg。
- 缩略图失败不会影响原图打开和下载。

### 上传失败（413 / 请求体过大）

反向代理的请求体上限小于 `MAX_UPLOAD_MB`。把 Nginx 的 `client_max_body_size` 调到不小于该值。

### 导出入口看不到

`DATA_EXPORT_ENABLED` 默认 `false`。在 `.env` 中设为 `true` 并重启；只有家庭管理员能看到入口。

### 磁盘空间不足

- 照片和视频原文件占用最大；可在「设置 → 数据」查看存储占用。
- `backups/` 会累积多份完整备份，确认保留策略或手动清理旧目录。
- 清理 `storage/` 前务必确认对应媒体记录和 OSS 后端情况，不要误删原文件。

## 数据库

### 数据库损坏 / 无法启动

停止服务，先用最近一次备份恢复。如果备份也不可用：

```bash
sqlite3 data/homehi.db "PRAGMA integrity_check;"
```

不要在服务运行时直接复制 `homehi.db` 当作备份；WAL 模式下可能得到不一致的快照。使用 `npm run backup`。

### 恢复后旧数据又出现了

恢复的是备份时间点的数据，备份之后的新内容当然不在里面。确认是否需要从 `.before-restore-*` 中找回。

## 仍然无法解决

收集以下信息后联系维护者：

- `uname -m`、`docker --version`、`docker compose version`
- `docker compose ps`
- web / worker 最近 100 行日志（先删除邮箱、域名等个人信息）
- `HOMEHI_VERSION` 和大致出错时间

不要在公开 issue 中粘贴 `.env`、ACR 凭证、数据库文件或家庭照片。
