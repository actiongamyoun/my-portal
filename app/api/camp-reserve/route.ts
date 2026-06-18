import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function nextDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// 예약 캡처(이미지)에서 캠핑장명·체크인·체크아웃 추출
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const { image } = await req.json();
  if (!image?.data) return NextResponse.json({ error: "empty" }, { status: 400 });

  const today = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long",
  }).format(new Date());

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.media_type || "image/jpeg", data: image.data } },
            { type: "text", text: `오늘은 ${today}입니다. 첨부된 캠핑장 예약 확인 화면에서 정보를 추출해 JSON만 출력하세요. 다른 텍스트·마크다운 금지.
형식: {"camp":"캠핑장명","checkin":"YYYY-MM-DD","checkout":"YYYY-MM-DD 또는 null","site":"사이트/구역 번호 또는 null"}
규칙:
- checkin: 입실/체크인 날짜. checkout: 퇴실/체크아웃 날짜(없으면 입실 다음날로 추정하지 말고 null).
- 연도가 화면에 없으면 오늘 기준 가장 가까운 미래로 추론.
- camp: 캠핑장 이름. site: 사이트 번호나 구역(예: "A-12") 있으면.` },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error("anthropic");
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!p.checkin || !/^\d{4}-\d{2}-\d{2}$/.test(p.checkin)) throw new Error("parse");

    return NextResponse.json({
      camp: String(p.camp ?? "").slice(0, 60),
      checkin: p.checkin,
      checkout: /^\d{4}-\d{2}-\d{2}$/.test(p.checkout) ? p.checkout : null,
      site: p.site ? String(p.site).slice(0, 20) : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "parse" ? "parse" : "fetch" }, { status: 500 });
  }
}

// 추출된 예약을 구글 캘린더에 등록 (종일 일정 + 전날 알림)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken || session.error) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { camp, checkin, checkout, site } = await req.json();
  if (!camp || !checkin) return NextResponse.json({ error: "empty" }, { status: 400 });

  const event: Record<string, any> = {
    summary: `🏕 ${camp} 캠핑${site ? ` (${site})` : ""}`,
    start: { date: checkin },
    end: { date: checkout ? nextDay(checkout) : nextDay(checkin) }, // 구글 종일 일정의 end는 exclusive
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 24 * 60 }], // 전날(24시간 전)
    },
  };

  const g = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (g.status === 403) return NextResponse.json({ error: "scope" }, { status: 403 });
  if (!g.ok) return NextResponse.json({ error: "google" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
