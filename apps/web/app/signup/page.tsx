'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/lib/auth'

const MAX_NICKNAME_LENGTH = 20
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupPage() {
  const router = useRouter()
  const { session, loading, signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      router.replace('/')
    }
  }, [loading, router, session])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    const trimmedNickname = nickname.trim()

    if (!trimmedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('올바른 이메일 형식이 아닙니다.')
      return
    }
    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.')
      return
    }
    if (trimmedNickname.length > MAX_NICKNAME_LENGTH) {
      setError(`닉네임은 ${MAX_NICKNAME_LENGTH}자 이내로 입력해주세요.`)
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    setError('')
    setInfo('')

    const result = await signUp(trimmedEmail, password, trimmedNickname)

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.needsEmailConfirmation) {
      // Email confirmation is enabled in Supabase — user must click the link
      // in their inbox before they can sign in.
      setInfo(
        '가입 확인 메일을 보냈습니다. 받은편지함에서 인증 링크를 누른 뒤 로그인해주세요.',
      )
      return
    }

    // Email confirmation disabled → signUp returns a session and
    // onAuthStateChange will redirect to '/' automatically.
  }

  return (
    <>
      <main className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-top">
            <div className="brand-mark">
              <img alt="Insightful" className="brand-logo brand-logo-lg" src="/insightful-logo.png" />
            </div>
          </div>

          <div className="hero-block">
            <p className="eyebrow">Start your library</p>
            <h1>
              지금 시작해서,
              <br />
              나만의 지식 라이브러리를.
            </h1>
            <p className="auth-copy">
              이메일과 닉네임만 입력하면 끝. 가입 즉시 모바일과 웹 양쪽에서 같은 계정으로
              이어집니다.
            </p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-header">
            <p className="eyebrow">Create account</p>
            <h2>회원가입</h2>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>이메일</span>
              <input
                autoComplete="email"
                className="text-input"
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                  setInfo('')
                }}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className="field">
              <span>닉네임</span>
              <input
                autoComplete="nickname"
                className="text-input"
                maxLength={MAX_NICKNAME_LENGTH}
                onChange={(event) => {
                  setNickname(event.target.value)
                  setError('')
                  setInfo('')
                }}
                placeholder="앱/웹에서 표시될 이름"
                type="text"
                value={nickname}
              />
              <p className="field-hint">{`최대 ${MAX_NICKNAME_LENGTH}자. 마이페이지에서 언제든 변경 가능합니다.`}</p>
            </label>

            <label className="field">
              <span>비밀번호</span>
              <input
                autoComplete="new-password"
                className="text-input"
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                  setInfo('')
                }}
                placeholder="6자 이상"
                type="password"
                value={password}
              />
            </label>

            <label className="field">
              <span>비밀번호 확인</span>
              <input
                autoComplete="new-password"
                className="text-input"
                onChange={(event) => {
                  setPasswordConfirm(event.target.value)
                  setError('')
                  setInfo('')
                }}
                placeholder="비밀번호를 다시 입력해주세요"
                type="password"
                value={passwordConfirm}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}
            {info ? <p className="form-success">{info}</p> : null}

            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="helper-copy">
            이미 계정이 있으신가요? <Link className="helper-link" href="/login">로그인</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
