import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function numOr(v: string | null, fallback: string): string {
  return v && /^-?\d+(\.\d+)?$/.test(v) ? v : fallback;
}

export async function GET(req: NextRequest) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  // 접속 위치 좌표 (없거나 이상하면 기본값: 해운대)
  const lat = numOr(req.nextUrl.searchParams.get("lat"), process.env.WEATHER_LAT ?? "35.163");
  const lon = numOr(req.nextUrl.searchParams.get("lon"), process.env.WEATHER_LON ?? "129.163");

  try {
    const [wRes, gRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${key}`,
        { next: { revalidate: 600 } }
      ),
      fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`,
        { next: { revalidate: 86400 } } // 지역명은 하루 캐시
      ),
    ]);
    if (!wRes.ok) throw new Error("owm");
    const d = await wRes.json();
    let city = d.name ?? "";
    if (gRes.ok) {
      const g = await gRes.json();
      city = g?.[0]?.local_names?.ko ?? g?.[0]?.name ?? city; // 한글 지역명 우선
    }
    return NextResponse.json({
      temp: Math.round(d.main?.temp),
      desc: d.weather?.[0]?.description ?? "",
      icon: d.weather?.[0]?.icon ?? "01d",
      humidity: d.main?.humidity,
      city,
    });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
