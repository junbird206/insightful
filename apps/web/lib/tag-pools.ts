import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const DEFAULT_TAGS = ['AI활용', '학교생활', '주식', '운동', '콘텐츠아이디어', '자기계발']

export async function listTagPool(): Promise<string[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('tag_pools')
    .select('tags')
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (!data) {
    const { error: upsertError } = await supabase.from('tag_pools').upsert({ tags: DEFAULT_TAGS })
    if (upsertError) {
      throw upsertError
    }
    return DEFAULT_TAGS
  }

  return (data.tags as string[]) ?? DEFAULT_TAGS
}

export async function addTagToPool(tag: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient()
  const pool = await listTagPool()
  if (pool.includes(tag)) return pool

  const updated = [...pool, tag]
  const { error } = await supabase.from('tag_pools').upsert({ tags: updated })
  if (error) {
    throw error
  }
  return updated
}
