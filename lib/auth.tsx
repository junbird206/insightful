import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { translateAuthError } from './errors'
import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthContextType = {
  session: Session | null
  user: User | null
  nickname: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, nickname: string) => Promise<string | null>
  signOut: () => Promise<void>
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

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
    return error ? translateAuthError(error.message) : null
  }

  // Nickname is stored at auth.users.user_metadata.nickname at signup time
  // so the very first session already carries it (no extra round-trip).
  async function signUp(
    email: string,
    password: string,
    nickname: string,
  ): Promise<string | null> {
    const trimmedNickname = nickname.trim()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: trimmedNickname } },
    })
    return error ? translateAuthError(error.message) : null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ─── Password update ─────────────────────────────────────────────────────

  async function updatePassword(newPassword: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error ? translateAuthError(error.message) : null
  }

  // ─── Nickname update ─────────────────────────────────────────────────────

  async function updateNickname(nickname: string): Promise<string | null> {
    const trimmed = nickname.trim()
    if (!trimmed) return '닉네임을 입력해주세요.'
    if (trimmed.length > 20) return '닉네임은 20자 이내로 입력해주세요.'

    const { data, error } = await supabase.auth.updateUser({
      data: { nickname: trimmed },
    })
    if (error) return translateAuthError(error.message)
    if (data.user) {
      setSession((current) => (current ? { ...current, user: data.user! } : current))
    }
    return null
  }

  // ─── Account deletion ──────────────────────────────────────────────────

  async function deleteAccount(): Promise<string | null> {
    const { error } = await supabase.rpc('delete_own_account')
    if (error) return translateAuthError(error.message)
    await supabase.auth.signOut()
    return null
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
        updatePassword,
        updateNickname,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
