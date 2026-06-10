import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function strip(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function GET(req: NextRequest) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const q = req.nextUrl.searchParams.get("q") || "경제";
  try {
    const r = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=8&sort=date`,
      {
        headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
        cache: "no-store",
      }
    );
    if (!r.ok) throw new Error("naver");
    const d = await r.json();
    const news = (d.items ?? []).map((it: Record<string, any>) => ({
      title: strip(it.title ?? ""),
      link: it.link ?? it.originallink ?? "",
      source: "",
      pubDate: it.pubDate ?? "",
    }));
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
