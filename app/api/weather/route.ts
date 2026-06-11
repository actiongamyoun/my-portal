import { NextResponse } from "next/server";

export const revalidate = 600;

export async function GET() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });
  const lat = process.env.WEATHER_LAT ?? "35.163";
  const lon = process.env.WEATHER_LON ?? "129.163";
  try {
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${key}`,
      { next: { revalidate: 600 } }
    );
    if (!r.ok) throw new Error("owm");
    const d = await r.json();
    return NextResponse.json({
      temp: Math.round(d.main?.temp),
      desc: d.weather?.[0]?.description ?? "",
      icon: d.weather?.[0]?.icon ?? "01d",
      humidity: d.main?.humidity,
      city: d.name ?? "",
    });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
