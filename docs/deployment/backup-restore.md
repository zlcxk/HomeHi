# 备份与恢复

## 备份包含什么

`npm run backup` 会创建一个带时间戳的目录：

```
backups/homehi-20261103-131101/
├── README.txt
├── homehi.db          # VACUUM INTO 生成的一致性快照
└── storage/           # 本地媒体（如果存在）
```

- 数据库快照使用 SQLite 的 `VACUUM INTO`，服务运行期间也可以安全执行。
- 如果快照失败，脚本直接退出，不会退化成复制正在使用的 WAL 文件。
- 备份前会校验数据库确实已经初始化（存在 `_prisma_migrations` 表），避免把空库当成有效备份。
- 默认保留最近 7 份（`BACKUP_KEEP`），只清理形如 `homehi-YYYYMMDD-HHMMSS` 的目录。

## 执行备份

宿主机直接运行：

```bash
npm run backup
```

Docker 部署：

```bash
docker compose exec worker npm run backup
```

备份写入 `BACKUP_DIR`，Docker 中对应宿主机 `./backups`。

建议用 cron 每天执行一次，并把 `./backups` 同步到另一块磁盘、另一台机器或对象存储。**同一块磁盘上的备份不算备份。**

## 恢复

### 1. 停止服务

```bash
docker compose stop web worker
```

不要在服务运行时恢复。数据库文件在 Windows 上会因占用无法移动，在 Linux 上则可能被旧连接继续写入。

### 2. 执行恢复

Docker 部署（推荐用一次性容器，避免依赖正在运行的 worker）：

```bash
docker compose run --rm --no-deps worker \
  npm run restore -- /app/backups/homehi-20261103-131101 --force
```

宿主机直接运行：

```bash
npm run restore -- backups/homehi-20261103-131101 --force
```

恢复脚本会：

1. 校验备份目录中存在有效的 SQLite 文件。
2. 把当前数据库重命名为 `data/homehi.db.before-restore-<时间>`，并移走旧的 `-wal` / `-shm`。
3. 如果备份包含 `storage/`，先把当前媒体完整复制到 `backups/pre-restore-<时间>-storage`，再清空并写入备份中的媒体。
4. 任一步失败时尽力回滚。
5. 打印所有保留路径。

`--force` 是必填的，用来避免误执行。

### 3. 启动并核对

```bash
docker compose start web worker
```

登录后核对：

- 记录、照片、日程、待办数量是否与备份时间点一致。
- 照片和视频能否打开。
- 确认无误后，再删除 `.before-restore-*` 和 `pre-restore-*-storage`。

### 4. 回滚恢复

如果恢复结果不对：

1. 再次停止服务。
2. 删除当前的 `data/homehi.db` 及 `-wal` / `-shm`。
3. 把 `data/homehi.db.before-restore-<时间>` 改回 `data/homehi.db`。
4. 清空 `storage/`，把 `backups/pre-restore-<时间>-storage/` 的内容复制回去。
5. 启动服务。

## OSS 边界

当存储后端是阿里云 OSS 时：

- 备份只包含数据库，**不包含 OSS 中的照片和视频**。
- 本地 `storage/` 中可能仍有切换前上传的历史文件，若存在也会一并备份。
- OSS 媒体请依赖 Bucket 的版本控制、跨区域复制或生命周期规则单独保护。
- 恢复数据库不会恢复 OSS 对象；如果对象被删除，数据库里的记录仍在，但文件打不开。

## 定期演练

建议至少每季度做一次恢复演练：

1. 在测试目录用一份旧备份执行恢复。
2. 核对记录数量和媒体可读性。
3. 记录演练日期和结果。
4. 运行 `npm run audit:media`，确认数据库引用和本地存储对象一致。

回收站里尚未彻底删除的照片文件仍在 `storage/` 中，会随本地存储一起备份；彻底删除后的文件不会出现在之后的备份里。OSS 对象不在备份内，需要单独保护。完整规则见[媒体删除、清理与审计](../media-lifecycle.md)。

没有演练过的备份，只能算「可能可用」。
