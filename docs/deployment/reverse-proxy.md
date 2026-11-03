# 反向代理与 HTTPS

HomeHi 默认监听 `3000`。局域网内可以直接访问 `http://<NAS-IP>:3000`；需要域名或 HTTPS 时，在前面加一层反向代理。

## 必要设置

1. **传递 Host 和协议头**。尤其要传递 `X-Forwarded-Proto: https`，否则应用可能以为当前是 HTTP，`Secure` Cookie 判断会出错。
2. **上传大小**。`client_max_body_size` 必须不小于 `MAX_UPLOAD_MB`（默认 100 MB），建议留一些余量。
3. **`NEXT_PUBLIC_APP_URL`** 改成公开地址，例如 `https://home.example.com`，不要带结尾斜杠。邮件里的链接使用这个值。
4. **不要缓存**。HomeHi 的页面依赖登录状态，反向代理不要缓存 HTML 或 `/api/*`。

## Nginx

```nginx
server {
    listen 80;
    server_name home.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name home.example.com;

    ssl_certificate     /etc/letsencrypt/live/home.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/home.example.com/privkey.pem;

    client_max_body_size 120m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_request_buffering off;
    }
}
```

`proxy_request_buffering off` 对大文件上传更友好。`proxy_read_timeout` 放宽是为了视频和导出下载。

## Caddy

```caddy
home.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-Proto {scheme}
    }
    request_body {
        max_size 120MB
    }
}
```

Caddy 会自动申请和续期证书。

## Cookie 与 HTTPS

- 应用默认根据 `x-forwarded-proto` 自动决定是否给 Cookie 加 `Secure`。
- 如果代理没有传这个头，可以显式设置 `COOKIE_SECURE="true"`（HTTPS 时）或 `"false"`（局域网 HTTP 时）。
- 配错的表现通常是：登录成功但立刻跳回登录页。

## 只在内网使用

如果只在家庭局域网使用：

- 可以不配 HTTPS，直接访问 `http://<NAS-IP>:3000`。
- 确保 `COOKIE_SECURE` 不是 `true`，否则浏览器会丢弃登录 Cookie。
- 不要把 3000 端口直接映射到公网；需要外网访问时，至少在代理层加 HTTPS 和访问控制。

## 访问控制

HomeHi 自身只有登录鉴权，没有 IP 白名单或 VPN。需要额外保护时，可以在反向代理层加：

- 仅允许家庭 VPN / Tailscale 网段访问；
- 或加一层 HTTP Basic Auth（会与 HomeHi 登录叠加）；
- 或使用 NAS 自带的反向代理访问控制。

不要把 `data/`、`storage/`、`backups/` 通过 Web 服务器暴露成静态目录。
