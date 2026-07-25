# 아바타 트레이닝 룸 v1.0 — 설치 가이드

## 1. 전제 조건
기존 **Next.js + Tailwind CSS** 프로젝트(App Router)가 없다면 아래 명령으로 새로 생성합니다.

```bash
npx create-next-app@latest avatar-training-room --typescript --tailwind --app
cd avatar-training-room
```

이미 프로젝트가 있다면 아래 두 파일만 그대로 덮어쓰거나 추가하면 됩니다.

- `app/page.tsx`
- `app/api/coach/route.ts`

## 2. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 만들고 Anthropic API 키를 입력합니다.

```
ANTHROPIC_API_KEY=여기에_실제_API_키_입력
```

**주의:** `.env.local`은 절대 깃허브에 커밋하지 않습니다. (`.gitignore`에 기본 포함되어 있는지 확인)

## 3. 로컬 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속 후 확인합니다.

## 4. Vercel 배포
1. GitHub 저장소에 푸시
2. Vercel에서 해당 저장소 Import
3. Vercel 프로젝트 설정 → **Environment Variables**에 `ANTHROPIC_API_KEY` 동일하게 등록
4. Deploy

## 5. 기능 요약
| 단계 | 왕버튼 | 동작 |
|---|---|---|
| 1 | 🎬 상황 던져바라 | AI가 순한맛/매운맛/지옥맛 중 하나의 진상 대사를 무작위 생성 |
| 2 | ✅ 평가받기 | 마이크(음성) 또는 텍스트로 입력한 아바타 대답을 AI가 0~100점으로 평가 |
| 3 | 📋 결과 복사 / ⭐ 보관함 저장 | 결과를 카카오톡 등에 붙여넣기용 텍스트로 복사하거나, 브라우저 로컬 저장소에 저장 |

## 6. 우회 공법(Fallback) 안내
- **음성 인식 미지원 브라우저**: 마이크 버튼이 자동으로 숨겨지고 텍스트 입력만 노출됩니다.
- **API 호출 실패 시**: 상황 생성은 내장된 기본 대사 3종 중 하나로 대체되고, 평가는 임시 점수(60점)와 함께 재시도 안내 메시지가 표시됩니다.
- **로컬 저장 실패 시**: 오류 메시지만 표시되고 앱은 계속 정상 동작합니다.

## 7. 데이터 처리 원칙
- 모든 연습 기록(보관함)은 **사용자 브라우저의 LocalStorage에만 저장**되며 외부 서버로 전송되지 않습니다.
- 상황 생성/평가 요청 시 대화 내용은 Anthropic API로 전송되어 처리된 뒤 응답만 반환되며, 이 앱 자체에서는 별도로 로그를 남기지 않습니다.
