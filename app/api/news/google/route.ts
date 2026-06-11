import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const revalidate = 900;

export async function GET() {
  try {
    const r = await fetch("https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate: 900 },
    });
    if (!r.ok) throw new Error("rss " + r.status);
    const xml = await r.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml);
    let items = doc?.rss?.channel?.item ?? [];
    if (!Array.isArray(items)) items = [items];
    const news = items.slice(0, 8).map((it: Record<string, any>) => ({
      title: String(it.title ?? "").replace(/ - [^-]+$/, ""),
      link: it.link ?? "",
      source: it.source?.["#text"] ?? "",
      pubDate: it.pubDate ?? "",
    }));
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
