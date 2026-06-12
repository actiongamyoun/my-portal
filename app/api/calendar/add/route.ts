import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function nextDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const nowKst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());

  // 1) Haiku로 자연어 → 구조화
  let parsed: { title: string; date: string; start: string | null; end: string | null; location: string | null };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `현재 한국 시각: ${nowKst}
다음 문장을 일정으로 변환해 JSON만 출력하세요. 다른 텍스트, 마크다운 금지.
형식: {"title":"...","date":"YYYY-MM-DD","start":"HH:MM" 또는 null,"end":"HH:MM" 또는 null,"location":"..." 또는 null}
규칙: "내일","다음주 월요일" 등 상대 날짜는 현재 시각 기준으로 계산. 시간 언급이 없으면 start는 null(종일 일정). 오전/오후 불명확한 1~7시는 오후로 간주.

문장: ${String(text).slice(0, 200)}`,
        }],
      }),
    });
    if (!r.ok) throw new Error();
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!parsed.title || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) throw new Error();
  } catch {
    return NextResponse.json({ error: "parse" }, { status: 500 });
  }

  // 2) Google Calendar 등록
  const event: Record<string, any> = { summary: parsed.title };
  if (parsed.location) event.location = parsed.location;
  if (parsed.start) {
    const end = parsed.end ?? addHour(parsed.start);
    event.start = { dateTime: `${parsed.date}T${parsed.start}:00`, timeZone: "Asia/Seoul" };
    event.end = { dateTime: `${parsed.date}T${end}:00`, timeZone: "Asia/Seoul" };
  } else {
    event.start = { date: parsed.date };
    event.end = { date: nextDay(parsed.date) };
  }

  const g = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (g.status === 403) return NextResponse.json({ error: "scope" }, { status: 403 });
  if (!g.ok) return NextResponse.json({ error: "google" }, { status: 500 });

  return NextResponse.json({
    summary: parsed.title,
    date: parsed.date,
    start: parsed.start,
  });
}
