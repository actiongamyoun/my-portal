// 정책 수집기: korea.kr RSS → Claude Haiku 분류·요약 → Supabase 저장
// GitHub Actions에서 매일 06:00 KST 실행
import { XMLParser } from "fast-xml-parser";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY;
if (!SB_URL || !SB_KEY || !AK) {
  console.error("환경변수 누락: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY");
  process.exit(1);
}

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" };
const CATEGORIES = ["경제·금융", "부동산", "산업·과학기술", "외교·안보", "에너지·환경", "사회·복지", "행정·정치", "기타"];

const FEEDS = [
  { source: "정책뉴스", url: "https://www.korea.kr/rss/policy.xml" },
  { source: "보도자료", url: "https://www.korea.kr/rss/pressrelease.xml" },
];

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function fetchFeed(feed) {
  try {
    const r = await fetch(feed.url, { headers: UA });
    if (!r.ok) { console.warn(`피드 실패 ${feed.url}: ${r.status}`); return []; }
    const doc = new XMLParser({ ignoreAttributes: false }).parse(await r.text());
    let items = doc?.rss?.channel?.item ?? [];
    if (!Array.isArray(items)) items = [items];
    return items.map((it) => ({
      source: feed.source,
      title: strip(it.title),
      url: String(it.link?.["#text"] ?? it.link ?? "").trim(),
      desc: strip(it.description).slice(0, 600),
      published_at: it.pubDate ? new Date(it.pubDate).toISOString() : null,
    })).filter((x) => x.title && x.url);
  } catch (e) {
    console.warn(`피드 에러 ${feed.url}:`, e.message);
    return [];
  }
}

async function classify(item) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
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
  const raw = (d.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
  return {
    category: CATEGORIES.includes(p.category) ? p.category : "기타",
    ministry: String(p.ministry ?? "정부").slice(0, 50),
    summary: String(p.summary ?? "").slice(0, 500),
  };
}

async function main() {
  // 1) RSS 수집
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  console.log(`RSS 항목 ${all.length}건`);

  // 2) 기존 URL 제외 (중복 방지)
  const exRes = await fetch(`${SB_URL}/rest/v1/policies?select=url&order=collected_at.desc&limit=500`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const existing = new Set(((await exRes.json()) ?? []).map((x) => x.url));
  const fresh = all.filter((x) => !existing.has(x.url)).slice(0, 15); // 1회 최대 15건
  console.log(`신규 ${fresh.length}건`);
  if (fresh.length === 0) return;

  // 3) AI 분류·요약
  const rows = [];
  for (const item of fresh) {
    try {
      const c = await classify(item);
      rows.push({ source: item.source, title: item.title, url: item.url, published_at: item.published_at, ...c });
      console.log(`✓ [${c.category}] ${item.title.slice(0, 40)}`);
    } catch (e) {
      console.warn(`✗ 분류 실패: ${item.title.slice(0, 40)} (${e.message})`);
    }
  }
  if (rows.length === 0) return;

  // 4) 저장 (URL 중복은 무시)
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
  if (!ins.ok) throw new Error(`supabase insert ${ins.status}: ${await ins.text()}`);
  console.log(`저장 완료 ${rows.length}건`);
}

main().catch((e) => { console.error(e); process.exit(1); });
