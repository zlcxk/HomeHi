/**
 * 服务启动钩子：在开始处理请求前校验关键环境变量。
 * Next 在生产构建阶段会跳过 register()，所以不会影响 `next build`。
 */
export async function register() {
  const { assertServerEnv } = await import("./lib/env");
  assertServerEnv();
}
