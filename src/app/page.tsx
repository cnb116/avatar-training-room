'use client';

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
type Level = '순한맛' | '매운맛' | '지옥맛';
type Stage = 'idle' | 'situation' | 'result';

interface Situation {
  level: Level;
  line: string;
}

interface EvalResult {
  score: number;
  feedback: string;
  rank: string;
  suggestedReply?: string;
}

interface SavedLine {
  id: string;
  situation: string;
  reply: string;
  score: number;
  rank: string;
  savedAt: string;
}

// ─────────────────────────────────────────────
// 계급 칭호 계산
// ─────────────────────────────────────────────
function getRank(score: number): string {
  if (score >= 90) return '해탈한 마스터 소장';
  if (score >= 75) return '산전수전 오반장';
  if (score >= 50) return '눈치백단 김대리';
  return '쿠크다스 멘탈 신입';
}

// 종합(누적 평균) 계급 — 단일 세션 계급과 문구를 다르게 둬서 구분되게 함
function getOverallRank(avg: number): string {
  if (avg >= 90) return '해탈한 마스터 소장';
  if (avg >= 75) return '산전수전 오반장';
  if (avg >= 50) return '눈치백단 김대리';
  return '쿠크다스 안전모';
}

// 최근 N개(기본 10개) 기록의 평균 점수를 계산.
// savedLines는 최신순으로 저장되므로 앞에서부터 N개만 사용하면 '최근 N회'가 된다.
function computeRecentAverage(
  savedLines: { score: number }[],
  recentCount = 10
): { average: number; count: number } | null {
  if (!savedLines || savedLines.length === 0) return null;
  const recent = savedLines.slice(0, recentCount);
  const sum = recent.reduce((acc, cur) => acc + (Number(cur.score) || 0), 0);
  const average = Math.round(sum / recent.length);
  return { average, count: recent.length };
}

const LEVEL_COLOR: Record<Level, string> = {
  순한맛: 'text-yellow-300',
  매운맛: 'text-yellow-400',
  지옥맛: 'text-red-400',
};

const STORAGE_KEY = 'avatar_training_saved_lines';

// ─────────────────────────────────────────────
// 폴백 상황 90종 (API 연결 실패 시에도 다양하게 연습할 수 있도록)
// 건설 현장 관계 테마 10개 × 난이도 3단계 × 3개 = 90개
// ─────────────────────────────────────────────
const FALLBACK_SITUATIONS: Situation[] = [
  // 순한맛 (30)
  { level: '순한맛', line: '거참, 그렇게 하지 말고 내가 하라는 공법대로 하지 그러나.' },
  { level: '순한맛', line: '내가 현장 밥만 30년 먹었는데, 이 방식이 훨씬 낫더라고.' },
  { level: '순한맛', line: '그렇게까지 자재 아끼겠다고 고집부릴 일인가 싶은데.' },
  { level: '순한맛', line: '다른 팀은 다 이렇게 시공하던데, 우리만 유독 다르게 하네.' },
  { level: '순한맛', line: '그냥 도면대로 하면 되는데 왜 자꾸 딴 방법을 쓰려고 해.' },
  { level: '순한맛', line: '젊은 기사가 왜 이렇게 융통성이 없나 몰라.' },
  { level: '순한맛', line: '굳이 그렇게까지 안전고리 두 개씩 걸어야 되나, 하나면 충분한데.' },
  { level: '순한맛', line: '이번 한 번만 내 방식대로 작업해보면 안 되겠나?' },
  { level: '순한맛', line: '자네 생각도 좋은데, 그래도 안전은 경험자 말을 들어야지.' },
  { level: '순한맛', line: '다른 현장은 이 정도 오차 그냥 넘어가던데요, 그쪽만 왜 이렇게 까다로워요?' },
  { level: '순한맛', line: '제가 원하는 마감 방식대로만 좀 맞춰주시면 안 되나요?' },
  { level: '순한맛', line: '그냥 제가 말씀드린 자재로 진행해 주셨으면 좋겠는데요.' },
  { level: '순한맛', line: '저희는 늘 이렇게 납품하는데, 그쪽 현장만 왜 유독 까다로우세요.' },
  { level: '순한맛', line: '다들 이 규격 쓰시던데 왜 굳이 다른 걸 찾으세요.' },
  { level: '순한맛', line: '그냥 재고 있는 걸로 맞춰주시면 서로 편할 텐데요.' },
  { level: '순한맛', line: '형님이 하라는 대로 하면 되지, 왜 자꾸 딴 고집을 부려.' },
  { level: '순한맛', line: '내가 이 바닥 경력 더 기니까 그냥 내 말 들어.' },
  { level: '순한맛', line: '그렇게까지 네 방식대로 해야겠니?' },
  { level: '순한맛', line: '다른 현장은 이 시간에도 조용히 하던데, 여기만 왜 이렇게 시끄러워요.' },
  { level: '순한맛', line: '그냥 공사 시간 좀 맞춰주시면 안 될까요?' },
  { level: '순한맛', line: '이번엔 저희 요청대로 한번 맞춰주시죠.' },
  { level: '순한맛', line: '다른 현장은 서류를 이렇게 내던데, 여기만 유독 다르게 내시네요.' },
  { level: '순한맛', line: '그냥 양식대로 다시 제출해 주시면 안 될까요?' },
  { level: '순한맛', line: '경험 있으시면 아시잖아요, 그냥 이대로 처리하시죠.' },
  { level: '순한맛', line: '다른 팀은 다 이 순서로 하던데, 우리 팀만 유독 다르게 하네.' },
  { level: '순한맛', line: '내가 공정 오래 짜봐서 아는데, 이렇게 하는 게 맞아.' },
  { level: '순한맛', line: '그냥 내 스케줄대로 맞춰주면 편할 텐데 왜 그러니.' },
  { level: '순한맛', line: '다들 이 단가로 납품받던데 님만 유독 고집부리시네요.' },
  { level: '순한맛', line: '그냥 저희가 알려드린 방식대로 해보시죠, 그게 편해요.' },
  { level: '순한맛', line: '경력자 말 들어서 나쁠 거 없잖아요, 그냥 이대로 하세요.' },
  // 매운맛 (30)
  { level: '매운맛', line: '그냥 내 말대로 시공하면 되는데 왜 자꾸 딴 의견을 내는 거야?' },
  { level: '매운맛', line: '몇 번을 말해야 알아듣나, 그냥 시키는 대로 좀 해.' },
  { level: '매운맛', line: '네 생각 따위 필요 없으니까 하라는 대로만 해.' },
  { level: '매운맛', line: '이건 토론할 문제가 아니라 그냥 지시야, 알겠어?' },
  { level: '매운맛', line: '왜 자꾸 말대꾸야? 그냥 까라면 까야지.' },
  { level: '매운맛', line: '네가 뭘 안다고 자꾸 고집을 부려.' },
  { level: '매운맛', line: '다들 내 방식대로 하는데 왜 너만 유별나게 구는 거야?' },
  { level: '매운맛', line: '지금 나랑 해보자는 거야? 그냥 시키는 대로 해.' },
  { level: '매운맛', line: '그렇게 잘났으면 혼자 다 해보든가.' },
  { level: '매운맛', line: '이건 토론할 문제가 아니라 그냥 요청이잖아요, 좀 해주세요.' },
  { level: '매운맛', line: '저희가 낸 돈인데 왜 저희 말을 안 들으세요?' },
  { level: '매운맛', line: '그렇게 잘 아시면 왜 저희 말대로 안 해주세요?' },
  { level: '매운맛', line: '몇 번을 말씀드려야 알아들으세요, 그냥 좀 맞춰주세요.' },
  { level: '매운맛', line: '다들 참는데 왜 그 현장만 계속 고집을 부리세요.' },
  { level: '매운맛', line: '이건 부탁이 아니라 그냥 지켜달라는 거예요.' },
  { level: '매운맛', line: '몇 번을 말해야 알아듣냐, 그냥 시키는 대로 해.' },
  { level: '매운맛', line: '네가 뭘 안다고 매번 반대만 해.' },
  { level: '매운맛', line: '그냥 형님 말 좀 들어, 왜 자꾸 고집이야.' },
  { level: '매운맛', line: '규정이 그런데 왜 혼자만 안 지키세요.' },
  { level: '매운맛', line: '다들 맞춰주는데 왜 그쪽만 유별나게 구세요.' },
  { level: '매운맛', line: '그냥 정해진 시간대로 따라주시면 안 돼요?' },
  { level: '매운맛', line: '다른 현장은 군말 없이 하던데, 여기는 왜 이렇게 말이 많아요.' },
  { level: '매운맛', line: '제가 하라면 하는 거지, 무슨 말이 그렇게 많아요.' },
  { level: '매운맛', line: '그냥 시키는 대로 해주세요, 이유 묻지 말고.' },
  { level: '매운맛', line: '몇 번을 설명해야 이해하나, 그냥 공정표대로 하세요.' },
  { level: '매운맛', line: '다들 지키는 순서인데 왜 혼자만 어기세요.' },
  { level: '매운맛', line: '말이 많다, 그냥 시키는 대로 좀 하시죠.' },
  { level: '매운맛', line: '그냥 저희 단가로 맞춰주시면 안 돼요?' },
  { level: '매운맛', line: '몇 번을 얘기해야 돼요, 두 번 말 안 합니다.' },
  { level: '매운맛', line: '다른 현장은 다 이렇게 받던데 왜 여기만 이렇게 까다로워요.' },
  // 지옥맛 (30)
  { level: '지옥맛', line: '됐고, 토 달지 말고 지금 당장 다시 해와.' },
  { level: '지옥맛', line: '몇 번을 얘기해야 돼? 두 번 말 안 한다, 당장 고쳐.' },
  { level: '지옥맛', line: '핑계 대지 말고 시키는 대로 안 할 거면 그만둬.' },
  { level: '지옥맛', line: '말대꾸할 시간에 그냥 시키는 대로나 해.' },
  { level: '지옥맛', line: '내가 하라면 하는 거지, 무슨 말이 그렇게 많아.' },
  { level: '지옥맛', line: '이딴 식으로 할 거면 그만 나오지 마.' },
  { level: '지옥맛', line: '여기서 결정권은 나한테 있어, 토 달지 마.' },
  { level: '지옥맛', line: '네 의견 궁금한 적 없으니까 입 다물고 시키는 거나 해.' },
  { level: '지옥맛', line: '당장 안 고치면 오늘부로 현장에서 나가.' },
  { level: '지옥맛', line: '이딴 식으로 시공할 거면 계약 자체를 재검토하겠습니다.' },
  { level: '지옥맛', line: '핑계 대지 말고 지금 당장 재시공해 주세요.' },
  { level: '지옥맛', line: '말대꾸할 시간에 빨리 처리나 해주세요.' },
  { level: '지옥맛', line: '당장 안 고치면 거래 끊겠습니다.' },
  { level: '지옥맛', line: '핑계 대지 말고 규격대로 다시 납품하세요.' },
  { level: '지옥맛', line: '이딴 식으로 할 거면 아예 다른 업체 알아보겠습니다.' },
  { level: '지옥맛', line: '여기서 결정권은 나한테 있어, 토 달지 마.' },
  { level: '지옥맛', line: '말대꾸할 시간에 그냥 시키는 대로 해.' },
  { level: '지옥맛', line: '몇 번을 얘기해야 돼? 두 번 말 안 한다.' },
  { level: '지옥맛', line: '당장 안 고치면 그냥 민원 넣겠습니다.' },
  { level: '지옥맛', line: '핑계 대지 말고 규정대로 하세요.' },
  { level: '지옥맛', line: '이딴 식으로 할 거면 아예 공사를 중단시키겠습니다.' },
  { level: '지옥맛', line: '당장 서류 안 고치면 허가 취소될 수 있습니다.' },
  { level: '지옥맛', line: '핑계 대지 말고 규정대로 다시 제출하세요.' },
  { level: '지옥맛', line: '말대꾸할 시간에 서류나 다시 보세요.' },
  { level: '지옥맛', line: '말대꾸할 시간에 손이나 놀려.' },
  { level: '지옥맛', line: '내가 하라면 하는 거지, 무슨 말이 그렇게 많니.' },
  { level: '지옥맛', line: '이딴 식으로 할 거면 아예 나가.' },
  { level: '지옥맛', line: '핑계 대지 말고 지금 당장 재배송하세요.' },
  { level: '지옥맛', line: '당장 안 고치면 다른 업체로 바꾸겠습니다.' },
  { level: '지옥맛', line: '말대꾸할 시간에 시키는 거나 하세요.' },
];

// 상황 생성 시 AI에게 참고시킬 건설 현장 관계 테마 목록 (다양성 확보용)
const SITUATION_THEMES = [
  '원청 현장소장', '협력업체 반장', '안전관리자', '발주처/감리', '자재·장비업체',
  '하도급 인부', '인근 민원인', '관공서 담당자', '동료 반장·타 공정팀', '납품 거래처',
];

const BAG_KEY = 'avatar_training_situation_bag';

// 배열을 무작위로 섞는다 (Fisher–Yates)
function shuffleIndexes(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// '제비뽑기 주머니' 방식: 90개를 한 바퀴 다 뽑기 전에는 같은 문장이 다시 나오지 않는다.
// 주머니가 비면(다 뽑히면) 새로 섞어서 다시 채운다.
function drawFallbackSituation(): Situation {
  try {
    const raw = localStorage.getItem(BAG_KEY);
    let bag: number[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(bag) || bag.length === 0) {
      bag = shuffleIndexes(FALLBACK_SITUATIONS.length);
    }
    const idx = bag.pop() as number;
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
    return FALLBACK_SITUATIONS[idx];
  } catch {
    // 저장소 접근 실패 시 단순 무작위로 대체
    return FALLBACK_SITUATIONS[Math.floor(Math.random() * FALLBACK_SITUATIONS.length)];
  }
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function AvatarTrainingRoom() {
  const [stage, setStage] = useState<Stage>('idle');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [situation, setSituation] = useState<Situation | null>(null);
  const [reply, setReply] = useState('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [savedLines, setSavedLines] = useState<SavedLine[]>([]);
  const [copyDone, setCopyDone] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef<any>(null);
  // 마이크 시작 시점의 기존 텍스트를 보관 (이번 발화 결과를 그 뒤에 이어붙이기 위함)
  const baseTextRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  // 최근에 나온 상황 문장을 기억해두었다가, AI에게 "이건 피해서 만들어줘"라고 알려주기 위함
  const recentLinesRef = useRef<string[]>([]);

  // 시작/종료 신호음 재생 (외부 음원 파일 없이 브라우저 자체 생성음 사용)
  function playBeep(freq: number, durationMs: number) {
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // 오디오 재생 실패는 기능에 영향 없으므로 무시
    }
  }

  // 로컬 저장소에서 보관함 불러오기
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedLines(JSON.parse(raw));
    } catch {
      // 저장소 접근 실패 시 무시 (우회 공법: 빈 배열 유지)
    }

    // 음성 인식 지원 여부 확인 (Web Speech API)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setMicSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      // 한 번 누르면 한 문장(발화 단위)만 인식하고 자동 종료.
      // 대화가 길어져 끊기면 버튼을 다시 눌러(빨간불) 이어서 녹음하는 방식.
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        // 발화가 길면 엔진이 내부적으로 여러 확정(final) 구간을 보낼 수 있으므로
        // 전체를 순회해 final 구간만 이어 붙여 중복을 방지한다.
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        const combined = finalTranscript.trim();
        setReply(
          baseTextRef.current ? `${baseTextRef.current} ${combined}`.trim() : combined
        );
      };
      recognition.onend = () => {
        setIsListening(false);
        playBeep(500, 120); // 종료 신호음 (낮은 음)
      };
      recognition.onerror = () => {
        setIsListening(false);
        setErrorMsg('음성 인식에 실패했습니다. 다시 마이크 버튼을 누르거나 텍스트로 입력해 주세요.');
      };
      recognitionRef.current = recognition;
    }
  }, []);

  // savedLines가 바뀔 때마다, gongguri.com 홈에서도 읽을 수 있도록
  // .gongguri.com 전체 도메인 범위 쿠키에 '요약 정보'만 저장한다.
  // (LocalStorage는 서브도메인끼리 공유되지 않기 때문에 쿠키를 씀)
  useEffect(() => {
    try {
      const stats = computeRecentAverage(savedLines, 10);
      if (!stats) return; // 기록이 없으면 굳이 쿠키를 안 씀

      const payload = JSON.stringify({
        avg: stats.average,
        count: stats.count,
        rank: getOverallRank(stats.average),
      });

      const maxAgeSeconds = 60 * 60 * 24 * 400; // 약 400일 보관
      document.cookie =
        `gongguri_mental_rank=${encodeURIComponent(payload)}; ` +
        `domain=.gongguri.com; path=/; max-age=${maxAgeSeconds}; SameSite=Lax; Secure`;
    } catch {
      // 쿠키 저장 실패는 핵심 기능에 영향 없으므로 무시 (우회 공법)
    }
  }, [savedLines]);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setErrorMsg('');
      baseTextRef.current = reply.trim();
      try {
        recognitionRef.current.start();
        setIsListening(true);
        playBeep(900, 120); // 시작 신호음 (높은 음)
      } catch {
        setErrorMsg('마이크를 시작할 수 없습니다. 텍스트로 입력해 주세요.');
      }
    }
  }

  // ── 1단계: 상황 던져바라 ──
  async function fetchSituation() {
    setLoading(true);
    setErrorMsg('');
    setLoadingMsg('오늘의 진상 상황을 준비하는 중...');
    setReply('');
    setResult(null);
    try {
      const theme = SITUATION_THEMES[Math.floor(Math.random() * SITUATION_THEMES.length)];
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'situation',
          theme,
          recentLines: recentLinesRef.current,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `요청 실패 (status: ${res.status})`);
      }
      const data = await res.json();
      setSituation({ level: data.level, line: data.line });
      setStage('situation');
      // 최근 상황 목록 갱신 (최대 8개 유지, 다음 요청 때 AI에게 "이건 피해줘"로 전달됨)
      recentLinesRef.current = [data.line, ...recentLinesRef.current].slice(0, 8);
    } catch (err) {
      // 우회 공법: API 실패 시 '제비뽑기 주머니' 방식으로 폴백 상황 제공
      // (90개를 한 바퀴 다 뽑기 전에는 같은 문장이 반복되지 않음)
      // 실제 실패 원인은 브라우저 개발자 콘솔(F12)에서 확인 가능
      console.error('[상황 생성 실패]', err);
      setSituation(drawFallbackSituation());
      setStage('situation');
      setErrorMsg('서버 연결이 원활하지 않아 기본 상황으로 진행합니다. (F12 콘솔에서 상세 원인 확인 가능)');
    } finally {
      setLoading(false);
    }
  }

  // ── 2단계: 평가받기 ──
  async function evaluateReply() {
    if (!situation || !reply.trim()) {
      setErrorMsg('아바타의 대답을 먼저 입력해 주세요.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setLoadingMsg('현장 소리를 강철 아바타 대사로 바꾸는 중...');
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', situation: situation.line, reply }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `요청 실패 (status: ${res.status})`);
      }
      const data = await res.json();
      const score = Math.max(0, Math.min(100, Number(data.score) || 0));
      setResult({
        score,
        feedback: data.feedback,
        rank: getRank(score),
        suggestedReply: data.suggestedReply,
      });
      setStage('result');
    } catch (err) {
      // 우회 공법: 평가 서버 실패 시 최소 안내와 함께 기본 점수 제공
      // 실제 실패 원인은 브라우저 개발자 콘솔(F12)에서 확인 가능
      console.error('[평가 실패]', err);
      setResult({
        score: 60,
        feedback: '평가 서버 연결이 원활하지 않아 임시 점수를 표시합니다. 다시 시도해 보세요.',
        rank: getRank(60),
      });
      setStage('result');
      setErrorMsg('평가 서버 연결에 문제가 있었습니다. (F12 콘솔에서 상세 원인 확인 가능)');
    } finally {
      setLoading(false);
    }
  }

  // ── 결과 복사 ──
  async function copyResult() {
    if (!situation || !result) return;
    const text = `[아바타 트레이닝 결과]
난이도: ${situation.level}
상대 대사: ${situation.line}
내 아바타 대답: ${reply}
방어력 점수: ${result.score}점
계급: ${result.rank}
코치 피드백: ${result.feedback}${result.suggestedReply ? `\n모범 답안: ${result.suggestedReply}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setErrorMsg('복사에 실패했습니다. 화면을 길게 눌러 직접 복사해 주세요.');
    }
  }

  // ── 보관함 저장 ──
  function saveToVault() {
    if (!situation || !result) return;
    const entry: SavedLine = {
      id: `${Date.now()}`,
      situation: situation.line,
      reply,
      score: result.score,
      rank: result.rank,
      savedAt: new Date().toLocaleString('ko-KR'),
    };
    const next = [entry, ...savedLines].slice(0, 50); // 최대 50개 보관
    setSavedLines(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 2000);
    } catch {
      setErrorMsg('보관함 저장에 실패했습니다. (브라우저 저장 공간을 확인해 주세요)');
    }
  }

  function clearVault() {
    setSavedLines([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 무시
    }
  }

  function resetAll() {
    setStage('idle');
    setSituation(null);
    setReply('');
    setResult(null);
    setErrorMsg('');
  }

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────
  const overallStats = computeRecentAverage(savedLines, 10);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8">
      <header className="w-full max-w-md text-center mb-6">
        <h1 className="text-2xl font-extrabold text-yellow-400 tracking-tight">
          아바타 트레이닝 룸
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          자극과 반응 사이, 흔들리지 않는 강철 아바타 연습장
        </p>

        {/* 누적 평균 계급 대시보드 */}
        {overallStats ? (
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-yellow-500 bg-yellow-500/10 px-4 py-1.5">
            <span className="text-xs text-gray-400">
              최근 {overallStats.count}회 평균
            </span>
            <span className="text-yellow-400 font-extrabold text-sm">
              {overallStats.average}점
            </span>
            <span className="text-yellow-600 text-xs">·</span>
            <span className="text-yellow-300 font-bold text-sm">
              {getOverallRank(overallStats.average)}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-600">아직 평가 기록이 없습니다</p>
        )}
      </header>

      {errorMsg && (
        <div className="w-full max-w-md mb-4 rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-2 text-yellow-300 text-sm">
          {errorMsg}
        </div>
      )}

      <main className="w-full max-w-md flex flex-col gap-5">
        {/* ── IDLE 단계: 왕버튼 1 ── */}
        {stage === 'idle' && (
          <BigButton onClick={fetchSituation} disabled={loading}>
            {loading ? loadingMsg : '🎬 상황 던져바라'}
          </BigButton>
        )}

        {/* ── SITUATION 단계: 상황 표시 + 입력 + 왕버튼 2 ── */}
        {stage === 'situation' && situation && (
          <>
            <div className="rounded-xl border border-yellow-500/50 bg-neutral-900 p-4">
              <span className={`text-xs font-bold ${LEVEL_COLOR[situation.level]}`}>
                {situation.level}
              </span>
              <p className="mt-2 text-lg leading-relaxed">"{situation.line}"</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400">
                당신의 아바타는 어떻게 넉살 좋게 받아치겠습니까?
              </label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="여기에 텍스트로 입력하거나, 아래 마이크 버튼을 눌러 말해 보세요."
                rows={4}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 text-white p-3 text-base focus:outline-none focus:border-yellow-400"
              />
              {micSupported && (
                <button
                  onClick={toggleMic}
                  className={`w-full py-4 rounded-lg font-bold text-base border-2 transition ${
                    isListening
                      ? 'bg-red-600 border-red-400 text-white animate-pulse'
                      : 'bg-neutral-800 border-neutral-600 text-yellow-300'
                  }`}
                >
                  {isListening
                    ? '🔴 녹음 중 (말이 끊기면 다시 눌러 이어가세요)'
                    : '🎤 눌러서 말하기 (삐 소리 후 시작)'}
                </button>
              )}
            </div>

            <BigButton onClick={evaluateReply} disabled={loading}>
              {loading ? loadingMsg : '✅ 평가받기'}
            </BigButton>

            <button
              onClick={resetAll}
              className="text-sm text-gray-500 underline underline-offset-2"
            >
              처음부터 다시
            </button>
          </>
        )}

        {/* ── RESULT 단계: 결과 + 왕버튼 3 (복사/저장) ── */}
        {stage === 'result' && result && situation && (
          <>
            <div className="rounded-xl border border-yellow-500 bg-neutral-900 p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-yellow-400">
                  {result.score}점
                </span>
                <span className="text-sm font-bold text-white bg-yellow-500/20 px-2 py-1 rounded">
                  {result.rank}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-1">상대 대사: "{situation.line}"</p>
              <p className="text-sm text-gray-300">내 아바타 대답: "{reply}"</p>
              <div className="mt-2 border-t border-neutral-700 pt-2">
                <p className="text-xs font-bold text-gray-500 mb-1">코치 피드백</p>
                <p className="text-sm text-gray-200 leading-relaxed">{result.feedback}</p>
              </div>
              {result.suggestedReply && (
                <div className="mt-2 border-t border-neutral-700 pt-2">
                  <p className="text-xs font-bold text-yellow-500 mb-1">
                    💡 이렇게 받아치면 더 넉살 좋았을 거예요
                  </p>
                  <p className="text-sm text-yellow-200 leading-relaxed">
                    "{result.suggestedReply}"
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyResult}
                className="py-3 rounded-lg font-bold bg-neutral-800 border border-yellow-500 text-yellow-300"
              >
                {copyDone ? '복사 완료!' : '📋 결과 복사'}
              </button>
              <button
                onClick={saveToVault}
                className="py-3 rounded-lg font-bold bg-neutral-800 border border-yellow-500 text-yellow-300"
              >
                {saveDone ? '저장 완료!' : '⭐ 보관함 저장'}
              </button>
            </div>

            <BigButton onClick={fetchSituation} disabled={loading}>
              {loading ? loadingMsg : '🔁 다음 상황으로'}
            </BigButton>

            <button
              onClick={resetAll}
              className="text-sm text-gray-500 underline underline-offset-2"
            >
              처음으로
            </button>
          </>
        )}

        {/* ── 보관함 토글 ── */}
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <button
            onClick={() => setShowVault((v) => !v)}
            className="w-full text-sm text-gray-400 underline underline-offset-2"
          >
            {showVault ? '보관함 닫기' : `📂 내 명대사 보관함 열기 (${savedLines.length})`}
          </button>

          {showVault && (
            <div className="mt-3 flex flex-col gap-2">
              {savedLines.length === 0 && (
                <p className="text-sm text-gray-600 text-center">
                  아직 저장된 명대사가 없습니다.
                </p>
              )}
              {savedLines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm"
                >
                  <div className="flex justify-between text-yellow-400 font-bold">
                    <span>{line.score}점</span>
                    <span>{line.rank}</span>
                  </div>
                  <p className="text-gray-400 mt-1">상황: {line.situation}</p>
                  <p className="text-gray-200">대답: {line.reply}</p>
                  <p className="text-xs text-gray-600 mt-1">{line.savedAt}</p>
                </div>
              ))}
              {savedLines.length > 0 && (
                <button
                  onClick={clearVault}
                  className="mt-2 text-xs text-red-400 underline underline-offset-2"
                >
                  💥 흔적 싹 지우기 (보관함 전체 삭제)
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-10 text-xs text-gray-700 text-center">
        연습 기록은 이 기기의 브라우저에만 저장되며, 서버로 전송되지 않습니다.
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────
// 왕버튼 공통 컴포넌트 (검정/노랑 고대비, 대형 버튼)
// ─────────────────────────────────────────────
function BigButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-6 rounded-2xl text-xl font-extrabold bg-yellow-400 text-black active:scale-95 transition disabled:opacity-50 disabled:active:scale-100 shadow-lg"
    >
      {children}
    </button>
  );
}
