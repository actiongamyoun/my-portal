import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLS = "id,run_date,distance_km,duration_min,pace,avg_hr,max_hr,cadence_avg,cadence_max,stride_cm,calories,vo2max,recovery_hours,training_load,splits,hr_zones,notes,analysis";

function sb() {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const r = await fetch(
    `${url}/rest/v1/runs?select=${COLS}&order=run_date.desc,created_at.desc&limit=40`,
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

  const body = await req.json();
  const text: string = body.text ?? "";
  // 구버전 {image} / 신버전 {images:[]} 모두 수용
  const images: { data: string; media_type: string }[] = (body.images ?? (body.image ? [body.image] : [])).slice(0, 3);
  if (!text.trim() && images.length === 0)
    return NextResponse.json({ error: "empty" }, { status: 400 });

  const today = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long",
  }).format(new Date());

  const content: Record<string, any>[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.media_type || "image/jpeg", data: img.data },
  }));
  content.push({
    type: "text",
    text: `당신은 데이터에 근거해 구체적으로 조언하는 러닝 코치입니다. 오늘은 ${today}입니다.
${images.length > 0 ? `첨부된 러닝 앱 캡처 ${images.length}장은 같은 러닝의 화면들입니다. 모든 장의 정보를 종합해` : "아래 러닝 기록 텍스트를"} 분석하고 JSON만 출력하세요. 다른 텍스트·마크다운 금지.

형식:
{"run_date":"YYYY-MM-DD","distance_km":숫자,"duration_min":숫자,"pace":"분'초\\"/km" 또는 null,
"avg_hr":숫자|null,"max_hr":숫자|null,"cadence_avg":숫자|null,"cadence_max":숫자|null,"stride_cm":숫자|null,
"calories":숫자|null,"vo2max":숫자|null,"recovery_hours":숫자|null,"training_load":숫자|null,
"splits":[{"km":1,"pace_sec":초단위숫자}, ...] 또는 null,
"hr_zones":[{"zone":"워밍업|강화|중강도|고강도|최대","min":분단위숫자}, ...] 또는 null,
"notes":"한 줄 요약","analysis":"코치 분석"}

규칙:
- splits: km별 페이스를 초로 환산 (예: 6'26" → 386). 마지막 구간이 1km 미만이어도 포함.
- hr_zones: 심박 구간별 시간을 분 단위 숫자로 (예: 01:20:56 → 80.9).
- analysis는 다음 5개를 각각 1~2문장씩, 줄바꿈(\\n)으로 구분해 작성:
① 페이스 운영: 스플릿 패턴 평가 (네거티브/포지티브 스플릿, 퍼진 구간 지적)
② 심박: 존 분포 해석과 운동 강도 평가
③ 자세: 케이던스·보폭 수치 기반 폼 조언 (이상적 케이던스 175-185spm 기준)
④ 회복: 권장 회복시간·다음 러닝까지의 처방
⑤ 다음 훈련: 구체적 메뉴 제안 (거리·페이스·방식)
- 데이터가 없는 항목의 분석은 생략. 과장 없이, 수치를 인용하며.
- 찾을 수 없는 필드는 null.
${text.trim() ? `\n러닝 기록:\n${text.slice(0, 1500)}` : ""}`,
  });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
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
      max_hr: p.max_hr ?? null,
      cadence_avg: p.cadence_avg ?? null,
      cadence_max: p.cadence_max ?? null,
      stride_cm: p.stride_cm ?? null,
      calories: p.calories ?? null,
      vo2max: p.vo2max ?? null,
      recovery_hours: p.recovery_hours ?? null,
      training_load: p.training_load ?? null,
      splits: Array.isArray(p.splits) ? p.splits : null,
      hr_zones: Array.isArray(p.hr_zones) ? p.hr_zones : null,
      notes: String(p.notes ?? "").slice(0, 200),
      analysis: String(p.analysis ?? "").slice(0, 2000),
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
    return NextResponse.json(
      { error: (e as Error).message === "parse" ? "parse" : "fetch" },
      { status: 500 }
    );
  }
}
