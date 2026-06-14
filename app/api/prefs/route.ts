import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["apps", "aitools", "todos", "memo"];

function sb() {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}
const H = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}` });

// GET /api/prefs?key=apps  → { value: ... | null }
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const k = req.nextUrl.searchParams.get("key") ?? "";
  if (!ALLOWED.includes(k)) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  const r = await fetch(`${url}/rest/v1/prefs?key=eq.${k}&select=value`, { headers: H(key), cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  const rows = await r.json();
  return NextResponse.json({ value: rows?.[0]?.value ?? null });
}

// PUT /api/prefs  { key, value }  → upsert
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const { key: k, value } = await req.json();
  if (!ALLOWED.includes(k)) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  const r = await fetch(`${url}/rest/v1/prefs?on_conflict=key`, {
    method: "POST",
    headers: { ...H(key), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: k, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
