import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  try {
    const r = await fetch(
      `${url}/rest/v1/policies?select=id,title,ministry,category,url,published_at&order=published_at.desc.nullslast&limit=8`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!r.ok) throw new Error("supabase");
    const policies = await r.json();
    return NextResponse.json({ policies });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
