/**
 * 会话 Cookie 的 Secure 标记需要按“实际访问协议”决定，不能只看 NODE_ENV。
 *
 * 生产构建（NODE_ENV=production）经常仍通过局域网 IP + HTTP 访问，例如
 * http://192.168.1.10:3000。此时带 Secure 的 Cookie 会被浏览器直接丢弃，
 * 表现为登录成功后随便点一个链接就退回登录页。
 *
 * 因此只有拿到明确的 HTTPS 证据（反向代理的 x-forwarded-proto，或显式
 * COOKIE_SECURE=true）时才加 Secure；其余情况一律不加，保证能登录。
 */
export type SecureCookieInput = {
  /** COOKIE_SECURE：true / false 强制指定，留空自动判断。 */
  override?: string | null;
  /** 反向代理传进来的 x-forwarded-proto。 */
  forwardedProto?: string | null;
};

export function resolveSecureCookie(input: SecureCookieInput): boolean {
  const override = input.override?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  const proto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}
