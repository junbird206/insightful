import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthContextType = {
  session: Session | null
  user: User | null
  nickname: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<string | null>
  updatePassword: (newPassword: string) => Promise<string | null>
  updateNickname: (nickname: string) => Promise<string | null>
  deleteAccount: () => Promise<string | null>
}

export function getNickname(user: User | null): string | null {
  const value = user?.user_metadata?.nickname
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 앱 시작 시 기존 세션 복원
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    // 세션 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ─── Email / Password ───────────────────────────────────────────────────

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ─── Password update ─────────────────────────────────────────────────────

  async function updatePassword(newPassword: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  }

  // ─── Nickname update ─────────────────────────────────────────────────────
  // Stored at auth.users.user_metadata.nickname — same location used by the
  // web client so changes round-trip automatically.

  async function updateNickname(nickname: string): Promise<string | null> {
    const trimmed = nickname.trim()
    if (!trimmed) return '닉네임을 입력해주세요.'
    if (trimmed.length > 20) return '닉네임은 20자 이내로 입력해주세요.'

    const { data, error } = await supabase.auth.updateUser({
      data: { nickname: trimmed },
    })
    if (error) return error.message
    if (data.user) {
      setSession((current) => (current ? { ...current, user: data.user! } : current))
    }
    return null
  }

  // ─── Account deletion ──────────────────────────────────────────────────

  async function deleteAccount(): Promise<string | null> {
    const { error } = await supabase.rpc('delete_own_account')
    if (error) return error.message
    await supabase.auth.signOut()
    return null
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  // Supabase Dashboard에서 Google provider 활성화 필요
  // Authentication > Providers > Google > Enable
  // Google Cloud Console에서 OAuth 2.0 Client ID 발급 필요

  async function signInWithGoogle(): Promise<string | null> {
    try {
      const redirectTo = makeRedirectUri()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })

      if (error || !data.url) return error?.message ?? 'OAuth URL 생성 실패'

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success') {
        // 콜백 URL에서 토큰 추출
        const url = result.url
        const fragmentParams = new URLSearchParams(url.split('#')[1] ?? '')
        const accessToken = fragmentParams.get('access_token')
        const refreshToken = fragmentParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          return sessionError?.message ?? null
        }
      }

      return null // 사용자가 취소한 경우
    } catch (err) {
      return err instanceof Error ? err.message : 'Google 로그인 실패'
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        nickname: getNickname(session?.user ?? null),
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        updatePassword,
        updateNickname,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
