import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sb() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const r = await fetch(
    `${url}/rest/v1/runs?select=id,run_date,distance_km,duration_min,pace,avg_hr,calories,notes,analysis&order=run_date.desc,created_at.desc&limit=12`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
  );
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ runs: await r.json() });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const AK = process.env.ANTHROPIC_API_KEY;
  const { url, key } = sb();
  if (!AK || !url || !key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const { text, image } = await req.json();
  if (!text?.trim() && !image?.data)
    return NextResponse.json({ error: "empty" }, { status: 400 });

  const today = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long",
  }).format(new Date());

  const content: Record<string, any>[] = [];
  if (image?.data) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.media_type || "image/jpeg", data: image.data },
    });
  }
  content.push({
    type: "text",
    text: `당신은 따뜻하지만 구체적인 러닝 코치입니다. 오늘은 ${today}입니다.
${image?.data ? "첨부된 러닝 앱 화면을" : "아래 러닝 기록 텍스트를"} 분석해 JSON만 출력하세요. 다른 텍스트·마크다운 금지.

형식:
{"run_date":"YYYY-MM-DD","distance_km":숫자,"duration_min":숫자,"pace":"분'초\\"/km 형식 또는 null","avg_hr":숫자 또는 null,"calories":숫자 또는 null,"notes":"한 줄 요약","analysis":"코치 피드백"}

규칙:
- run_date: 화면/텍스트에서 날짜를 찾고, 없으면 오늘. "어제" 같은 상대 표현은 오늘 기준 계산.
- analysis: 3~4문장. ① 이번 러닝 평가(페이스·심박 기준) ② 회복 조언 ③ 다음 러닝 제안. 과장된 칭찬 금지, 구체적으로.
- 값을 찾을 수 없는 필드는 null.
${text?.trim() ? `\n러닝 기록:\n${String(text).slice(0, 1500)}` : ""}`,
  });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content }],
      }),
    });
    if (!r.ok) throw new Error("anthropic " + r.status);
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!p.run_date || typeof p.distance_km !== "number") throw new Error("parse");

    const row = {
      run_date: p.run_date,
      distance_km: p.distance_km,
      duration_min: p.duration_min ?? null,
      pace: p.pace ?? null,
      avg_hr: p.avg_hr ?? null,
      calories: p.calories ?? null,
      notes: String(p.notes ?? "").slice(0, 200),
      analysis: String(p.analysis ?? "").slice(0, 1000),
    };

    const ins = await fetch(`${url}/rest/v1/runs`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!ins.ok) throw new Error("db");
    const saved = (await ins.json())?.[0] ?? row;
    return NextResponse.json({ run: saved });
  } catch (e) {
    const m = (e as Error).message;
    return NextResponse.json(
      { error: m === "parse" ? "parse" : "fetch" },
      { status: 500 }
    );
  }
}
