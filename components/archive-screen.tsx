import { useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'

import { ScrapCard } from '@/components/scrap-card'
import { bulkRestoreScraps, getArchivedScraps, restoreScrap, updateScrapFields } from '@/lib/storage'
import { Scrap } from '@/types/scrap'

type Props = {
  visible: boolean
  onClose: () => void
}

export function ArchiveScreen({ visible, onClose }: Props) {
  const [scraps, setScraps] = useState<Scrap[]>([])

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Tracks the currently-swiped-open archive card
  const openSwipeableRef = useRef<Swipeable | null>(null)

  function handleSwipeOpen(swipeable: Swipeable) {
    if (openSwipeableRef.current && openSwipeableRef.current !== swipeable) {
      openSwipeableRef.current.close()
    }
    openSwipeableRef.current = swipeable
  }

  function closeOpenSwipeable() {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close()
      openSwipeableRef.current = null
    }
  }

  function handleShouldCaptureTouch(): boolean {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close()
      openSwipeableRef.current = null
      return true
    }
    return false
  }

  useEffect(() => {
    if (visible) {
      load()
      exitSelectMode()
    }
  }, [visible])

  async function load() {
    const data = await getArchivedScraps()
    setScraps(data)
  }

  async function handleRestore(id: string) {
    await restoreScrap(id)
    setScraps((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleToggleStar(id: string) {
    const scrap = scraps.find((s) => s.id === id)
    if (!scrap) return
    await updateScrapFields(id, { starred: !scrap.starred })
    await load()
  }

  // ─── Multi-select ─────────────────────────────────────────────────────────

  function enterSelectMode(id: string) {
    setSelectMode(true)
    setSelectedIds(new Set([id]))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  async function handleBulkRestore() {
    const ids = Array.from(selectedIds)
    setScraps((prev) => prev.filter((s) => !selectedIds.has(s.id)))
    exitSelectMode()
    await bulkRestoreScraps(ids)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {selectMode ? `${selectedIds.size}개 선택됨` : '보관함'}
          </Text>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={selectMode ? exitSelectMode : onClose}
            activeOpacity={0.6}
            hitSlop={8}
          >
            <Text style={selectMode ? styles.selectCancel : styles.back}>
              {selectMode ? '취소' : '닫기'}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={scraps}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            selectMode ? (
              <SelectableArchiveItem
                scrap={item}
                selected={selectedIds.has(item.id)}
                onToggle={() => toggleSelect(item.id)}
              />
            ) : (
              <ArchiveCard
                scrap={item}
                onRestore={handleRestore}
                onToggleStar={handleToggleStar}
                onLongPress={() => enterSelectMode(item.id)}
                onSwipeOpen={handleSwipeOpen}
                onShouldCaptureTouch={handleShouldCaptureTouch}
              />
            )
          }
          contentContainerStyle={[styles.list, selectMode && styles.listSelectMode]}
          onScrollBeginDrag={closeOpenSwipeable}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>보관된 카드가 없습니다.</Text>
            </View>
          }
        />

        {/* Select mode action bar */}
        {selectMode && (
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.restoreBtn, selectedIds.size === 0 && styles.restoreBtnDisabled]}
              onPress={handleBulkRestore}
              disabled={selectedIds.size === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.restoreBtnText}>복구 {selectedIds.size}개</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}

// ─── Selectable item (multi-select mode) ──────────────────────────────────────

function SelectableArchiveItem({
  scrap,
  selected,
  onToggle,
}: {
  scrap: Scrap
  selected: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.selectableRow}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={[styles.selectCircle, selected && styles.selectCircleFilled]}>
        {selected && <Text style={styles.checkText}>✓</Text>}
      </View>
      <View style={styles.selectCardWrap} pointerEvents="none">
        <ScrapCard scrap={scrap} onToggleStar={() => {}} />
      </View>
    </TouchableOpacity>
  )
}

// ─── Archive Card (with restore swipe) ───────────────────────────────────────

function ArchiveCard({
  scrap,
  onRestore,
  onToggleStar,
  onLongPress,
  onSwipeOpen,
  onShouldCaptureTouch,
}: {
  scrap: Scrap
  onRestore: (id: string) => void
  onToggleStar: (id: string) => void
  onLongPress: () => void
  onSwipeOpen: (swipeable: Swipeable) => void
  onShouldCaptureTouch: () => boolean
}) {
  const ref = useRef<Swipeable>(null)

  function renderRightActions() {
    return (
      <TouchableOpacity
        style={styles.restoreAction}
        onPress={() => { ref.current?.close(); onRestore(scrap.id) }}
        activeOpacity={0.8}
      >
        <Text style={styles.restoreText}>복원</Text>
      </TouchableOpacity>
    )
  }

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (ref.current) onSwipeOpen(ref.current)
      }}
    >
      <View onStartShouldSetResponderCapture={onShouldCaptureTouch}>
        <ScrapCard scrap={scrap} onToggleStar={onToggleStar} onLongPress={onLongPress} />
      </View>
    </Swipeable>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  headerLeft: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  back: { fontSize: 16, color: '#555', fontWeight: '500' },
  selectCancel: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },

  list: { paddingTop: 8, paddingBottom: 60 },
  listSelectMode: { paddingBottom: 100 },
  empty: { marginTop: 80, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#999' },

  // Swipe action
  restoreAction: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  restoreText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Selectable item
  selectableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  selectCircleFilled: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectCardWrap: {
    flex: 1,
  },

  // Bottom action bar (select mode)
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E8E8E8',
  },
  restoreBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#3B82F6',
  },
  restoreBtnDisabled: { opacity: 0.4 },
  restoreBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
})
