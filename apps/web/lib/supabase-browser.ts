'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

function sanitize(value: string | undefined): string {
  if (!value) return ''
  // Strip whitespace + accidental surrounding quotes that sometimes sneak in
  // when env values are pasted into the Vercel dashboard.
  return value.trim().replace(/^['"]|['"]$/g, '').trim()
}

function preview(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…${value.slice(-4)} (len=${value.length})`
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) {
    return client
  }

  const url = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is missing or empty. Set it in Vercel → Project → Settings → Environment Variables and redeploy.',
    )
  }
  if (!anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty. Set it in Vercel → Project → Settings → Environment Variables and redeploy.',
    )
  }

  // Fail fast at init time with a clear message instead of crashing later
  // inside fetch() with the opaque browser error
  // "Failed to execute 'fetch' on 'Window': Invalid value".
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${preview(url)}. Expected something like https://xxxx.supabase.co`,
    )
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must use https:// (got ${parsed.protocol}). Value: ${preview(url)}`,
    )
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
