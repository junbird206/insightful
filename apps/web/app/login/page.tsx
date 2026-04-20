'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { session, loading, signIn, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      router.replace('/')
    }
  }, [loading, router, session])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    const message = await signIn(email.trim(), password)

    setSubmitting(false)
    if (message) {
      setError(message)
    }
  }

  async function handleGoogle() {
    setGoogleSubmitting(true)
    setError('')

    const message = await signInWithGoogle()

    setGoogleSubmitting(false)
    if (message) {
      setError(message)
    }
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
          <p className="eyebrow">Your knowledge, retrievable.</p>
          <h1>
            흩어진 링크를,
            <br />
            다시 꺼내 쓰는 지식으로.
          </h1>
          <p className="auth-copy">
            어디서든 저장한 아티클과 생각을 한 곳에 모으고, 검색하고, 정리하세요. 모바일과 웹이
            하나의 계정으로 이어집니다.
          </p>
        </div>

        <div className="landing-section">
          <p className="landing-eyebrow">Why Insightful</p>
          <h2 className="landing-heading">저장만 하고 잊어버리는 북마크는 그만.</h2>
          <p className="landing-copy">
            인사이트풀은 단순 북마크가 아니라 "다시 꺼내 쓰는 지식"을 만드는 도구입니다.
            저장 시점에 의도(목적·메모·태그·리마인드)를 함께 적어두기 때문에, 시간이 지나도
            이 링크를 왜 저장했는지 한눈에 보입니다.
          </p>
        </div>

        <div className="landing-section">
          <p className="landing-eyebrow">Features</p>
          <h2 className="landing-heading">핵심 기능</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">📥</div>
              <h3>한 번의 공유로 저장</h3>
              <p>
                모바일 공유 시트나 웹에서 URL만 붙여넣으면 끝. 카드에 자동으로 사이트 정보와
                플랫폼 정보가 들어갑니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">📖</div>
              <h3>저장 목적으로 분리</h3>
              <p>
                "읽기 위한 것"과 "행동/실행할 것"을 버킷으로 구분해, 나중에 어떤 모드로 회수할지
                명확하게 잡아둡니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">🏷️</div>
              <h3>나만의 태그·메모</h3>
              <p>
                태그 풀에서 자주 쓰는 태그를 골라 카드를 분류하고, 메모로 "이걸 왜 저장했는지"를
                기록합니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">🔔</div>
              <h3>리마인드로 회수</h3>
              <p>
                저장한 카드에 알람을 걸어두면 시간이 됐을 때 모바일에서 알려드립니다. "저장만
                하고 잊는 일"을 막아줍니다.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">⭐</div>
              <h3>중요표시 & 빠른 필터</h3>
              <p>
                정말 중요한 카드는 별표로 표시해두고, 한 번의 클릭으로 별표만 모아볼 수 있어요.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" aria-hidden="true">🔄</div>
              <h3>모바일·웹 자동 동기화</h3>
              <p>
                한 계정으로 모바일과 웹이 실시간으로 연결됩니다. 어디서 저장하든 같은 라이브러리에
                쌓입니다.
              </p>
            </div>
          </div>
        </div>

        <div className="landing-section">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="landing-heading">3단계로 끝나는 지식 회수 루프</h2>
          <ol className="landing-steps">
            <li>
              <span className="step-number">1</span>
              <div>
                <strong>저장한다</strong>
                <p>
                  모바일 공유 시트 또는 웹에서 링크를 추가합니다. 저장하는 순간 목적·태그·메모를
                  같이 남기는 것이 핵심.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div>
                <strong>분류한다</strong>
                <p>
                  버킷(읽기/실행)과 태그로 카드를 정리합니다. 검색·필터로 원하는 카드를 즉시
                  찾을 수 있게 만듭니다.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div>
                <strong>회수한다</strong>
                <p>
                  리마인드 알람이나 별표 필터로 카드를 다시 꺼내 읽고, 메모를 업데이트하며 지식을
                  쌓아갑니다.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="landing-section">
          <p className="landing-eyebrow">Best for</p>
          <h2 className="landing-heading">이런 분에게 권합니다</h2>
          <ul className="landing-list">
            <li>모바일에서 본 글을 책상에서 다시 정리하고 싶은 분</li>
            <li>북마크가 너무 많아져서 정작 안 보게 된 분</li>
            <li>"나중에 읽기"를 진짜로 "나중에 읽는" 시스템으로 바꾸고 싶은 분</li>
            <li>지식을 흘려보내지 않고 자기만의 라이브러리로 쌓고 싶은 분</li>
          </ul>
        </div>

        <div className="hero-note">
          <strong>저장하고, 찾고, 다시 읽는 경험</strong>
          <span>카드 목록 · 스마트 검색 · 태그 필터 · 메모 편집 · 빠른 저장 · 리마인드</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-header">
          <p className="eyebrow">Welcome back</p>
          <h2>로그인</h2>
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
              }}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>비밀번호</span>
            <input
              autoComplete="current-password"
              className="text-input"
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              placeholder="비밀번호"
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={submitting || googleSubmitting} type="submit">
            {submitting ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </form>

        <div className="divider">
          <span />
          <p>또는</p>
          <span />
        </div>

        <button
          className="secondary-button"
          disabled={submitting || googleSubmitting}
          onClick={handleGoogle}
          type="button"
        >
          {googleSubmitting ? 'Google 연결 중...' : 'Google로 계속하기'}
        </button>

        <p className="helper-copy">
          처음이신가요? 모바일 앱에서 가입한 계정으로 그대로 로그인할 수 있습니다.
        </p>
      </section>
    </main>
    <SiteFooter />
    </>
  )
}
