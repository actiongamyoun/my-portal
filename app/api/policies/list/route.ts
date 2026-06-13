import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? "";
  const q = (sp.get("q") ?? "").trim();
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(30, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));

  const params = new URLSearchParams();
  params.set("select", "id,title,summary,ministry,category,url,published_at");
  params.set("order", "published_at.desc.nullslast");
  if (category && category !== "전체") params.set("category", `eq.${category}`);
  if (q) params.set("title", `ilike.*${q}*`);

  try {
    const r = await fetch(`${url}/rest/v1/policies?${params.toString()}`, {
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + limit - 1}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    });
    if (!r.ok) throw new Error("supabase");
    const policies = await r.json();
    const cr = r.headers.get("content-range") ?? "";
    const total = cr.includes("/") ? parseInt(cr.split("/")[1], 10) : policies.length;
    return NextResponse.json({ policies, total, offset, limit });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
