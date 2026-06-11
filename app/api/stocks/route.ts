import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

type Quote = {
  input: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
};

async function quote(symbol: string): Promise<Omit<Quote, "input"> | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: UA, cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number") return null;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prev;
    return {
      symbol: meta.symbol ?? symbol,
      name: meta.shortName ?? meta.longName ?? symbol,
      price,
      change,
      changePct: prev ? (change / prev) * 100 : 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  const quotes = await Promise.all(
    symbols.map(async (raw) => {
      let q: Omit<Quote, "input"> | null;
      if (/^\d{6}$/.test(raw)) {
        // 한국 6자리 종목코드: 코스피(.KS) 먼저, 안 되면 코스닥(.KQ)
        q = (await quote(raw + ".KS")) ?? (await quote(raw + ".KQ"));
      } else {
        q = await quote(raw);
      }
      return q ? { input: raw, ...q } : { input: raw, error: true };
    })
  );
  return NextResponse.json({ quotes });
}
