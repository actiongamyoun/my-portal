import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// OpenWeatherMap 5일/3시간 예보에서 다가오는 토·일의 한낮 날씨 추출.
// 예보 범위(약 5일)에 다음 주말이 안 잡히면, 잡히는 범위 내 가장 가까운 토/일을 사용.
export async function GET(req: NextRequest) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (!lat || !lon) return NextResponse.json({ error: "no-coord" }, { status: 400 });

  try {
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${key}`,
      { next: { revalidate: 3600 } }
    );
    if (!r.ok) throw new Error("owm");
    const d = await r.json();

    // 각 슬롯을 KST 날짜로 분류, 토/일만 모아 "정오에 가장 가까운" 슬롯 선택
    type Slot = { temp: number; desc: string; icon: string; pop: number; score: number; dateKey: string };
    const best: Record<"sat" | "sun", Slot | null> = { sat: null, sun: null };

    for (const item of d.list ?? []) {
      const kst = new Date(new Date(item.dt * 1000).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const day = kst.getDay(); // 0=일, 6=토
      if (day !== 0 && day !== 6) continue;
      const which: "sat" | "sun" = day === 6 ? "sat" : "sun";
      const hour = kst.getHours();
      const score = Math.abs(hour - 13);
      const dateKey = `${kst.getMonth() + 1}/${kst.getDate()}`;

      const cur = best[which];
      // 더 이른 날짜 우선(가장 가까운 주말), 같은 날짜면 정오 근접 우선
      if (!cur || dateKey < cur.dateKey || (dateKey === cur.dateKey && score < cur.score)) {
        best[which] = {
          temp: Math.round(item.main?.temp),
          desc: item.weather?.[0]?.description ?? "",
          icon: item.weather?.[0]?.icon ?? "01d",
          pop: Math.round((item.pop ?? 0) * 100),
          score, dateKey,
        };
      }
    }

    const strip = (s: Slot | null) =>
      s ? { temp: s.temp, desc: s.desc, icon: s.icon, pop: s.pop, date: s.dateKey } : null;

    return NextResponse.json({ sat: strip(best.sat), sun: strip(best.sun) });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
