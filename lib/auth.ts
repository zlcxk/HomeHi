import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash, hashSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAuthSecret } from "@/lib/env";
import { resolveSecureCookie } from "@/lib/session-cookie";

export const SESSION_COOKIE = "homehi_session";
const SESSION_DAYS = 30;

export type SessionPayload = {
  userId: string;
  householdId: string;
  role: string;
  sessionVersion: number;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireAuthSecret());
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 11);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

let dummyHash: string | null = null;

/**
 * 用户不存在时也跑一次 bcrypt，避免通过响应时间判断邮箱是否注册。
 * 第一次使用时生成一个固定哈希，之后复用。
 */
export async function verifyPasswordOrDummy(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hashSync("homehi-timing-equalizer", 11);
    await compare(password, dummyHash);
    return false;
  }
  return compare(password, passwordHash);
}

async function shouldUseSecureCookie(): Promise<boolean> {
  const headerStore = await headers();
  return resolveSecureCookie({
    override: process.env.COOKIE_SECURE,
    forwardedProto: headerStore.get("x-forwarded-proto"),
  });
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const secure = await shouldUseSecureCookie();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "string" || typeof payload.householdId !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      householdId: payload.householdId,
      role: typeof payload.role === "string" ? payload.role : "MEMBER",
      // 旧版本签发的 Cookie 没有这个字段，按 0 处理，保证升级后仍可继续使用。
      sessionVersion:
        typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
    };
  } catch {
    return null;
  }
}

export type AppContext = {
  session: SessionPayload;
  user: {
    id: string;
    email: string;
    displayName: string;
    timezone: string;
    defaultVisibility: string;
    notifyEvent: boolean;
    notifyTask: boolean;
    notifyOther: boolean;
    avatarMediaId: string | null;
  };
  household: {
    id: string;
    name: string;
    timezone: string;
  };
  role: string;
};

export const getContext = cache(async (): Promise<AppContext | null> => {
  const session = await readSession();
  if (!session) return null;
  const membership = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId: session.householdId,
        userId: session.userId,
      },
    },
    include: { user: true, household: true },
  });
  if (!membership) return null;
  // 改密、被移出家庭等情况会自增 sessionVersion，旧 Token 立即失效。
  if (membership.user.sessionVersion !== session.sessionVersion) return null;
  return {
    session,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
      timezone: membership.user.timezone,
      defaultVisibility: membership.user.defaultVisibility,
      notifyEvent: membership.user.notifyEvent,
      notifyTask: membership.user.notifyTask,
      notifyOther: membership.user.notifyOther,
      avatarMediaId: membership.user.avatarMediaId,
    },
    household: {
      id: membership.household.id,
      name: membership.household.name,
      timezone: membership.household.timezone,
    },
    role: membership.role,
  };
});

export async function requireContext(): Promise<AppContext> {
  const context = await getContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireOwner(): Promise<AppContext> {
  const context = await requireContext();
  if (context.role !== "OWNER") redirect("/my");
  return context;
}

export async function hasHousehold(): Promise<boolean> {
  const count = await prisma.household.count();
  return count > 0;
}

export function isOwner(context: AppContext): boolean {
  return context.role === "OWNER";
}

/** For route handlers: returns null instead of redirecting. */
export async function getApiContext(): Promise<AppContext | null> {
  return getContext();
}
