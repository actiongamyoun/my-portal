import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1"; // 서울 리전 — korea.kr 해외 차단 우회
export const maxDuration = 60;

const CATEGORIES = ["경제·금융", "부동산", "산업·과학기술", "외교·안보", "에너지·환경", "사회·복지", "행정·정치", "기타"];
const FEEDS = [
  { source: "정책뉴스", url: "https://www.korea.kr/rss/policy.xml" },
  { source: "보도자료", url: "https://www.korea.kr/rss/pressrelease.xml" },
];
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

type Item = { source: string; title: string; url: string; desc: string; published_at: string | null };

async function fetchFeed(feed: { source: string; url: string }): Promise<{ items: Item[]; note: string }> {
  try {
    const r = await fetch(feed.url, { headers: HEADERS, cache: "no-store" });
    if (!r.ok) return { items: [], note: `${feed.source}: HTTP ${r.status}` };
    const doc = new XMLParser({ ignoreAttributes: false }).parse(await r.text());
    let raw = doc?.rss?.channel?.item ?? [];
    if (!Array.isArray(raw)) raw = [raw];
    const items = raw
      .map((it: Record<string, any>) => ({
        source: feed.source,
        title: strip(it.title),
        url: String(it.link?.["#text"] ?? it.link ?? "").trim(),
        desc: strip(it.description).slice(0, 600),
        published_at: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      }))
      .filter((x: Item) => x.title && x.url);
    return { items, note: `${feed.source}: ${items.length}건` };
  } catch (e) {
    return { items: [], note: `${feed.source}: ${(e as Error).message}` };
  }
}

async function classify(item: Item, key: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `정부 정책 기사를 분석해 JSON만 출력하세요. 다른 텍스트 금지.
형식: {"category":"...","ministry":"...","summary":"..."}
- category: 다음 중 정확히 하나 — ${CATEGORIES.join(", ")}
- ministry: 담당 부처명 (본문에서 추정, 불명확하면 "정부")
- summary: 중립적 사실 요약 2문장 이내. 평가·전망 금지.

제목: ${item.title}
내용: ${item.desc}`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const d = await r.json();
  const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
  const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
  return {
    category: CATEGORIES.includes(p.category) ? p.category : "기타",
    ministry: String(p.ministry ?? "정부").slice(0, 50),
    summary: String(p.summary ?? "").slice(0, 500),
  };
}

export async function GET(req: NextRequest) {
  // 인증: Vercel Cron(Authorization 헤더) 또는 수동 테스트(?secret=)
  const secret = process.env.CRON_SECRET;
  const authed =
    !!secret &&
    (req.headers.get("authorization") === `Bearer ${secret}` ||
      req.nextUrl.searchParams.get("secret") === secret);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const AK = process.env.ANTHROPIC_API_KEY;
  if (!SB_URL || !SB_KEY || !AK)
    return NextResponse.json({ error: "env 누락: SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY" }, { status: 500 });

  // 1) RSS 수집 (서울 리전에서)
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flatMap((r) => r.items);
  const feedNotes = results.map((r) => r.note);

  // 2) 기존 URL 제외
  const exRes = await fetch(`${SB_URL}/rest/v1/policies?select=url&order=collected_at.desc&limit=500`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  });
  const existing = new Set((((await exRes.json()) ?? []) as { url: string }[]).map((x) => x.url));
  const fresh = all.filter((x) => !existing.has(x.url)).slice(0, 10);

  if (fresh.length === 0)
    return NextResponse.json({ feeds: feedNotes, fetched: all.length, fresh: 0, saved: 0 });

  // 3) AI 분류 (병렬)
  const settled = await Promise.allSettled(fresh.map((item) => classify(item, AK)));
  const rows = fresh
    .map((item, i) => {
      const s = settled[i];
      if (s.status !== "fulfilled") return null;
      return { source: item.source, title: item.title, url: item.url, published_at: item.published_at, ...s.value };
    })
    .filter(Boolean);

  if (rows.length === 0)
    return NextResponse.json({ feeds: feedNotes, fetched: all.length, fresh: fresh.length, saved: 0, error: "classify-all-failed" }, { status: 500 });

  // 4) 저장
  const ins = await fetch(`${SB_URL}/rest/v1/policies?on_conflict=url`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!ins.ok)
    return NextResponse.json({ error: `supabase ${ins.status}: ${(await ins.text()).slice(0, 200)}` }, { status: 500 });

  return NextResponse.json({ feeds: feedNotes, fetched: all.length, fresh: fresh.length, saved: rows.length });
}
