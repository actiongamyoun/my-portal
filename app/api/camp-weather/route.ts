import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// OpenWeatherMap 5일/3시간 예보에서 다가오는 토·일의 한낮 날씨 추출
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

    // KST 기준 요일 계산, 토(6)·일(0)의 12~15시 근접 슬롯 선택
    const pick: Record<string, { temp: number; desc: string; icon: string; pop: number }> = {};
    for (const item of d.list ?? []) {
      const dt = new Date(item.dt * 1000);
      const kst = new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const day = kst.getDay(); // 0=일,6=토
      const hour = kst.getHours();
      if (day !== 0 && day !== 6) continue;
      const label = day === 6 ? "토" : "일";
      // 정오에 가장 가까운 슬롯 우선
      const score = Math.abs(hour - 13);
      const prev = (pick as any)[label + "_score"];
      if (prev === undefined || score < prev) {
        pick[label] = {
          temp: Math.round(item.main?.temp),
          desc: item.weather?.[0]?.description ?? "",
          icon: item.weather?.[0]?.icon ?? "01d",
          pop: Math.round((item.pop ?? 0) * 100),
        };
        (pick as any)[label + "_score"] = score;
      }
    }
    return NextResponse.json({ sat: pick["토"] ?? null, sun: pick["일"] ?? null });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
