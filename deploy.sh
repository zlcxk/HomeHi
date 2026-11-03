#!/usr/bin/env bash
#
# HomeHi 一键部署脚本（仅支持 AMD64 / x86_64 的 NAS 或 Linux 主机）。
#
# 安全说明：按部署方案，ACR 只读拉取凭证直接保存在本文件中，属于明文存储。
# - 不要把本文件上传或复制到 README、issue、日志、截图或其他无关文件。
# - 部署后建议执行：chmod 700 deploy.sh update.sh
# - 该账号只应拥有 opxk-public 命名空间的只读拉取权限；一旦泄露立即在 ACR 轮换。
#
# 用法：
#   ./deploy.sh            # 首次部署；版本取 .env 的 HOMEHI_VERSION，没有则 latest
#   ./deploy.sh 1.2.3      # 部署指定版本，并写回 .env
#
# 脚本是幂等的：重复执行只会拉取并更新到目标版本，不会覆盖已有 .env 与数据目录。
set -euo pipefail
cd "$(dirname "$0")"

ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
ACR_USERNAME="__FILL_ACR_READONLY_USERNAME__"
ACR_PASSWORD="__FILL_ACR_READONLY_PASSWORD__"

fail() {
  echo "错误：$*" >&2
  exit 1
}

# HomeHi 镜像只构建了 linux/amd64。ARM64 NAS 不支持，不能隐瞒这一点。
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64) ;;
  *) fail "当前架构是 ${ARCH}，HomeHi 只提供 AMD64（x86_64）镜像，不支持 ARM64。" ;;
esac

command -v docker >/dev/null 2>&1 || fail "未找到 docker，请先安装 Docker Engine。"
docker compose version >/dev/null 2>&1 || fail "需要 Docker Compose v2（docker compose 子命令）。"

if [ "$ACR_USERNAME" = "__FILL_ACR_READONLY_USERNAME__" ]; then
  fail "deploy.sh 中的 ACR 只读账号尚未填写，请先填入项目负责人提供的凭证。"
fi
if [ "$ACR_PASSWORD" = "__FILL_ACR_READONLY_PASSWORD__" ]; then
  fail "deploy.sh 中的 ACR 只读密码尚未填写，请先填入项目负责人提供的凭证。"
fi

umask 077

# 首次运行从示例生成本地配置，并生成随机 AUTH_SECRET。
if [ ! -f .env ]; then
  [ -f .env.example ] || fail "缺少 .env.example，无法生成 .env。"
  cp .env.example .env
  echo "已从 .env.example 创建 .env。"
fi

if grep -q '^AUTH_SECRET="replace-me-with-a-long-random-string"' .env; then
  if command -v openssl >/dev/null 2>&1; then
    AUTH_SECRET_VALUE="$(openssl rand -base64 48 | tr -d '\n')"
  else
    AUTH_SECRET_VALUE="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  fi
  sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=\"${AUTH_SECRET_VALUE}\"|" .env && rm -f .env.bak
  echo "已生成随机 AUTH_SECRET 并写入 .env。"
fi

CURRENT_VERSION="$(grep -E '^HOMEHI_VERSION=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)"
VERSION="${1:-${CURRENT_VERSION:-latest}}"
case "$VERSION" in
  "" | *[!A-Za-z0-9._-]*) fail "版本号只能包含字母、数字、点、下划线和连字符：${VERSION}" ;;
esac

if grep -q '^HOMEHI_VERSION=' .env; then
  sed -i.bak "s|^HOMEHI_VERSION=.*|HOMEHI_VERSION=\"${VERSION}\"|" .env && rm -f .env.bak
else
  printf '\nHOMEHI_VERSION="%s"\n' "$VERSION" >> .env
fi
export HOMEHI_VERSION="$VERSION"

mkdir -p data storage backups

echo "登录 ACR 并拉取 HomeHi ${VERSION} ..."
printf '%s' "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" --username "$ACR_USERNAME" --password-stdin >/dev/null \
  || fail "ACR 登录失败，请检查只读凭证和网络。"

docker compose pull || fail "镜像拉取失败，请检查版本号是否存在以及 ACR 权限。"
docker compose up -d --remove-orphans || fail "容器启动失败，请查看 docker compose logs。"

http_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1
  else
    docker compose exec -T web node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1
  fi
}

echo "等待 HomeHi 通过健康检查 ..."
for _ in $(seq 1 60); do
  if http_ok; then
    docker compose ps
    echo "HomeHi ${VERSION} 已就绪：http://<NAS-IP>:3000"
    exit 0
  fi
  sleep 2
done

docker compose logs --tail=100 web >&2 || true
fail "健康检查超时。请根据上面的日志排查，常见原因是 3000 端口被占用或 .env 配置有误。"
