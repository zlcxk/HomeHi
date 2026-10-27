import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/auth";
import { amapConfigured, searchAmapLocations } from "@/lib/amap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  if (!amapConfigured()) {
    return NextResponse.json({ configured: false, results: [] });
  }
  if (query.length < 2) {
    return NextResponse.json({ configured: true, results: [] });
  }

  const results = await searchAmapLocations(query, { limit: 8 });
  return NextResponse.json({ configured: true, results });
}
