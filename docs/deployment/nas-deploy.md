# NAS / Docker 一键部署

## 前置条件

1. **AMD64 架构**。SSH 到 NAS 执行：

   ```bash
   uname -m
   ```

   输出必须是 `x86_64` 或 `amd64`。ARM64（`aarch64`）不受支持，脚本会直接退出。

2. 已安装 Docker Engine 和 Docker Compose v2，确认：

   ```bash
   docker --version
   docker compose version
   ```

3. NAS 可以访问阿里云 ACR `registry.cn-hangzhou.aliyuncs.com`。
4. 3000 端口可用（或由反向代理转发）。

## 首次部署

```bash
git clone https://github.com/zlcxk/HomeHi.git
cd HomeHi
```

按项目负责人提供的方式，把 ACR **只读**拉取凭证填入 `deploy.sh` 开头的两行：

```bash
ACR_USERNAME="..."
ACR_PASSWORD="..."
```

凭证按部署方案以明文保存在脚本里，这是已知取舍。不要提交到公开仓库，不要复制到 README、issue、截图或日志。

然后执行：

```bash
bash deploy.sh          # 默认 latest
bash deploy.sh 1.2.3    # 或固定到具体版本
```

脚本会：

1. 检查架构和 Docker / Compose v2。
2. 从 `.env.example` 创建 `.env`（已存在则不覆盖），并写入随机 `AUTH_SECRET`。
3. 创建 `data/`、`storage/`、`backups/`。
4. 用只读凭证登录 ACR。
5. 按 `HOMEHI_VERSION` 拉取 web 与 worker 镜像。
6. 启动容器并等待 `GET /api/health` 通过。

看到 `HomeHi <版本> 已就绪` 后，打开 `http://<NAS-IP>:3000`，按提示在 `/setup` 创建家庭空间和管理员账号。

## 目录与卷

| 宿主机目录 | 容器路径 | 内容 |
| --- | --- | --- |
| `./data` | `/app/data` | SQLite 数据库 |
| `./storage` | `/app/storage` | 本地照片、视频、议题附件 |
| `./backups` | `/app/backups` | `npm run backup` 的输出 |
| `./.env` | 通过 `env_file` 注入 | 配置与密钥 |

这几个目录必须持久化。升级、重装容器不会主动删除它们，但重装系统、迁移 NAS 前要单独备份。

## 开机自启

两个服务都设置了 `restart: unless-stopped`。只要 Docker 服务随 NAS 启动，HomeHi 会自动恢复。部分 NAS 需要在 Docker / Container Manager 的设置里勾选「开机启动」。

## 更新

```bash
bash update.sh 1.2.3    # 固定版本，并写回 .env
bash update.sh          # 沿用 .env 中的版本
```

更新前建议先备份：

```bash
docker compose exec worker npm run backup
```

## 不使用 ACR 镜像

如果只是本地试用，可以用仓库里的 `Dockerfile` 自行构建 web / worker 两个目标。注意这会违背「NAS 上不构建」的原则，构建机也需要是 AMD64：

```bash
docker build --target web -t homehi-web:local .
docker build --target worker -t homehi-worker:local .
```

然后自行修改 compose 的 `image:`。ARM64 设备无法通过修改标签获得镜像，必须交叉构建或使用 AMD64 机器。
