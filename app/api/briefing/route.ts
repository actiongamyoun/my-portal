import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 500 });

  const { events = [], mails = [], news = [], runs = [] } = await req.json();

  const dateStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  const prompt = `당신은 유능하고 간결한 개인 비서입니다. 오늘은 ${dateStr}입니다.
아래는 사용자의 오늘 일정, 미읽음 메일, 주요 뉴스입니다.

[오늘 일정]
${JSON.stringify(events).slice(0, 2000)}

[미읽음 메일]
${JSON.stringify(mails).slice(0, 2000)}

[주요 뉴스]
${JSON.stringify(news).slice(0, 2000)}

[최근 러닝 기록]
${JSON.stringify(runs).slice(0, 800)}

위 정보를 종합해 한국어로 아침 브리핑을 작성하세요. 형식:
1. 첫 문단: 오늘 하루의 핵심을 2~3문장으로 (일정의 우선순위, 주의할 메일)
2. "오늘의 액션" 으로 시작하는 줄 다음에, 구체적 추천 행동 3개를 "- "로 시작하는 줄로
3. 마지막 한 줄: 뉴스 중 사용자에게 의미 있을 만한 것 하나만 짧게 언급

규칙: 러닝 기록이 있으면 컨디션·회복 관점의 한 줄을 자연스럽게 포함 (기록이 비어 있으면 러닝 언급 생략). 전체 380자 이내. 마크다운 헤더/볼드 금지. 일정이나 메일이 비어 있으면 자연스럽게 여유 있는 하루라고 언급.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) throw new Error("anthropic " + r.status);
    const d = await r.json();
    const text = (d.content ?? [])
      .filter((b: Record<string, any>) => b.type === "text")
      .map((b: Record<string, any>) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ briefing: text });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
