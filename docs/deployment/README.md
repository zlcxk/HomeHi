# HomeHi 部署指南

这套指南面向负责 NAS / 服务器的人。日常使用说明见 [使用指南](../user-guide/README.md)。

## 支持范围

| 项目 | 支持情况 |
| --- | --- |
| 架构 | **仅 AMD64（x86_64）**；不支持 ARM64、树莓派 |
| 运行方式 | Docker Compose v2（推荐）或直接运行 Node.js 22 |
| 数据库 | SQLite（单节点，随应用迁移） |
| 反向代理 | Nginx、Caddy、群晖 / 威联通自带反代均可 |
| 浏览器 | 现代 Chrome / Edge / Safari / Firefox；支持 PWA 安装 |

## 文档

| 文档 | 内容 |
| --- | --- |
| [NAS / Docker 一键部署](nas-deploy.md) | 首次部署、目录结构、端口、开机自启 |
| [配置说明](configuration.md) | 必填与常用环境变量、密钥、导出开关 |
| [备份与恢复](backup-restore.md) | 备份命令、保留策略、恢复演练、OSS 边界 |
| [媒体删除与审计](../media-lifecycle.md) | 软删除、彻底清理、失败重试、存储一致性检查 |
| [升级与回滚](upgrade.md) | `update.sh`、版本固定、回滚注意事项 |
| [反向代理与 HTTPS](reverse-proxy.md) | Nginx / Caddy 示例、上传大小、Cookie |
| [故障排查](troubleshooting.md) | 健康检查、日志、权限、提醒、上传 |

## 最短路径

```bash
uname -m                 # 必须是 x86_64 或 amd64
git clone https://github.com/zlcxk/HomeHi.git
cd HomeHi
# 在 deploy.sh 中填入项目负责人提供的 ACR 只读拉取凭证
bash deploy.sh
```

然后打开 `http://<NAS-IP>:3000`，按提示完成 `/setup`。

## 安全基线

- `AUTH_SECRET` 必须随机且至少 32 字符；生产环境使用示例值或过短密钥会导致服务拒绝启动。
- `deploy.sh` 中的 ACR 只读凭证是明文存储，不要提交到公开仓库或粘贴到聊天、issue、日志里。部署后建议 `chmod 700 deploy.sh update.sh`。
- 不要把 `data/`、`storage/`、`backups/` 放进任何静态目录或公开网盘。
- 完整导出默认关闭；确需使用时设置 `DATA_EXPORT_ENABLED="true"`，用完可以改回。
- 通过 HTTPS 暴露到公网时，确保反向代理传递 `X-Forwarded-Proto`，并让 `NEXT_PUBLIC_APP_URL` 使用 https 地址。
