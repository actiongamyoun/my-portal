import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function kstDayRange() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const start = new Date(kst); start.setHours(0, 0, 0, 0);
  const end = new Date(kst); end.setHours(23, 59, 59, 999);
  const offsetMs = kst.getTime() - now.getTime();
  return {
    timeMin: new Date(start.getTime() - offsetMs).toISOString(),
    timeMax: new Date(end.getTime() - offsetMs).toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "auth" }, { status: 401 });

  const { timeMin, timeMax } = kstDayRange();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.search = new URLSearchParams({
    timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "10",
  }).toString();

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error("calendar");
    const d = await r.json();
    const events = (d.items ?? []).map((e: Record<string, any>) => ({
      id: e.id,
      title: e.summary ?? "(제목 없음)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location ?? "",
      link: e.htmlLink ?? "",
    }));
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
