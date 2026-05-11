'use client'

import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<string | null>
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
      return 'Supabase client is not ready yet.'
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return error?.message ?? null
  }

  async function signOut(): Promise<void> {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function signInWithGoogle(): Promise<string | null> {
    if (!supabase) {
      return 'Supabase client is not ready yet.'
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    return error?.message ?? null
  }

  async function updateNickname(nickname: string): Promise<string | null> {
    if (!supabase) {
      return 'Supabase client is not ready yet.'
    }
    const trimmed = nickname.trim()
    if (!trimmed) {
      return '닉네임을 입력해주세요.'
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { nickname: trimmed },
    })
    if (error) return error.message
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
        signInWithGoogle,
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
