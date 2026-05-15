# /reset-password Page

## 목적 ⭐
이메일로 받은 비밀번호 재설정 링크의 도착 지점. 사용자가 새 비밀번호를 입력하면 서버 `/auth/reset-password` 를 호출해 변경을 마무리한다. 앱이 아닌 웹에 둔 이유는 이메일 클라이언트가 보통 브라우저로 링크를 열기 때문 (앱 deep link 강제 불가).

## 사용처
- 서버가 `forgotPassword` 발송 시 메일 본문에 다음 형식 링크 포함:  
  `${RESET_PW_BASE_URL}/reset-password?token=XXX&uid=NN`
- 사용자가 메일 클라이언트에서 그 링크 클릭 → 이 페이지로 진입.
- 다른 곳에서는 직접 link 안 한다 (`/reset-password` 단독 진입은 token/uid 없어서 에러 UI).

## 데이터 타입

### URL Query Parameters
- `token`: string (32바이트 hex)
- `uid`: numeric string (user id)

### 호출하는 서버 API
```ts
POST {API_BASE}/auth/reset-password
Body: { userId: number, token: string, newPassword: string }
```

### API_BASE 분기
```ts
const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3030'
    : 'https://grameow-server-production.up.railway.app';
```

## 사용 예시

이 페이지 자체가 도착점이라 다른 코드에서 호출되지 않는다. 사용자가 URL로 직접 진입하는 형태.

```
https://grameow-web.vercel.app/reset-password?token=a1b2c3...&uid=42
```

서버에서 발송하는 메일 본문 예시는 `grameow-server/src/auth/mailer.service.ts` 참고.

## 주의해야 할 점 ⚠️

- **token + uid 두 개 다 query에 있어야 함**: 하나라도 빠지면 submit 버튼 disable + "잘못된 링크" 에러 표시. token만 가지고는 사용자 식별 불가 (서버 측 bcrypt hash 비교 흐름 때문).
- **`form.hidden = true` 안 먹음**: Astro의 scoped CSS와 충돌로 form `hidden` 속성이 자식 input/button까지 안 숨김. `form.style.display = 'none'` 명시 + description text 도 별도로 숨겨야 함 (실제 버그 수정 사례).
- **성공 후 form 전체 + description 모두 숨김**: 성공 메시지만 남기는 게 UX. 단순히 success view를 보이게만 하면 이전 form이 그대로 남아 혼란 줌.
- **API_BASE는 hostname 자동 감지**: localhost 개발 시 자동으로 :3030 서버에 붙음. prod URL은 hardcoded.
- **에러 메시지 표시**: 서버가 400 응답 + `{ message }` 본문 주면 그대로 표시. 토큰 만료/사용 완료 케이스 안내.
- **Astro client-side script**: TS 타입 캐스팅 사용. `as HTMLFormElement` 등은 Astro 빌드 시 정상 stripping 됨.
- **비밀번호 8자 + 확인 일치 검증**: 클라이언트 측에서 먼저 검증해서 불필요한 서버 호출 회피. 단 서버도 동일 검증 (@MinLength(8)).
- **API 호출 실패 시 버튼 disabled 해제**: 사용자가 재시도 가능해야 함. `submitBtn.disabled = false` + textContent 복구.

## 의존성
- 같은 도메인의 layout: `src/layouts/Layout.astro`
- 호출 대상 서버: `grameow-server/src/auth/auth.controller.ts` `POST /auth/reset-password`
- 환경: Vercel static page (no SSR), Astro
