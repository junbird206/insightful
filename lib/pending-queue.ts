import { NativeModules, Platform } from 'react-native'

/**
 * Item shape written by the iOS Share Extension into App Groups UserDefaults
 * under `group.com.juny.insightful` / `pendingScraps`.
 *
 * All values are strings because iOS UserDefaults round-trips plist-compatible
 * types and the extension writes everything as `[String: String]`. Tags are
 * serialized as JSON in `tagsJson` since arrays aren't allowed in `[String: String]`.
 */
export type PendingScrap = {
  url: string
  bucket: string        // 'read' | 'do'
  memo: string
  remindAt: string      // ISO8601 or '' when none
  createdAt: string     // ISO8601
  tagsJson?: string     // JSON-stringified string[] (optional)
}

type PendingQueueModule = {
  getPending(): Promise<PendingScrap[]>
  clearPending(): Promise<null>
  setTagPool(tags: string[]): Promise<null>
}

const pendingQueueNative = (NativeModules as { InsightfulPendingQueue?: PendingQueueModule })
  .InsightfulPendingQueue

export async function getPendingScraps(): Promise<PendingScrap[]> {
  if (Platform.OS !== 'ios' || !pendingQueueNative) return []
  try {
    const items = await pendingQueueNative.getPending()
    return Array.isArray(items) ? items : []
  } catch (err) {
    console.warn('[pending-queue] getPending failed', err)
    return []
  }
}

export async function clearPendingScraps(): Promise<void> {
  if (Platform.OS !== 'ios' || !pendingQueueNative) return
  try {
    await pendingQueueNative.clearPending()
  } catch (err) {
    console.warn('[pending-queue] clearPending failed', err)
  }
}

/**
 * Mirror the tag pool to App Groups UserDefaults so the Share Extension can
 * render the chip bar. No-op on non-iOS.
 */
export async function syncTagPoolToExtension(tags: string[]): Promise<void> {
  if (Platform.OS !== 'ios' || !pendingQueueNative) return
  try {
    await pendingQueueNative.setTagPool(tags)
  } catch (err) {
    console.warn('[pending-queue] setTagPool failed', err)
  }
}
