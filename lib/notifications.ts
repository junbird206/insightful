import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { getDailyReminderConfig, type DailyReminderConfig } from './daily-reminder'

// ─── Configuration ───────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// ─── Permission ──────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true

  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

// ─── Schedule / Cancel ───────────────────────────────────────────────────────

/**
 * Schedule a local notification for a scrap's remindAt.
 * Uses the scrap ID as the notification identifier so we can cancel it later.
 */
export async function scheduleReminder(
  scrapId: string,
  remindAt: string,
  title?: string,
): Promise<void> {
  const triggerDate = new Date(remindAt)
  if (triggerDate.getTime() <= Date.now()) return // past — skip

  // Cancel any existing notification for this scrap first
  await cancelReminder(scrapId)

  await Notifications.scheduleNotificationAsync({
    identifier: scrapId,
    content: {
      title: title ?? '리마인드',
      body: '저장한 콘텐츠를 확인할 시간이에요!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  })
}

/**
 * Cancel a previously scheduled notification for a scrap.
 */
export async function cancelReminder(scrapId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(scrapId)
  } catch {
    // Notification may not exist — safe to ignore
  }
}

/**
 * Cancel notifications for multiple scraps.
 */
export async function cancelReminders(scrapIds: string[]): Promise<void> {
  await Promise.all(scrapIds.map(cancelReminder))
}

type SyncScrap = {
  id: string
  remindAt: string | null
  createdAt: string
  openedAt: string | null
}

const RECAP_DAYS = [3, 7] as const
const RECAP_HOUR = 18

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Reconcile all local scheduled notifications with the given scrap list.
 * Cancels everything currently scheduled, then re-schedules:
 *   1) per-scrap remindAt notifications (user-set reminders)
 *   2) aggregate "unopened recap" notifications fired at 18:00 on the day
 *      that any unopened scrap crosses its 3-day or 7-day mark from createdAt.
 *      Multiple scraps reaching a milestone on the same day are merged into
 *      one notification with the total count.
 * Call on app foreground so changes from the web client get picked up.
 */
export async function syncScheduledReminders(
  scraps: SyncScrap[],
  nickname?: string | null,
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch {
    // best-effort
  }

  for (const scrap of scraps) {
    if (!scrap.remindAt) continue
    const trigger = new Date(scrap.remindAt)
    if (Number.isNaN(trigger.getTime()) || trigger.getTime() <= Date.now()) continue
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: scrap.id,
        content: {
          title: '리마인드',
          body: '저장한 콘텐츠를 확인할 시간이에요!',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      })
    } catch {
      // best-effort; continue with the rest
    }
  }

  await scheduleUnopenedRecaps(scraps, nickname)
  await scheduleDailyDigest(scraps, nickname)
}

/**
 * Re-run the full schedule pipeline using freshly fetched scraps + the
 * given nickname. Call after user-facing changes (daily reminder toggled,
 * nickname updated, etc.) so the next-day notification reflects them.
 */
export async function refreshAllSchedules(nickname?: string | null): Promise<void> {
  try {
    const { getAllScraps } = await import('./storage')
    const scraps = await getAllScraps()
    await syncScheduledReminders(scraps, nickname)
  } catch {
    // best-effort
  }
}

const DAILY_DIGEST_ID = 'daily-digest'

/**
 * Schedule the daily digest: once a day at the user-configured time, deliver
 *   "{nickname}님! 아직 회수하지 않은 N개의 지식이 있어요"
 * where N = unopened scraps in the current (non-archived) list.
 *
 * Notes / MVP limits:
 *  - The body string is baked in at schedule time. If the user opens cards
 *    later, the next time the app reaches foreground we re-run this to
 *    refresh the body. Between app launches the OS holds the old body.
 *  - If N === 0 we skip scheduling for the day (no "0개" notification).
 *  - DAILY trigger fires forever at the same hour:minute until cancelled.
 */
async function scheduleDailyDigest(
  scraps: SyncScrap[],
  nickname?: string | null,
): Promise<void> {
  let config: DailyReminderConfig
  try {
    config = await getDailyReminderConfig()
  } catch {
    return
  }
  if (!config.enabled) return

  const unopened = scraps.filter((s) => !s.openedAt).length
  if (unopened <= 0) return

  const greeting = nickname ? `${nickname}님! ` : ''
  const body = `${greeting}아직 회수하지 않은 ${unopened}개의 지식이 있어요`

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_DIGEST_ID,
      content: {
        title: '오늘의 인사이트',
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: config.hour,
        minute: config.minute,
      },
    })
  } catch {
    // best-effort
  }
}

async function scheduleUnopenedRecaps(
  scraps: SyncScrap[],
  nickname?: string | null,
): Promise<void> {
  const now = Date.now()
  const buckets = new Map<string, { date: Date; count: number }>()

  for (const scrap of scraps) {
    if (scrap.openedAt) continue
    const created = new Date(scrap.createdAt)
    if (Number.isNaN(created.getTime())) continue

    for (const days of RECAP_DAYS) {
      const trigger = new Date(created)
      trigger.setDate(trigger.getDate() + days)
      trigger.setHours(RECAP_HOUR, 0, 0, 0)
      if (trigger.getTime() <= now) continue

      const key = `${trigger.getFullYear()}-${pad(trigger.getMonth() + 1)}-${pad(trigger.getDate())}`
      const entry = buckets.get(key)
      if (entry) {
        entry.count += 1
      } else {
        buckets.set(key, { date: trigger, count: 1 })
      }
    }
  }

  const greeting = nickname ? `${nickname}님, ` : ''

  for (const [key, { date, count }] of buckets) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `unopened-recap-${key}`,
        content: {
          title: '미열람 인사이트',
          body: `${greeting}저장하고 회수하지 않은 인사이트 ${count}개가 있어요`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      })
    } catch {
      // best-effort
    }
  }
}
