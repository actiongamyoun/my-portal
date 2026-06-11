import { NextResponse } from "next/server";

export const revalidate = 1800;

const BASE = "https://api.frankfurter.dev/v1/latest";

export async function GET() {
  try {
    const [usd, jpy] = await Promise.all([
      fetch(`${BASE}?base=USD&symbols=KRW`, { next: { revalidate: 1800 } }).then((r) => r.json()),
      fetch(`${BASE}?base=JPY&symbols=KRW`, { next: { revalidate: 1800 } }).then((r) => r.json()),
    ]);
    return NextResponse.json({
      usdKrw: Math.round(usd.rates?.KRW ?? 0),
      jpy100Krw: Math.round((jpy.rates?.KRW ?? 0) * 100),
      date: usd.date ?? "",
    });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
