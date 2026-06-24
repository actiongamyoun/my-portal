import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 한국시간 기준 "오늘 0시"부터 N일간의 UTC 범위
function kstRange(days: number) {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const offsetMs = kstNow.getTime() - now.getTime(); // ≈ +9h
  const startKst = new Date(kstNow); startKst.setHours(0, 0, 0, 0);
  const endKst = new Date(startKst); endKst.setDate(endKst.getDate() + days);
  return {
    timeMin: new Date(startKst.getTime() - offsetMs).toISOString(),
    timeMax: new Date(endKst.getTime() - offsetMs).toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "auth" }, { status: 401 });

  const token = session.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const { timeMin, timeMax } = kstRange(7);

  try {
    // 1) 사용자의 모든 캘린더 목록
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,selected,primary)",
      { headers, cache: "no-store" }
    );
    if (!listRes.ok) throw new Error("list");
    const listData = await listRes.json();
    // 화면에 표시(selected)되는 캘린더만 — 구독만 하고 숨긴 건 제외
    const calendars: string[] = (listData.items ?? [])
      .filter((c: Record<string, any>) => c.selected !== false)
      .map((c: Record<string, any>) => c.id);
    if (calendars.length === 0) calendars.push("primary");

    // 2) 각 캘린더에서 7일 범위 일정 병렬 조회
    const all = await Promise.all(
      calendars.map(async (calId) => {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
        );
        url.search = new URLSearchParams({
          timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50",
        }).toString();
        const r = await fetch(url, { headers, cache: "no-store" });
        if (!r.ok) return [];
        const d = await r.json();
        return (d.items ?? []).map((e: Record<string, any>) => ({
          id: e.id,
          title: e.summary ?? "(제목 없음)",
          start: e.start?.dateTime ?? e.start?.date,
          end: e.end?.dateTime ?? e.end?.date,
          allDay: !e.start?.dateTime,
          location: e.location ?? "",
          link: e.htmlLink ?? "",
          calColor: e.colorId ?? null,
        }));
      })
    );

    // 3) 병합 + 시작시각 정렬 + 중복(id) 제거
    const seen = new Set<string>();
    const events = all
      .flat()
      .filter((e) => e.start && !seen.has(e.id) && seen.add(e.id))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
