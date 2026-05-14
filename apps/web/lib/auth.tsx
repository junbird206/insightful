'use client'

import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { translateAuthError } from '@/lib/errors'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type SignUpResult = {
  error: string | null
  needsEmailConfirmation: boolean
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, nickname: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  updateNickname: (nickname: string) => Promise<string | null>
}

export function getNickname(user: User | null): string | null {
  const value = user?.user_metadata?.nickname
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
  }, [])

  useEffect(() => {
    if (!supabase) return

    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(async (error) => {
        if (!mounted) return
        console.warn('[auth] getSession failed; clearing local session', error)
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // best-effort: signOut may also fail if storage is unreachable
        }
        if (!mounted) return
        setSession(null)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function signIn(email: string, password: string): Promise<string | null> {
    if (!supabase) {
      return '잠시 후 다시 시도해주세요.'
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return error ? translateAuthError(error.message) : null
  }

  async function signUp(
    email: string,
    password: string,
    nickname: string,
  ): Promise<SignUpResult> {
    if (!supabase) {
      return { error: 'Supabase 클라이언트가 아직 준비되지 않았습니다.', needsEmailConfirmation: false }
    }

    const trimmedNickname = nickname.trim()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname: trimmedNickname },
        emailRedirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })

    if (error) {
      return { error: translateAuthError(error.message), needsEmailConfirmation: false }
    }

    // If email confirmation is enabled in Supabase, signUp returns a user but
    // no session — let the caller surface a "check your inbox" message.
    return {
      error: null,
      needsEmailConfirmation: !data.session,
    }
  }

  async function signOut(): Promise<void> {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function updateNickname(nickname: string): Promise<string | null> {
    if (!supabase) {
      return '잠시 후 다시 시도해주세요.'
    }
    const trimmed = nickname.trim()
    if (!trimmed) {
      return '닉네임을 입력해주세요.'
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { nickname: trimmed },
    })
    if (error) return translateAuthError(error.message)
    if (data.user) {
      setSession((current) => (current ? { ...current, user: data.user! } : current))
    }
    return null
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        signIn,
        signUp,
        signOut,
        updateNickname,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
