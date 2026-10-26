import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { resolveSecureCookie } from "@/lib/session-cookie";

export const SESSION_COOKIE = "homehi_session";
const SESSION_DAYS = 30;

export type SessionPayload = {
  userId: string;
  householdId: string;
  role: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET 未配置或过短，请检查 .env");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 11);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
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
