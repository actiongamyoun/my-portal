import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const revalidate = 900;

const FEEDS = [
  { name: "연합뉴스TV", url: "https://www.yonhapnewstv.co.kr/browse/feed/" },
  { name: "SBS",        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER" },
  { name: "매일경제",    url: "https://www.mk.co.kr/rss/30000001/" },
  { name: "경향신문",    url: "https://www.khan.co.kr/rss/rssdata/total_news.xml" },
];

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

export async function GET() {
  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed.url, { headers: UA, next: { revalidate: 900 } });
      if (!r.ok) continue;
      const xml = await r.text();
      const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
      let items = doc?.rss?.channel?.item ?? [];
      if (!Array.isArray(items)) items = [items];
      if (items.length === 0) continue;
      const news = items.slice(0, 8).map((it: Record<string, any>) => ({
        title: String(it.title?.["#text"] ?? it.title ?? "").trim(),
        link: String(it.link?.["#text"] ?? it.link ?? ""),
        source: feed.name,
        pubDate: it.pubDate ?? "",
      }));
      return NextResponse.json({ news });
    } catch {
      continue; // 다음 피드 시도
    }
  }
  return NextResponse.json({ error: "all-feeds-failed" }, { status: 500 });
}
