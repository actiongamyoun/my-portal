import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

async function check(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, {
      headers: UA,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return r.status < 400; // 2xx·3xx = 정상
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const urls = Array.from(
    new Set(
      (req.nextUrl.searchParams.get("urls") ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//.test(u))
        .slice(0, 15)
    )
  );
  const checks = await Promise.all(urls.map(async (u) => [u, await check(u)] as const));
  return NextResponse.json({ results: Object.fromEntries(checks) });
}
