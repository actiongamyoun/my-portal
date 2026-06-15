import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "no-key" }, { status: 500, headers: NO_CACHE });

  try {
    const r = await fetch(
      `${url}/rest/v1/policies?select=id,title,summary,ministry,category,url,published_at&order=published_at.desc.nullslast&limit=8`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!r.ok) throw new Error("supabase");
    const policies = await r.json();
    return NextResponse.json({ policies }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500, headers: NO_CACHE });
  }
}
