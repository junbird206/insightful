import AsyncStorage from '@react-native-async-storage/async-storage'

export type DailyReminderConfig = {
  enabled: boolean
  hour: number   // 0–23
  minute: number // 0–59
}

const STORAGE_KEY = 'daily_reminder_config_v1'

export const DEFAULT_DAILY_REMINDER: DailyReminderConfig = {
  enabled: true,
  hour: 9,
  minute: 0,
}

export async function getDailyReminderConfig(): Promise<DailyReminderConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DAILY_REMINDER
    const parsed = JSON.parse(raw) as Partial<DailyReminderConfig>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_DAILY_REMINDER.enabled,
      hour: clampInt(parsed.hour, 0, 23, DEFAULT_DAILY_REMINDER.hour),
      minute: clampInt(parsed.minute, 0, 59, DEFAULT_DAILY_REMINDER.minute),
    }
  } catch {
    return DEFAULT_DAILY_REMINDER
  }
}

export async function saveDailyReminderConfig(config: DailyReminderConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // best-effort
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const i = Math.round(value)
  if (i < min) return min
  if (i > max) return max
  return i
}
