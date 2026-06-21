import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const dynamic = "force-dynamic";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

function clean(t: string) {
  return String(t ?? "").replace(/ - [^-]+$/, "").trim();
}

// 구글 뉴스 RSS 검색 (도장인 뉴스봇과 동일 방식). 키 불필요.
// 차단 시 폴백: 네이버 검색 API(키 있으면) → 그래도 없으면 에러
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ error: "no-query" }, { status: 400 });

  // 1순위: 구글 뉴스 RSS 검색
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:2d")}&hl=ko&gl=KR&ceid=KR:ko`;
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (r.ok) {
      const xml = await r.text();
      const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
      let items = doc?.rss?.channel?.item ?? [];
      if (!Array.isArray(items)) items = [items];
      const news = items.slice(0, 10).map((it: Record<string, any>) => ({
        title: clean(it.title),
        link: it.link ?? "",
        source: it.source?.["#text"] ?? "",
        pubDate: it.pubDate ?? "",
      })).filter((n: { title: string; link: string }) => n.title && n.link);
      if (news.length > 0) return NextResponse.json({ news, src: "google" });
    }
  } catch {
    // 폴백으로 진행
  }

  // 2순위(폴백): 네이버 검색 API — 키가 있을 때만
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (id && secret) {
    try {
      const r = await fetch(
        `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=10&sort=date`,
        { headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret }, cache: "no-store" }
      );
      if (r.ok) {
        const d = await r.json();
        const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const news = (d.items ?? []).map((it: Record<string, any>) => ({
          title: strip(it.title ?? ""),
          link: it.link ?? it.originallink ?? "",
          source: "",
          pubDate: it.pubDate ?? "",
        }));
        return NextResponse.json({ news, src: "naver" });
      }
    } catch {
      // 최종 실패
    }
  }

  return NextResponse.json({ error: "fetch" }, { status: 500 });
}
