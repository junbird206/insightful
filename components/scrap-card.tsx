import { Bucket, Scrap } from '@/types/scrap'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { updateScrapFields } from '@/lib/storage'

type Props = {
  scrap: Scrap
  onToggleStar: (id: string) => void
  onLongPress?: () => void
}

export function ScrapCard({ scrap, onToggleStar, onLongPress }: Props) {
  const isRead = scrap.openedAt != null

  async function handlePress() {
    await Linking.openURL(scrap.originalUrl)
    if (!isRead) {
      await updateScrapFields(scrap.id, { openedAt: new Date().toISOString() })
    }
  }

  return (
    <TouchableOpacity
      style={[styles.card, isRead && styles.cardRead]}
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      <CardHeader scrap={scrap} onToggleStar={onToggleStar} isRead={isRead} />
      <CardBody scrap={scrap} isRead={isRead} />
      {scrap.tags.length > 0 && (
        <View style={styles.tagRow}>
          {scrap.tags.map((tag) => (
            <View key={tag} style={[styles.tagChip, isRead && styles.tagChipRead]}>
              <Text style={[styles.tagChipText, isRead && styles.tagChipTextRead]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {scrap.remindAt && <RemindLabel remindAt={scrap.remindAt} />}
    </TouchableOpacity>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function CardHeader({
  scrap,
  onToggleStar,
  isRead,
}: {
  scrap: Scrap
  onToggleStar: (id: string) => void
  isRead: boolean
}) {
  const platformLabel = PLATFORM_LABELS[scrap.sourcePlatform] ?? scrap.siteName ?? ''

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {platformLabel ? (
          <Text style={[styles.sourceName, isRead && styles.sourceNameRead]}>{platformLabel}</Text>
        ) : null}
        {scrap.status === 'processing' && (
          <Text style={styles.badgeProcessing}>처리 중...</Text>
        )}
        {scrap.status === 'failed' && (
          <Text style={styles.badgeFailed}>실패</Text>
        )}
        {scrap.status === 'done' && <BucketBadge bucket={scrap.bucket} />}
      </View>

      <TouchableOpacity
        onPress={() => onToggleStar(scrap.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Text style={[styles.starIcon, scrap.starred && styles.starIconFilled]}>
          {scrap.starred ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function BucketBadge({ bucket }: { bucket: Bucket }) {
  const config = BUCKET_BADGE[bucket]
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function CardBody({ scrap, isRead }: { scrap: Scrap; isRead: boolean }) {
  if (scrap.status === 'processing') {
    return <Text style={styles.urlFallback} numberOfLines={1}>{scrap.originalUrl}</Text>
  }

  if (scrap.status === 'failed') {
    return (
      <>
        <Text style={styles.urlFallback} numberOfLines={1}>{scrap.originalUrl}</Text>
        <Text style={styles.failedNote}>분석 실패 · 탭하여 원본 열기</Text>
      </>
    )
  }

  const displayMemo = scrap.memo || scrap.suggestedMemo
  if (displayMemo) {
    return <Text style={[styles.memo, isRead && styles.memoRead]}>{displayMemo}</Text>
  }

  return <Text style={styles.urlFallback} numberOfLines={1}>{scrap.originalUrl}</Text>
}

// ─── Remind ──────────────────────────────────────────────────────────────────

function RemindLabel({ remindAt }: { remindAt: string }) {
  const date = new Date(remindAt)
  const now = new Date()
  const isPast = date <= now

  const label = formatRemindDate(date, now)

  return (
    <View style={styles.remindRow}>
      <Text style={[styles.remindText, isPast && styles.remindTextPast]}>
        🔔 {label}
      </Text>
    </View>
  )
}

function formatRemindDate(date: Date, now: Date): string {
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const h = date.getHours()
  const m = date.getMinutes()
  const period = h < 12 ? '오전' : '오후'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const time = m === 0 ? `${period} ${hour12}시` : `${period} ${hour12}:${String(m).padStart(2, '0')}`

  if (date <= now) return `리마인드 지남`
  if (isToday) return `오늘 ${time}`
  if (isTomorrow) return `내일 ${time}`

  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${month}/${day}(${weekday}) ${time}`
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  web: '',
  unknown: '',
}

const BUCKET_BADGE: Record<Bucket, { label: string; bg: string; color: string }> = {
  read: { label: 'To Read', bg: '#EEF4FF', color: '#3B82F6' },
  do:   { label: 'To Do',   bg: '#FFF7ED', color: '#EA580C' },
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 8,
  },
  cardRead: {
    backgroundColor: '#F3F3F3',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sourceName: { fontSize: 11, color: '#AAAAAA', fontWeight: '500' },
  sourceNameRead: { color: '#BDBDBD' },
  badgeProcessing: { fontSize: 10, color: '#D4A574', fontWeight: '600' },
  badgeFailed: { fontSize: 10, color: '#DC2626', fontWeight: '600' },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  starIcon: { fontSize: 18, color: '#DDDDDD' },
  starIconFilled: { color: '#FBBF24' },

  memo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  memoRead: { color: '#7A7A7A' },
  urlFallback: { fontSize: 12, color: '#CCCCCC' },
  failedNote: { fontSize: 11, color: '#DC2626', marginTop: 2 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagChipRead: { backgroundColor: '#EAEAEA' },
  tagChipText: { fontSize: 11, fontWeight: '500', color: '#888888' },
  tagChipTextRead: { color: '#A8A8A8' },

  remindRow: { flexDirection: 'row', alignItems: 'center' },
  remindText: { fontSize: 11, color: '#999999', fontWeight: '500' },
  remindTextPast: { color: '#CCCCCC' },
})
