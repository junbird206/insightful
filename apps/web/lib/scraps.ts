import type { Bucket, Scrap, SourcePlatform } from '@mobile-types/scrap'

import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type ScrapRow = {
  id: string
  original_url: string
  created_at: string
  opened_at: string | null
  status: Scrap['status']
  source_platform: SourcePlatform
  site_name: string | null
  image_url: string | null
  raw_title: string | null
  raw_description: string | null
  bucket: Bucket
  memo: string
  tags: string[] | null
  starred: boolean
  remind_at: string | null
  archived_at: string | null
  suggested_memo: string | null
}

type CreateQuickScrapInput = {
  originalUrl: string
  bucket: Bucket
  memo: string
  tags: string[]
  remindAt: string | null
}

function detectSourcePlatform(originalUrl: string): SourcePlatform {
  const hostname = new URL(originalUrl).hostname.replace(/^www\./, '')

  if (hostname.includes('instagram.com')) return 'instagram'
  if (hostname.includes('threads.net')) return 'threads'
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter'
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
  return 'web'
}

function getSiteName(originalUrl: string): string {
  return new URL(originalUrl).hostname.replace(/^www\./, '')
}

function rowToScrap(row: ScrapRow): Scrap {
  return {
    id: row.id,
    originalUrl: row.original_url,
    createdAt: row.created_at,
    openedAt: row.opened_at,
    status: row.status,
    sourcePlatform: row.source_platform,
    siteName: row.site_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    rawTitle: row.raw_title ?? undefined,
    rawDescription: row.raw_description ?? undefined,
    bucket: row.bucket,
    memo: row.memo,
    tags: row.tags ?? [],
    starred: row.starred,
    remindAt: row.remind_at,
    archivedAt: row.archived_at,
    suggestedMemo: row.suggested_memo ?? undefined,
  }
}

export async function listScraps(): Promise<Scrap[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('scraps')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as ScrapRow[]).map(rowToScrap)
}

export async function updateScrapMemo(id: string, memo: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('scraps')
    .update({ memo })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function updateScrapStarred(id: string, starred: boolean): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('scraps')
    .update({ starred })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function markScrapOpened(id: string, openedAt: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('scraps')
    .update({ opened_at: openedAt })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function archiveScrap(id: string): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const archivedAt = new Date().toISOString()
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: archivedAt })
    .eq('id', id)

  if (error) {
    throw error
  }
  return archivedAt
}

export async function unarchiveScrap(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: null })
    .eq('id', id)

  if (error) {
    throw error
  }
}

type ScrapEditInput = {
  tags: string[]
  memo: string
  remindAt: string | null
}

export async function updateScrapEdit(id: string, input: ScrapEditInput): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('scraps')
    .update({
      tags: Array.from(new Set(input.tags)),
      memo: input.memo,
      remind_at: input.remindAt,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function createQuickScrap(input: CreateQuickScrapInput): Promise<Scrap> {
  const supabase = getSupabaseBrowserClient()
  const originalUrl = input.originalUrl.trim()
  const sanitizedMemo = input.memo.trim()
  const dedupedTags = Array.from(new Set(input.tags))

  const row = {
    id: crypto.randomUUID(),
    original_url: originalUrl,
    created_at: new Date().toISOString(),
    opened_at: null,
    status: 'done' as const,
    source_platform: detectSourcePlatform(originalUrl),
    site_name: getSiteName(originalUrl),
    image_url: null,
    raw_title: null,
    raw_description: null,
    bucket: input.bucket,
    memo: sanitizedMemo,
    tags: dedupedTags,
    starred: false,
    remind_at: input.remindAt,
    archived_at: null,
    suggested_memo: null,
  }

  const { data, error } = await supabase
    .from('scraps')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return rowToScrap(data as ScrapRow)
}
