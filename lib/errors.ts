// Supabase / 네트워크 에러 메시지를 사용자에게 보여줄 한국어 문구로 변환한다.
// 호출부에서 단순히 translateAuthError(error.message)만 부르면 되도록 단방향
// 매핑만 제공한다. 매칭 안 되면 fallback 메시지로 떨어뜨려서 raw 영문 메시지가
// 그대로 노출되는 일이 없게 한다.

const AUTH_ERROR_MAP: Array<{ match: RegExp; message: string }> = [
  // 로그인 실패류
  { match: /invalid login credentials/i, message: '이메일 또는 비밀번호가 일치하지 않습니다.' },
  { match: /invalid (email|password)/i, message: '이메일 또는 비밀번호가 일치하지 않습니다.' },
  { match: /email not confirmed/i, message: '이메일 인증이 완료되지 않았습니다. 받은 메일의 인증 링크를 눌러주세요.' },
  { match: /user not found/i, message: '등록되지 않은 계정입니다.' },

  // 회원가입 실패류
  { match: /user already registered|already (been )?registered/i, message: '이미 가입된 이메일입니다. 로그인해주세요.' },
  { match: /email address .* (invalid|not valid)/i, message: '올바른 이메일 형식이 아닙니다.' },
  { match: /password should be at least/i, message: '비밀번호는 6자 이상으로 설정해주세요.' },
  { match: /signup (is )?disabled|signups not allowed/i, message: '현재 회원가입이 일시 중단되어 있습니다.' },

  // 비밀번호 변경류
  { match: /new password should be different/i, message: '기존과 다른 비밀번호를 입력해주세요.' },
  { match: /password.*(too short|weak)/i, message: '더 안전한 비밀번호를 입력해주세요 (6자 이상).' },

  // 요청 빈도
  { match: /rate limit|too many requests|for security purposes/i, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },

  // 네트워크/세션
  { match: /network|failed to fetch|fetch.*invalid value/i, message: '네트워크 연결을 확인한 뒤 다시 시도해주세요.' },
  { match: /jwt|session.*(expired|invalid)|not authenticated/i, message: '세션이 만료되었습니다. 다시 로그인해주세요.' },

  // 권한
  { match: /not allowed|forbidden|permission/i, message: '권한이 없는 요청입니다.' },
]

export function translateAuthError(raw: string | null | undefined): string {
  if (!raw) return '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
  for (const entry of AUTH_ERROR_MAP) {
    if (entry.match.test(raw)) return entry.message
  }
  return '문제가 발생했어요. 잠시 후 다시 시도해주세요.'
}

// 비-auth 작업(저장/삭제 등)에 쓰는 일반 fallback. 호출부에서 짧고 일관된
// 메시지를 보여주고 싶을 때 사용한다.
export function describeDataError(raw: string | null | undefined, fallback = '저장하지 못했어요. 잠시 후 다시 시도해주세요.'): string {
  if (!raw) return fallback
  if (/network|failed to fetch/i.test(raw)) return '네트워크 연결을 확인해주세요.'
  if (/jwt|session.*(expired|invalid)|not authenticated/i.test(raw)) return '세션이 만료되었습니다. 다시 로그인해주세요.'
  return fallback
}
