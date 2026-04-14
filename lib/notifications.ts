import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

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
