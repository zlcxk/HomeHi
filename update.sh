#!/usr/bin/env bash
#
# HomeHi 更新脚本。
#
# 更新与首次部署共用同一套幂等流程，因此这里只转发给 deploy.sh，
# 避免把 ACR 只读凭证复制到第二个文件。
#
# 用法：
#   ./update.sh            # 保持 .env 中固定的 HOMEHI_VERSION
#   ./update.sh 1.2.3      # 更新到指定版本，并写回 .env
#   ./update.sh latest     # 跟随 latest（不推荐长期使用）
set -euo pipefail
cd "$(dirname "$0")"

[ -f deploy.sh ] || {
  echo "错误：缺少 deploy.sh，无法更新。" >&2
  exit 1
}

exec bash ./deploy.sh "$@"
