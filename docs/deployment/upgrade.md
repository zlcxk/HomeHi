# 升级与回滚

## 升级前

1. 确认新版本存在，并且 web / worker 使用同一个 `HOMEHI_VERSION`。
2. 备份：

   ```bash
   docker compose exec worker npm run backup
   ```

3. 看一眼当前版本和容器状态：

   ```bash
   grep '^HOMEHI_VERSION=' .env
   docker compose ps
   ```

## 升级

```bash
bash update.sh 1.2.3    # 指定版本，并写回 .env
```

或跟随 `.env` 中已固定的版本重新拉取：

```bash
bash update.sh
```

`update.sh` 复用 `deploy.sh` 的完整流程：架构检查、ACR 登录、`docker compose pull`、`up -d`、健康检查。失败时会打印 web 日志。

升级时数据库迁移由 web 容器启动命令自动执行（`prisma migrate deploy`）。目前项目的迁移都是向前兼容的增量变更。

## 回滚

### 只回滚应用版本

```bash
bash update.sh 1.2.2
```

注意：如果新版本已经执行过数据库迁移，旧版本镜像可能不认识新的表或列。Prisma 的迁移不会自动回退。回滚前请确认新版本没有结构性迁移，或直接按下面的方式恢复数据库。

### 连数据库一起回滚

1. 停止服务。
2. 用升级前的备份恢复：

   ```bash
   docker compose run --rm --no-deps worker \
     npm run restore -- /app/backups/homehi-<升级前时间> --force
   ```

3. 把 `.env` 中的 `HOMEHI_VERSION` 改回旧版本，或执行 `bash update.sh <旧版本>`。
4. 启动并核对数据。

详细步骤见[备份与恢复](backup-restore.md)。

## 不要做的事

- 不要在 NAS 上直接构建 ARM64 镜像来「绕过」架构限制；官方只提供 AMD64。
- 不要只升级 web 而保留旧 worker，反之亦然。两者必须同版本。
- 不要在没有备份的情况下跨多个大版本升级。
