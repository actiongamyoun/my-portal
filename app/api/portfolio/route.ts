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
const num = (v: unknown) => parseFloat(String(v ?? "").replace(/,/g, "")) || 0;

async function jget(url: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// 현재가: 국내 → 원화, 미국 → 달러
async function curPrice(code: string | null, market: string): Promise<number | null> {
  if (!code) return null;
  if (market !== "US" || /^\d{6}$/.test(code)) {
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

  const r = await fetch(`${url}/rest/v1/holdings?select=*&order=cost_krw.desc.nullslast`, {
    headers: sbHeaders(key), cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "db" }, { status: 500 });
  const rows: Record<string, any>[] = await r.json();

  let usdKrw = 0;
  if (rows.some((h) => h.market === "US")) {
    const fx = await jget("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW");
    usdKrw = fx?.rates?.KRW ?? 0;
  }

  const holdings = await Promise.all(
    rows.map(async (h) => {
      const qty = Number(h.quantity);
      const cost = Number(h.cost_krw) || Number(h.avg_price) * qty || 0;
      const price = await curPrice(h.code, h.market);

      let value_krw: number | null = null;
      let live = false;
      if (price != null) {
        if (h.market === "US") {
          if (usdKrw > 0) { value_krw = price * qty * usdKrw; live = true; }
        } else {
          value_krw = price * qty; live = true;
        }
      }
      if (value_krw == null && Number(h.screen_value) > 0) {
        value_krw = Number(h.screen_value); // 폴백: 캡처 시점 평가금
      }

      return {
        id: h.id, name: h.name, code: h.code, market: h.market,
        quantity: qty, cost_krw: cost, value_krw, live,
        pl: value_krw != null && cost > 0 ? value_krw - cost : null,
        pl_pct: value_krw != null && cost > 0 ? ((value_krw - cost) / cost) * 100 : null,
      };
    })
  );

  const priced = holdings.filter((h) => h.value_krw != null && h.cost_krw > 0);
  const tv = priced.reduce((a, h) => a + (h.value_krw ?? 0), 0);
  const tc = priced.reduce((a, h) => a + h.cost_krw, 0);
  return NextResponse.json({
    holdings,
    totals: {
      value_krw: Math.round(tv),
      pl_krw: Math.round(tv - tc),
      pl_pct: tc > 0 ? ((tv - tc) / tc) * 100 : 0,
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
  const market: string = body.market === "US" ? "US" : body.market === "KR" ? "KR" : "";
  const images: { data: string; media_type: string }[] = (body.images ?? []).slice(0, 3);
  if (!market || images.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  const content: Record<string, any>[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.media_type || "image/png", data: img.data },
  }));
  content.push({
    type: "text",
    text: `첨부는 토스증권 ${market === "KR" ? "국내" : "해외"}주식 보유 화면입니다 (PC 표 또는 모바일 목록). 보유 내역을 추출해 JSON만 출력하세요. 다른 텍스트·마크다운 금지.

형식:
{"holdings":[
  {"name":"종목명","code":"코드","quantity":98,"avg_price":46980,"value":3701864,"cost":4604045,"pl_amount":-902181,"pl_pct":-19.59}
]}

규칙 (모든 금액은 화면 표시 그대로 원화 숫자):
- PC 표 기준 컬럼 매핑: avg_price="1주 평균금액", quantity="보유 수량", value="평가금", cost="원금", pl_amount="총 수익금", pl_pct="총 수익률" (부호 포함).
- 모바일 화면이라 평단·원금이 없으면: avg_price/cost는 null, value=평가금액, pl_amount=손익금액(마이너스면 음수), pl_pct의 부호는 pl_amount와 같게.
- 화면에 보이는 종목만, 여러 장에 중복되면 한 번만.
- code: ${market === "KR" ? "한국 6자리 종목코드 — 확실히 아는 종목만, 모르면 null" : "미국 티커(예: RBLX, IONQ) — 종목명에서 확실히 알 수 있는 것만, 모르면 null"}.`,
  });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2500, messages: [{ role: "user", content }] }),
    });
    if (!r.ok) throw new Error("anthropic");
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    const p = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const seen = new Set<string>();
    const rows = (p.holdings ?? [])
      .map((h: Record<string, any>) => {
        const qty = Number(h.quantity) || 0;
        const value = num(h.value);
        let cost = num(h.cost);
        const plAmt = h.pl_amount == null ? null : num(h.pl_amount);
        const plPct = h.pl_pct == null ? null : Number(h.pl_pct);
        let avg = num(h.avg_price);

        // 원금 보정: 없으면 평가금-손익, 그것도 없으면 수익률로 역산
        if (cost <= 0 && value > 0 && plAmt != null) cost = value - plAmt;
        if (cost <= 0 && value > 0 && plPct != null && plPct > -100) cost = value / (1 + plPct / 100);
        // 평단 교차검증: 원금과 10% 이상 어긋나면 원금 기준 재계산
        if (qty > 0 && cost > 0 && (avg <= 0 || Math.abs(avg * qty - cost) / cost > 0.1)) avg = cost / qty;

        return {
          name: String(h.name ?? "").slice(0, 60),
          code: h.code ? String(h.code).toUpperCase() : null,
          market,
          quantity: qty,
          avg_price: avg > 0 ? avg : null,
          cost_krw: cost > 0 ? Math.round(cost) : null,
          screen_value: value > 0 ? Math.round(value) : null,
          currency: "KRW",
        };
      })
      .filter((h: Record<string, any>) => {
        if (!h.name || h.quantity <= 0 || (!h.cost_krw && !h.screen_value)) return false;
        if (seen.has(h.name)) return false;
        seen.add(h.name);
        return true;
      });
    if (rows.length === 0) throw new Error("parse");

    // 해당 시장만 교체
    await fetch(`${url}/rest/v1/holdings?market=eq.${market}`, { method: "DELETE", headers: sbHeaders(key) });
    const ins = await fetch(`${url}/rest/v1/holdings`, {
      method: "POST",
      headers: { ...sbHeaders(key), "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    if (!ins.ok) throw new Error("db");
    return NextResponse.json({ count: rows.length, market });
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
