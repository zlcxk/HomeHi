import nodemailer, { type Transporter } from "nodemailer";

export type SmtpStatus = {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user: string;
  missing: string[];
};

export function smtpStatus(): SmtpStatus {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  const password = process.env.SMTP_PASSWORD || "";
  const from = (process.env.SMTP_FROM || "").trim();

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!from) missing.push("SMTP_FROM");
  if (user && !password) missing.push("SMTP_PASSWORD");

  return {
    configured: missing.length === 0,
    host,
    port,
    secure,
    from,
    user,
    missing,
  };
}

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  const smtp = smtpStatus();
  if (!smtp.configured) {
    throw new Error(`SMTP 尚未配置（缺少 ${smtp.missing.join("、")}）`);
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: process.env.SMTP_PASSWORD || "" } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
}

export type ReminderEmail = {
  to: string;
  householdName: string;
  title: string;
  whenLabel: string;
  url: string;
  kind: "event" | "task";
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function reminderEmailContent(email: ReminderEmail): { subject: string; html: string; text: string } {
  const kindLabel = email.kind === "event" ? "日程提醒" : "待办提醒";
  const subject = `[HomeHi] ${kindLabel} · ${email.title}`;
  const safeTitle = escapeHtml(email.title);
  const safeWhen = escapeHtml(email.whenLabel);
  const safeHousehold = escapeHtml(email.householdName);
  const safeUrl = escapeHtml(email.url);
  const html = `<!doctype html>
<html lang="zh-CN"><body style="margin:0;padding:0;background:#f4f1e9;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC',sans-serif;color:#1d1b17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1e9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf8;border:1px solid #e2dccf;border-radius:24px;overflow:hidden;">
        <tr><td style="padding:28px 30px 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9a9488;">HomeHi · ${safeHousehold}</td></tr>
        <tr><td style="padding:0 30px;">
          <p style="margin:18px 0 8px;font-size:13px;color:#d9552f;font-weight:600;">${kindLabel}</p>
          <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:600;letter-spacing:-.01em;">${safeTitle}</h1>
          <p style="margin:14px 0 0;font-size:15px;color:#6b655b;">${safeWhen}</p>
          <p style="margin:26px 0 30px;">
            <a href="${safeUrl}" style="display:inline-block;background:#1d1b17;color:#f4f1e9;text-decoration:none;font-size:14px;padding:12px 22px;border-radius:999px;">打开 HomeHi</a>
          </p>
        </td></tr>
        <tr><td style="padding:18px 30px 26px;border-top:1px solid #ece7dc;font-size:12px;color:#9a9488;line-height:1.6;">
          这封邮件由你的 HomeHi 家庭空间自动发送。你可以在「设置 → 通知」中关闭此类提醒。
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `HomeHi · ${email.householdName}\n\n${kindLabel}：${email.title}\n${email.whenLabel}\n\n${email.url}\n\n可在「设置 → 通知」中关闭此类提醒。`;
  return { subject, html, text };
}

export async function sendReminderEmail(email: ReminderEmail): Promise<void> {
  const content = reminderEmailContent(email);
  const transport = getTransport();
  await transport.sendMail({
    from: smtpStatus().from,
    to: email.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

export async function sendTestEmail(to: string, appUrl: string): Promise<void> {
  const transport = getTransport();
  const status = smtpStatus();
  await transport.sendMail({
    from: status.from,
    to,
    subject: "[HomeHi] 邮件配置测试",
    text: `这是一封来自 HomeHi 的测试邮件。\n\n应用地址：${appUrl}\n\n如果你收到这封邮件，说明 SMTP 配置可用。`,
    html: `<div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#fffdf8;border:1px solid #e2dccf;border-radius:20px;color:#1d1b17;">
      <p style="font-size:12px;letter-spacing:.14em;color:#9a9488;">HOMEHI</p>
      <h1 style="font-size:22px;margin:12px 0;">邮件配置测试</h1>
      <p style="color:#6b655b;line-height:1.7;">如果你收到这封邮件，说明 SMTP 配置可用，提醒邮件会从这里发出。</p>
      <p><a href="${escapeHtml(appUrl)}" style="color:#d9552f;">${escapeHtml(appUrl)}</a></p>
    </div>`,
  });
}
