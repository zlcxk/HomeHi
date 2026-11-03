/**
 * 环境变量校验。只有 AUTH_SECRET 是硬性要求：其余变量都有可用默认值。
 *
 * 规则按环境区分，避免开发时被示例值卡住，但生产环境绝不接受弱密钥：
 * - 生产：至少 32 字符，且不能是 .env.example 里的示例值。
 * - 开发：至少 16 字符（与旧版本行为一致）。
 */
export const AUTH_SECRET_PLACEHOLDER = "replace-me-with-a-long-random-string";
export const PRODUCTION_SECRET_MIN_LENGTH = 32;
export const DEVELOPMENT_SECRET_MIN_LENGTH = 16;

export function authSecretProblem(
  secret: string | undefined = process.env.AUTH_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | null {
  const value = secret?.trim();
  const production = nodeEnv === "production";

  if (!value) return "AUTH_SECRET 未配置";
  if (production && value === AUTH_SECRET_PLACEHOLDER) {
    return "AUTH_SECRET 仍是 .env.example 里的示例值";
  }
  if (production && value.length < PRODUCTION_SECRET_MIN_LENGTH) {
    return `AUTH_SECRET 太短，生产环境至少需要 ${PRODUCTION_SECRET_MIN_LENGTH} 个字符`;
  }
  if (!production && value.length < DEVELOPMENT_SECRET_MIN_LENGTH) {
    return `AUTH_SECRET 太短，至少需要 ${DEVELOPMENT_SECRET_MIN_LENGTH} 个字符`;
  }
  return null;
}

/** 签名会话前调用：密钥不可用时直接抛错，而不是静默签出一个弱 Token。 */
export function requireAuthSecret(): string {
  const problem = authSecretProblem();
  if (problem) {
    throw new Error(`${problem}。可用 \`openssl rand -base64 48\` 生成后写入 .env`);
  }
  return (process.env.AUTH_SECRET as string).trim();
}

/**
 * 服务启动时调用（instrumentation.ts）。
 * 生产环境缺少或使用弱 AUTH_SECRET 时拒绝启动，避免带着错误配置上线。
 * 构建阶段不会执行 instrumentation，因此不影响 `next build` 和镜像构建。
 */
export function assertServerEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const problem = authSecretProblem();
  if (problem) {
    throw new Error(`[HomeHi] ${problem}。请修正 .env 后重新启动。`);
  }
}
