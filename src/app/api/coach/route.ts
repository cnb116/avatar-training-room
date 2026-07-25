import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 사용할 모델 (필요 시 변경 가능)
const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `
당신은 '아바타 트레이닝 룸'의 AI 엔진입니다. 두 가지 역할을 수행합니다.

[역할 1: 진상 파트너]
당신은 건설 현장에서 사용자(현장 반장 또는 기사)를 은근히 통제하거나 지시하려는 가상의 인물이 되어, 기분이 상할 수 있는 짧은 대사 한 줄을 던집니다.
등장인물은 반드시 건설 현장과 관련된 인물이어야 합니다. (예: 원청 현장소장, 협력업체 반장, 안전관리자, 발주처/감리, 자재·장비업체 담당자, 하도급 인부, 인근 민원인, 관공서 담당자, 동료 반장, 납품 거래처 등) 가정이나 일반 사무실 이야기, 건설과 무관한 상황은 절대 만들지 않습니다.
난이도는 다음 중 무작위로 하나를 고릅니다.
- 순한맛: 은근슬쩍 돌려 까며 훈수 두는 수준
- 매운맛: 논리 없이 자기주장만 강하게 우기는 수준
- 지옥맛: 사소한 것도 꼬투리 잡고 강하게 몰아붙이는 수준
과도한 욕설, 비하, 혐오 표현은 사용하지 않습니다. 어디까지나 훈련용 상황극입니다.

[쿠션어 6유형 가이드 — 평가 시 참고]
1. 인정형: 상대 말을 일단 받아들이며 진정시킴 (예: "아하, 그렇게 볼 수도 있겠네요.")
2. 시간 벌기형: 즉답을 피하며 완충함 (예: "일단 알겠습니다, 확인해볼게요.")
3. 완곡한 거절/유보형: 받아들이지 않으면서도 관계는 상하지 않게 함 (예: "말씀은 감사한데, 이번엔 제가 하던 대로 가보겠습니다.")
4. 넉살형: 유쾌하게 받아넘김 (예: "역시 한마디를 안 지시네요, 알겠습니다!")
5. 감정 다독임형: 상대 감정을 먼저 인정함 (예: "많이 답답하셨겠어요.")
6. 화제 전환형: 논쟁을 끌지 않고 다음으로 넘김 (예: "그 얘기는 이쯤 하고, 다음 건 확인해볼까요?")

[역할 2: 연기 감독관]
사용자가 아바타로서 내놓은 대답을 평가합니다.
- 감정적으로 맞받아치지 않고, 넉살 좋게 자연스럽게 받아넘겼는지를 기준으로 0~100점을 매깁니다.
- 위 쿠션어 6유형 중 하나 이상을 자연스럽게 사용했거나, 침착하게 상황을 인정하면서도 휘둘리지 않는 태도를 보이면 높은 점수를 줍니다. 특히 두 유형을 조합했을 때(예: 인정형 다음에 완곡한 거절형) 더 높이 평가합니다.
- 감정적으로 맞서 싸우거나, 지나치게 위축되어 사과만 반복하거나, 아예 대답을 회피하면 낮은 점수를 줍니다.
- 피드백은 2~3문장으로, 잘한 점과 아쉬운 점을 구체적으로 짚어줍니다. 사용자의 답변이 위 6유형 중 어디에 해당하는지 유형명을 밝혀 언급하고(예: "이건 '넉살형' 쿠션어네요"), 해당하지 않는다면 어떤 유형을 곁들이면 좋을지 제안합니다. 존댓말을 사용합니다.
- 또한 사용자가 이번 상황에서 참고할 수 있도록, 넉살 좋은 '모범 답안' 한 문장을 별도로 제시합니다. 사용자가 쓴 답변을 그대로 베끼지 말고, 실제로 더 스무스하게 받아넘길 수 있는 새로운 표현을 제안합니다. 가능하면 위 6유형 중 두 가지를 조합한 형태로 제시합니다.

항상 지정된 형식의 JSON만 출력합니다. JSON 외의 다른 텍스트(코드블록 표시 포함)는 절대 출력하지 않습니다.
JSON 문자열 값 안에서는 큰따옴표(")를 절대 사용하지 말고, 인용이 필요하면 작은따옴표(')로 대체하세요. 큰따옴표를 안에 쓰면 JSON 형식이 깨집니다.
`.trim();

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY 환경 변수가 설정되어 있지 않습니다.' },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { action } = body;

  try {
    if (action === 'situation') {
      const theme: string = typeof body.theme === 'string' ? body.theme : '';
      const recentLines: string[] = Array.isArray(body.recentLines) ? body.recentLines : [];

      const avoidBlock =
        recentLines.length > 0
          ? `\n최근에 이미 나왔던 상황들이니 이것과 똑같거나 비슷한 표현은 절대 다시 만들지 마세요:\n${recentLines
              .map((l) => `- "${l}"`)
              .join('\n')}\n`
          : '';

      const themeBlock = theme
        ? `\n이번 상황의 인물 관계는 반드시 "${theme}"로 설정하세요.\n`
        : '';

      const userPrompt = `
지금부터 '진상 파트너' 역할로 짧은 대사 한 줄을 던지세요.
난이도(순한맛/매운맛/지옥맛) 중 하나를 무작위로 고르세요.
${themeBlock}${avoidBlock}
매번 표현과 소재를 최대한 다르게 만들어서, 같은 문장이 반복되지 않도록 하세요.

다음 JSON 형식으로만 응답하세요:
{"level": "순한맛|매운맛|지옥맛", "line": "대사 내용"}
`.trim();

      const data = await callClaude(apiKey, userPrompt);
      const parsed = safeParseJson(data);
      if (!parsed || !parsed.level || !parsed.line) {
        console.error('[상황 생성 파싱 실패, 원본 응답]', data);
        throw new Error('상황 생성 응답 형식 오류');
      }
      return NextResponse.json({ level: parsed.level, line: parsed.line });
    }

    if (action === 'evaluate') {
      const { situation, reply } = body;
      if (!situation || !reply) {
        return NextResponse.json({ error: '상황과 대답이 모두 필요합니다.' }, { status: 400 });
      }

      const userPrompt = `
[상대방의 대사]
"${situation}"

[사용자가 아바타로서 내놓은 대답]
"${reply}"

위 대답을 '연기 감독관' 기준으로 평가하세요.

다음 JSON 형식으로만 응답하세요:
{"score": 0에서 100 사이의 정수, "feedback": "2~3문장의 구체적인 피드백", "suggestedReply": "더 넉살 좋게 받아칠 수 있는 모범 답안 한 문장"}
`.trim();

      const data = await callClaude(apiKey, userPrompt);
      const parsed = safeParseJson(data);
      if (!parsed || typeof parsed.score !== 'number' || !parsed.feedback) {
        console.error('[평가 파싱 실패, 원본 응답]', data);
        throw new Error('평가 응답 형식 오류');
      }
      return NextResponse.json({
        score: parsed.score,
        feedback: parsed.feedback,
        suggestedReply: parsed.suggestedReply || '',
      });
    }

    return NextResponse.json({ error: '알 수 없는 action 입니다.' }, { status: 400 });
  } catch (err: any) {
    // 터미널(npm run dev 실행 창)에 실제 에러가 출력되므로, 문제 진단 시 여기를 확인
    console.error('[coach API 오류]', err);
    return NextResponse.json(
      { error: err?.message || '서버 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Claude API 호출 공통 함수
async function callClaude(apiKey: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API 오류: ${errText}`);
  }

  const json = await res.json();
  const textBlock = (json.content || []).find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error('Claude 응답에 텍스트가 없습니다.');
  return textBlock.text;
}

// 코드블록(```json ... ```) 등이 섞여 와도 안전하게 JSON을 추출
function safeParseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
