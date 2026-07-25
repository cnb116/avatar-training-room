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

const LEVEL_COLOR: Record<Level, string> = {
  순한맛: 'text-yellow-300',
  매운맛: 'text-yellow-400',
  지옥맛: 'text-red-400',
};

const STORAGE_KEY = 'avatar_training_saved_lines';

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
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setReply((prev) => (prev ? prev + ' ' + text : text));
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
        setErrorMsg('음성 인식에 실패했습니다. 텍스트로 입력해 주세요.');
      };
      recognitionRef.current = recognition;
    }
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setErrorMsg('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
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
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'situation' }),
      });
      if (!res.ok) throw new Error('요청 실패');
      const data = await res.json();
      setSituation({ level: data.level, line: data.line });
      setStage('situation');
    } catch {
      // 우회 공법: API 실패 시 기본 상황 세트 중 하나를 무작위 제공
      const fallback: Situation[] = [
        { level: '순한맛', line: '거참, 그렇게 하지 말고 내가 하라는 대로 하지 그러나.' },
        { level: '매운맛', line: '아니 왜 자꾸 니 방식대로만 하려고 해? 그냥 시키는 대로 해.' },
        { level: '지옥맛', line: '됐고, 토 달지 말고 지금 당장 다시 해와.' },
      ];
      setSituation(fallback[Math.floor(Math.random() * fallback.length)]);
      setStage('situation');
      setErrorMsg('서버 연결이 원활하지 않아 기본 상황으로 진행합니다.');
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
      if (!res.ok) throw new Error('요청 실패');
      const data = await res.json();
      const score = Math.max(0, Math.min(100, Number(data.score) || 0));
      setResult({ score, feedback: data.feedback, rank: getRank(score) });
      setStage('result');
    } catch {
      // 우회 공법: 평가 서버 실패 시 최소 안내와 함께 기본 점수 제공
      setResult({
        score: 60,
        feedback: '평가 서버 연결이 원활하지 않아 임시 점수를 표시합니다. 다시 시도해 보세요.',
        rank: getRank(60),
      });
      setStage('result');
      setErrorMsg('평가 서버 연결에 문제가 있었습니다.');
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
코치 피드백: ${result.feedback}`;
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
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8">
      <header className="w-full max-w-md text-center mb-6">
        <h1 className="text-2xl font-extrabold text-yellow-400 tracking-tight">
          아바타 트레이닝 룸
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          자극과 반응 사이, 흔들리지 않는 강철 아바타 연습장
        </p>
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
                  className={`w-full py-3 rounded-lg font-bold text-base border ${
                    isListening
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-neutral-800 border-neutral-600 text-yellow-300'
                  }`}
                >
                  {isListening ? '🎤 듣는 중... (다시 눌러 종료)' : '🎤 마이크로 말하기'}
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
                <p className="text-sm text-gray-200 leading-relaxed">{result.feedback}</p>
              </div>
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
