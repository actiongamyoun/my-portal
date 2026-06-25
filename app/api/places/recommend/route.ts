import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Place = { id: string; name: string; category: string; distance: number };

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const { food = [], cafe = [], primary = "food" } = await req.json();
  const pool: Place[] = primary === "cafe" ? cafe : food;
  if (!Array.isArray(pool) || pool.length === 0)
    return NextResponse.json({ error: "empty" }, { status: 400 });

  const nowKst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());

  // 후보를 간결하게 (이름·카테고리·거리만, 최대 20곳)
  const candidates = pool.slice(0, 20).map((p, i) =>
    `${i + 1}. ${p.name} | ${p.category.split(">").pop()?.trim() ?? p.category} | ${p.distance}m`
  ).join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `지금은 ${nowKst} (한국). 아래는 실제 주변 ${primary === "cafe" ? "카페" : "음식점"} 목록입니다(카카오맵 기준, 거리 포함). 이 중에서 지금 상황에 어울리는 3곳을 골라 JSON만 출력하세요. 다른 텍스트·마크다운 금지.

형식: {"picks":[{"name":"가게명(목록과 정확히 일치)","reason":"추천 이유 한 문장"}]}

규칙:
- 반드시 아래 목록에 있는 가게명만. 새로 지어내지 말 것.
- 요일·시간대·거리·카테고리 다양성을 고려해 선택 (예: 점심엔 든든한 식사, 거리가 가까우면 가산점, 비슷한 종류만 3개 고르지 말 것).
- reason은 "왜 지금 여기인지"를 거리나 메뉴 특성으로 구체적으로. 맛 품질은 알 수 없으니 단정 금지("맛집이에요" 금지).

목록:
${candidates}`,
        }],
      }),
    });
    if (!r.ok) throw new Error("anthropic");
    const d = await r.json();
    const raw = (d.content ?? []).filter((b: Record<string, any>) => b.type === "text").map((b: Record<string, any>) => b.text).join("");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const picks = (parsed.picks ?? []).slice(0, 3);

    // 추천된 이름을 실제 pool과 매칭해서 거리·url 보강
    const byName = new Map(pool.map((p) => [p.name, p]));
    const result = picks
      .map((pk: { name: string; reason: string }) => {
        const match = byName.get(pk.name) ?? pool.find((p) => p.name.includes(pk.name) || pk.name.includes(p.name));
        return match ? { ...match, reason: String(pk.reason ?? "").slice(0, 100) } : null;
      })
      .filter(Boolean);

    if (result.length === 0) throw new Error("nomatch");
    return NextResponse.json({ picks: result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "nomatch" ? "nomatch" : "fetch" }, { status: 500 });
  }
}
