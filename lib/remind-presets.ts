import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from './supabase'

export type RemindPresetConfig = {
  id: string
  label: string
  dayOffset: number // 0 = today, 1 = tomorrow
  hour: number      // 0–23
  minute: number    // 0–59
}

const CACHE_KEY = 'remind_presets_cache'

const DEFAULT_PRESETS: RemindPresetConfig[] = [
  { id: '1', label: '오늘 저녁', dayOffset: 0, hour: 18, minute: 0 },
  { id: '2', label: '내일 아침', dayOffset: 1, hour: 8, minute: 0 },
]

async function readCache(): Promise<RemindPresetConfig[] | null> {
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY)
    if (!json) return null
    return JSON.parse(json) as RemindPresetConfig[]
  } catch {
    return null
  }
}

async function writeCache(presets: RemindPresetConfig[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(presets))
  } catch {
    // best-effort
  }
}

export async function getRemindPresets(): Promise<RemindPresetConfig[]> {
  const { data: userResp } = await supabase.auth.getUser()
  if (!userResp?.user) {
    const cached = await readCache()
    return cached ?? DEFAULT_PRESETS
  }

  const { data, error } = await supabase
    .from('remind_presets')
    .select('presets')
    .maybeSingle()

  if (error) {
    const cached = await readCache()
    return cached ?? DEFAULT_PRESETS
  }

  if (!data) {
    // 시드 실패는 무해. 다음에 saveRemindPresets()가 호출될 때 다시 시도된다.
    try {
      await supabase
        .from('remind_presets')
        .upsert(
          { user_id: userResp.user.id, presets: DEFAULT_PRESETS },
          { onConflict: 'user_id' },
        )
    } catch {
      // best-effort
    }
    await writeCache(DEFAULT_PRESETS)
    return DEFAULT_PRESETS
  }

  const presets = (data.presets as RemindPresetConfig[]) ?? DEFAULT_PRESETS
  await writeCache(presets)
  return presets
}

export async function saveRemindPresets(presets: RemindPresetConfig[]): Promise<void> {
  await writeCache(presets)

  // user_id를 DEFAULT auth.uid()에 맡기지 않고 명시적으로 포함시킨다.
  // PostgREST가 onConflict 컬럼이 body에 없을 때 INSERT 경로에서 NULL을 넣는
  // 케이스가 있어, 명시적으로 채우는 게 안전하다.
  const { data: userResp } = await supabase.auth.getUser()
  const userId = userResp?.user?.id
  if (!userId) {
    throw new Error('not authenticated')
  }

  const { error } = await supabase
    .from('remind_presets')
    .upsert({ user_id: userId, presets }, { onConflict: 'user_id' })

  if (error) {
    // 실패 원인을 파악할 수 있도록 raw 에러를 dev 콘솔에 그대로 남긴다.
    console.warn('[remind_presets] upsert failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    throw error
  }
}

export function computeRemindDate(preset: RemindPresetConfig): Date {
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() + preset.dayOffset)
  d.setHours(preset.hour, preset.minute, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}
