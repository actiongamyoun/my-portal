import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

function sb() {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}
const sbHeaders = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}` });

function num(v: unknown): number {
  return parseFloat(String(v ?? "").replace(/,/g, "")) || 0;
}

async function jget(url: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// 네이버 증권 현재가 (시세 카드와 같은 소스)
async function curPrice(code: string | null, market: string): Promise<number | null> {
  if (!code) return null;
  if (market === "KR" || /^\d{6}$/.test(code)) {
    const d = await jget(`https://m.stock.naver.com/api/stock/${code}/basic`);
    return d?.closePrice ? num(d.closePrice) : null;
  }
  for (const sfx of [".O", ".K", ".N", ""]) {
    const d = await jget(`https://api.stock.naver.com/stock/${encodeURIComponent(code + sfx)}/basic`);
    if (d?.closePrice) return num(d.closePrice);
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const r = await fetch(`${url}/rest/v1/holdings?select=*&order=id.asc`, {
    headers: sbHeaders(key), cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  const rows: Record<string, any>[] = await r.json();

  // 환율 (USD 보유 시)
  let usdKrw = 0;
  if (rows.some((h) => h.currency === "USD")) {
    const fx = await jget("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW");
    usdKrw = fx?.rates?.KRW ?? 0;
  }

  const holdings = await Promise.all(
    rows.map(async (h) => {
      const price = await curPrice(h.code, h.market);
      const qty = Number(h.quantity), avg = Number(h.avg_price);
      const toKrw = h.currency === "USD" ? usdKrw : 1;
      const value = price != null ? price * qty : null;
      const cost = avg * qty;
      return {
        id: h.id, name: h.name, code: h.code, market: h.market, currency: h.currency,
        quantity: qty, avg_price: avg, cur_price: price,
        value, cost,
        pl: value != null ? value - cost : null,
        pl_pct: value != null && cost > 0 ? ((value - cost) / cost) * 100 : null,
        value_krw: value != null ? value * toKrw : null,
        cost_krw: cost * toKrw,
      };
    })
  );

  const priced = holdings.filter((h) => h.value_krw != null);
  const totalValue = priced.reduce((a, h) => a + (h.value_krw ?? 0), 0);
  const totalCost = priced.reduce((a, h) => a + h.cost_krw, 0);
  return NextResponse.json({
    holdings,
    totals: {
      value_krw: Math.round(totalValue),
      pl_krw: Math.round(totalValue - totalCost),
      pl_pct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    },
    usdKrw: usdKrw ? Math.round(usdKrw) : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const AK = process.env.ANTHROPIC_API_KEY;
  const { url, key } = sb();
  if (!AK || !url || !key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const body = await req.json();
  const images: { data: string; media_type: string }[] = (body.images ?? []).slice(0, 3);
  if (images.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  const content: Record<string, any>[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.media_type || "image/jpeg", data: img.data },
  }));
  content.push({
    type: "text",
    text: `첨부된 증권 앱(토스증권 등) 보유종목 화면에서 보유 내역을 추출해 JSON만 출력하세요. 다른 텍스트·마크다운 금지.

형식:
{"holdings":[
  {"name":"삼성전자","code":"005930","market":"KR","quantity":10,"avg_price":71200,"currency":"KRW","screen_value":745000,"screen_pl_pct":4.63},
  {"name":"테슬라","code":"TSLA","market":"US","quantity":2.5,"avg_price":245.30,"currency":"USD","screen_value":null,"screen_pl_pct":-2.1}
]}

규칙:
- 화면에 보이는 종목만. 추측으로 추가 금지.
- quantity: 보유 수량 (소수점 가능).
- avg_price: 반드시 "평균단가" 또는 "1주 평균금액" 라벨이 붙은 값만. 현재가·평가금액·매수금액과 절대 혼동 금지. 화면에 평단이 안 보이면 null.
- screen_value: 화면에 표시된 해당 종목의 평가금액 숫자 (원화 표시 기준, 안 보이면 null).
- screen_pl_pct: 화면에 표시된 수익률 % 숫자 (마이너스 포함, 안 보이면 null).
- code: 한국 주식은 6자리 종목코드 — 확실히 아는 경우만, 모르면 null. 미국 주식은 티커.
- market: 한국 상장이면 "KR", 미국이면 "US".`,
  });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content }] }),
    });
    if (!r.ok) throw new Error("anthropic");
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // 평단 교차검증: 화면의 평가금액·수익률로 역산한 평단과 비교, 어긋나면 역산값 채택 (원화 종목만)
    const list = (p.holdings ?? [])
      .map((h: Record<string, any>) => {
        const qty = Number(h.quantity);
        let avg = Number(h.avg_price) || 0;
        const sv = Number(h.screen_value) || 0;
        const sp = h.screen_pl_pct == null ? null : Number(h.screen_pl_pct);
        if ((h.currency ?? "KRW") === "KRW" && qty > 0 && sv > 0 && sp != null && Number.isFinite(sp)) {
          const derived = sv / (1 + sp / 100) / qty;
          if (derived > 0 && (avg <= 0 || Math.abs(avg - derived) / derived > 0.15)) avg = derived;
        }
        return { ...h, avg_price: avg };
      })
      .filter((h: Record<string, any>) => h.name && Number(h.quantity) > 0 && Number(h.avg_price) > 0);
    if (list.length === 0) throw new Error("parse");

    // 전체 교체: 캡처가 보유 전체 스냅샷이므로
    await fetch(`${url}/rest/v1/holdings?id=gt.0`, { method: "DELETE", headers: sbHeaders(key) });
    const ins = await fetch(`${url}/rest/v1/holdings`, {
      method: "POST",
      headers: { ...sbHeaders(key), "Content-Type": "application/json" },
      body: JSON.stringify(
        list.map((h: Record<string, any>) => ({
          name: String(h.name).slice(0, 60),
          code: h.code ? String(h.code).toUpperCase() : null,
          market: h.market === "US" ? "US" : "KR",
          quantity: Number(h.quantity),
          avg_price: Number(h.avg_price),
          currency: h.currency === "USD" ? "USD" : "KRW",
        }))
      ),
    });
    if (!ins.ok) throw new Error("db");
    return NextResponse.json({ count: list.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "parse" ? "parse" : "fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { url, key } = sb();
  if (!url || !key) return NextResponse.json({ error: "no-db" }, { status: 500 });

  const { id, code } = await req.json();
  if (!id) return NextResponse.json({ error: "empty" }, { status: 400 });
  const r = await fetch(`${url}/rest/v1/holdings?id=eq.${Number(id)}`, {
    method: "PATCH",
    headers: { ...sbHeaders(key), "Content-Type": "application/json" },
    body: JSON.stringify({ code: code ? String(code).toUpperCase() : null }),
  });
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
