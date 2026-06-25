import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/category.json";

type KakaoDoc = {
  id: string; place_name: string; category_name: string; phone: string;
  address_name: string; road_address_name: string; x: string; y: string;
  place_url: string; distance: string;
};

async function searchCategory(
  code: "FD6" | "CE7", x: string, y: string, radius: number, key: string
) {
  const url = `${KAKAO_URL}?category_group_code=${code}&x=${x}&y=${y}&radius=${radius}&sort=distance&size=15`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Kakao(${code}) ${res.status}`);
  const data = (await res.json()) as { documents?: KakaoDoc[] };
  return (data.documents ?? []).map((d) => ({
    id: d.id, name: d.place_name, category: d.category_name, phone: d.phone,
    address: d.road_address_name || d.address_name, distance: Number(d.distance), url: d.place_url,
  }));
}

export async function GET(req: NextRequest) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return NextResponse.json({ error: "KAKAO_REST_API_KEY 미설정" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const radius = Math.min(Math.max(Number(sp.get("radius") ?? "1000"), 1), 20000);
  if (!lat || !lng) return NextResponse.json({ error: "lat, lng 필요" }, { status: 400 });

  try {
    const [food, cafe] = await Promise.all([
      searchCategory("FD6", lng, lat, radius, key),
      searchCategory("CE7", lng, lat, radius, key),
    ]);
    return NextResponse.json({ food, cafe });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "카카오 호출 실패" }, { status: 502 });
  }
}
