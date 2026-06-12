import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

// 지수 매핑: 클라이언트 심볼 → 네이버 증권 코드
const INDEX_MAP: Record<string, { kind: "kr" | "world"; code: string; name: string }> = {
  "^KS11": { kind: "kr", code: "KOSPI", name: "코스피" },
  "^KQ11": { kind: "kr", code: "KOSDAQ", name: "코스닥" },
  "^IXIC": { kind: "world", code: ".IXIC", name: "나스닥" },
  "^GSPC": { kind: "world", code: ".INX", name: "S&P 500" },
};

function num(v: unknown): number {
  return parseFloat(String(v ?? "").replace(/,/g, "")) || 0;
}

async function jget(url: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function pack(raw: string, name: string, d: Record<string, any>) {
  const price = num(d.closePrice);
  if (!price) return null;
  const pct = num(d.fluctuationsRatio); // 부호 포함 (예: "-0.83")
  const change = Math.sign(pct || 0) * Math.abs(num(d.compareToPreviousClosePrice));
  return { input: raw, symbol: raw, name, price, change, changePct: pct };
}

async function quoteFor(raw: string) {
  // 1) 지수
  const idx = INDEX_MAP[raw];
  if (idx) {
    const url =
      idx.kind === "kr"
        ? `https://m.stock.naver.com/api/index/${idx.code}/basic`
        : `https://api.stock.naver.com/index/${encodeURIComponent(idx.code)}/basic`;
    const d = await jget(url);
    return d ? pack(raw, idx.name, d) : null;
  }
  // 2) 국내 종목 (6자리 코드)
  if (/^\d{6}$/.test(raw)) {
    const d = await jget(`https://m.stock.naver.com/api/stock/${raw}/basic`);
    return d ? pack(raw, d.stockName ?? raw, d) : null;
  }
  // 3) 해외 종목: 나스닥(.O) → 뉴욕(.N) → 입력 그대로
  for (const sfx of [".O", ".N", ""]) {
    const d = await jget(`https://api.stock.naver.com/stock/${encodeURIComponent(raw + sfx)}/basic`);
    if (d?.closePrice) return pack(raw, d.stockName ?? raw, d);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  const quotes = await Promise.all(
    symbols.map(async (raw) => (await quoteFor(raw)) ?? { input: raw, error: true })
  );
  return NextResponse.json({ quotes });
}
