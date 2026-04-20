import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Animated, FlatList, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ArchiveScreen } from '@/components/archive-screen'
import { EditScrapSheet } from '@/components/edit-scrap-sheet'
import { MyPage } from '@/components/my-page'
import { ScrapCard } from '@/components/scrap-card'
import { SideMenu } from '@/components/side-menu'
import { UndoToast } from '@/components/undo-toast'
import { archiveScrap, bulkArchiveScraps, bulkDeleteScraps, deleteScrap, getAllScraps, updateScrapFields } from '@/lib/storage'
import { addTagToPool, getTagPool } from '@/lib/tag-pool'
import { Bucket, Scrap } from '@/types/scrap'

type UndoState = {
  scrapData: Scrap[]
  timerId: ReturnType<typeof setTimeout>
} | null

type FeedFilter = 'recent' | Bucket

type Props = {
  filter: FeedFilter
}

const EMPTY: Record<FeedFilter, string> = {
  recent: '저장된 항목이 없습니다.',
  read:   'To Read 항목이 없습니다.',
  do:     'To Do 항목이 없습니다.',
}

export function FeedScreen({ filter }: Props) {
  const [scraps, setScraps] = useState<Scrap[]>([])
  const [starredOnly, setStarredOnly] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [myPageOpen, setMyPageOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [undo, setUndo] = useState<UndoState>(null)
  const [archiveToast, setArchiveToast] = useState(false)
  const archiveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Tag filter
  const [tagPool, setTagPool] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagSheetOpen, setTagSheetOpen] = useState(false)

  // Search
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<TextInput>(null)
  const [searchPeriod, setSearchPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [searchBucket, setSearchBucket] = useState<'all' | 'read' | 'do'>('all')
  const [searchTags, setSearchTags] = useState<string[]>([])
  const [searchSource, setSearchSource] = useState<string>('all')

  // Edit sheet
  const [editing, setEditing] = useState<Scrap | null>(null)

  // Tracks the currently-swiped-open card so any other interaction
  // (swiping another card, scrolling, tapping any card) closes it.
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

  // Captures taps on any card while a swipe is open: closes the swipe and
  // swallows the tap so the card's onPress (open URL) doesn't fire — matches
  // the iOS Mail "tap to dismiss swipe" affordance.
  function handleShouldCaptureTouch(): boolean {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close()
      openSwipeableRef.current = null
      return true
    }
    return false
  }

  async function loadScraps() {
    const data = await getAllScraps()
    setScraps(data)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadScraps()
    setRefreshing(false)
  }

  // ─── Single delete ──────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const scrap = scraps.find((s) => s.id === id)
    if (!scrap) return

    if (undo?.timerId) {
      clearTimeout(undo.timerId)
      await bulkDeleteScraps(undo.scrapData.map((s) => s.id))
    }

    const timerId = setTimeout(async () => {
      await deleteScrap(id)
      setUndo(null)
    }, 4000)

    setUndo({ scrapData: [scrap], timerId })
    setScraps((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleUndo() {
    if (!undo?.timerId) return
    clearTimeout(undo.timerId)
    setScraps((prev) => [...undo.scrapData, ...prev])
    setUndo(null)
  }

  // ─── Single archive ─────────────────────────────────────────────────────────

  async function handleArchive(id: string) {
    setScraps((prev) => prev.filter((s) => s.id !== id))
    await archiveScrap(id)
    showArchiveToast()
  }

  function showArchiveToast() {
    if (archiveToastTimer.current) clearTimeout(archiveToastTimer.current)
    setArchiveToast(true)
    archiveToastTimer.current = setTimeout(() => setArchiveToast(false), 2500)
  }

  async function handleToggleStar(id: string) {
    const scrap = scraps.find((s) => s.id === id)
    if (!scrap) return
    await updateScrapFields(id, { starred: !scrap.starred })
    await loadScraps()
  }

  // ─── Multi-select ───────────────────────────────────────────────────────────

  function enterSelectMode() {
    setSelectMode(true)
    setSelectedIds(new Set())
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

  async function handleBulkArchive() {
    const ids = Array.from(selectedIds)
    setScraps((prev) => prev.filter((s) => !selectedIds.has(s.id)))
    exitSelectMode()
    await bulkArchiveScraps(ids)
    showArchiveToast()
  }

  function handleBulkDelete() {
    const count = selectedIds.size
    if (count === 0) return
    Alert.alert(
      `${count}개 카드 삭제`,
      `선택한 ${count}개의 카드를 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const ids = Array.from(selectedIds)
            const deletedScraps = scraps.filter((s) => selectedIds.has(s.id))

            if (undo?.timerId) {
              clearTimeout(undo.timerId)
              await bulkDeleteScraps(undo.scrapData.map((s) => s.id))
            }

            const timerId = setTimeout(async () => {
              await bulkDeleteScraps(ids)
              setUndo(null)
            }, 4000)

            setUndo({ scrapData: deletedScraps, timerId })
            setScraps((prev) => prev.filter((s) => !selectedIds.has(s.id)))
            exitSelectMode()
          },
        },
      ],
    )
  }

  // ─── Effects ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadScraps()
      getTagPool().then(setTagPool)
    }, []),
  )

  const hasProcessing = scraps.some((s) => s.status === 'processing')
  useEffect(() => {
    if (!hasProcessing) return
    const interval = setInterval(loadScraps, 1000)
    return () => clearInterval(interval)
  }, [hasProcessing])

  useEffect(() => {
    return () => {
      if (undo?.timerId) clearTimeout(undo.timerId)
    }
  }, [undo])

  useEffect(() => {
    return () => {
      if (archiveToastTimer.current) clearTimeout(archiveToastTimer.current)
    }
  }, [])

  function toggleTagFilter(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function enterSearchMode() {
    setSearchMode(true)
    setSearchQuery('')
    setSearchPeriod('all')
    setSearchBucket('all')
    setSearchTags([])
    setSearchSource('all')
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  function exitSearchMode() {
    setSearchMode(false)
    setSearchQuery('')
    setSearchPeriod('all')
    setSearchBucket('all')
    setSearchTags([])
    setSearchSource('all')
  }

  function toggleSearchTag(tag: string) {
    setSearchTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  let displayed = filter === 'recent'
    ? scraps
    : scraps.filter((s) => s.bucket === filter)

  if (searchMode) {
    // Text search: title + memo only, minimum 2 chars
    const q = searchQuery.trim().toLowerCase()
    if (q.length >= 2) {
      displayed = displayed.filter((s) => {
        const title = s.rawTitle?.toLowerCase() ?? ''
        const memo = s.memo?.toLowerCase() ?? ''
        return title.includes(q) || memo.includes(q)
      })
    }
    // Filter: bucket
    if (searchBucket !== 'all') {
      displayed = displayed.filter((s) => s.bucket === searchBucket)
    }
    // Filter: period
    if (searchPeriod !== 'all') {
      const now = new Date()
      let cutoff: Date
      if (searchPeriod === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (searchPeriod === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
      displayed = displayed.filter((s) => new Date(s.createdAt) >= cutoff)
    }
    // Filter: source platform
    if (searchSource !== 'all') {
      displayed = displayed.filter((s) => s.sourcePlatform === searchSource)
    }
    // Filter: tags (intersection)
    if (searchTags.length > 0) {
      displayed = displayed.filter((s) =>
        searchTags.every((tag) => s.tags?.includes(tag)),
      )
    }
  } else {
    if (starredOnly) {
      displayed = displayed.filter((s) => s.starred)
    }
    if (selectedTags.length > 0) {
      displayed = displayed.filter((s) =>
        selectedTags.every((tag) => s.tags?.includes(tag)),
      )
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Title row */}
      <View style={styles.titleRow}>
        {searchMode ? (
          <>
            <TouchableOpacity
              onPress={exitSearchMode}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchBackText}>←</Text>
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="제목, 메모, 태그, URL 검색..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.6}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </>
        ) : selectMode ? (
          <>
            <Text style={styles.selectTitle}>{selectedIds.size}개 선택됨</Text>
            <TouchableOpacity onPress={exitSelectMode} activeOpacity={0.7}>
              <Text style={styles.selectCancel}>취소</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.7}>
              <Image
                source={require('@/assets/images/logo-wordmark.png')}
                style={styles.appLogo}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.titleRight}>
              <TouchableOpacity
                onPress={() => setStarredOnly((v) => !v)}
                activeOpacity={0.5}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={[styles.actionText, starredOnly && styles.actionTextActive]}>
                  ★ 중요만
                </Text>
              </TouchableOpacity>
              <Text style={styles.actionDivider}>|</Text>
              <TouchableOpacity
                onPress={enterSelectMode}
                activeOpacity={0.5}
                disabled={displayed.length === 0}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={[styles.actionText, displayed.length === 0 && styles.actionTextDisabled]}>
                  선택
                </Text>
              </TouchableOpacity>
              <Text style={styles.actionDivider}>|</Text>
              <TouchableOpacity
                onPress={() => setArchiveOpen(true)}
                activeOpacity={0.5}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.actionText}>보관함</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={enterSearchMode}
                activeOpacity={0.6}
                style={styles.searchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.searchBtnText}>🔍</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Search filter bar */}
      {searchMode && (
        <View style={styles.searchFilterWrap}>
          {/* Row 1: Period + Bucket */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchFilterRow}>
            {([['all', '전체'], ['today', '오늘'], ['week', '이번 주'], ['month', '이번 달']] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, searchPeriod === key && styles.filterChipActive]}
                onPress={() => setSearchPeriod(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, searchPeriod === key && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.filterDivider} />
            {([['all', '전체'], ['read', 'To Read'], ['do', 'To Do']] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, searchBucket === key && styles.filterChipActive]}
                onPress={() => setSearchBucket(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, searchBucket === key && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Row 2: Source + Tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchFilterRow}>
            {([['all', '모든 출처'], ['instagram', 'Instagram'], ['twitter', 'Twitter'], ['youtube', 'YouTube'], ['web', 'Web']] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, searchSource === key && styles.filterChipActive]}
                onPress={() => setSearchSource(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, searchSource === key && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            {tagPool.length > 0 && (
              <>
                <View style={styles.filterDivider} />
                {tagPool.map((tag) => {
                  const active = searchTags.includes(tag)
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => toggleSearchTag(tag)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Tag filter bar — hidden during search */}
      {!searchMode && tagPool.length > 0 && (
        <View style={styles.tagBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagBarScroll}
          >
            {tagPool.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                  onPress={() => toggleTagFilter(tag)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.tagChipText, active && styles.tagChipTextActive]}
                    numberOfLines={1}
                  >
                    #{tag}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          {/* Overlay: `...` button floating above scroll */}
          <View style={styles.tagMoreOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.tagMoreBtn}
              onPress={() => setTagSheetOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.tagMoreText}>...</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          selectMode ? (
            <SelectableItem
              scrap={item}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleSelect(item.id)}
            />
          ) : (
            <SwipeableCard
              scrap={item}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onToggleStar={handleToggleStar}
              onLongPress={() => setEditing(item)}
              onSwipeOpen={handleSwipeOpen}
              onShouldCaptureTouch={handleShouldCaptureTouch}
            />
          )
        }
        contentContainerStyle={styles.list}
        onScrollBeginDrag={closeOpenSwipeable}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#999999" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {starredOnly ? '★ 표시한 항목이 없습니다.' : EMPTY[filter]}
            </Text>
          </View>
        }
      />

      {/* FAB — hidden in select mode */}
      {!selectMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(tabs)/add')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Select mode action bar */}
      {selectMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnArchive, selectedIds.size === 0 && styles.actionBtnDisabled]}
            onPress={handleBulkArchive}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnArchiveText]}>
              보관 {selectedIds.size}개
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete, selectedIds.size === 0 && styles.actionBtnDisabled]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDeleteText]}>
              삭제 {selectedIds.size}개
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Archive toast */}
      <ArchiveToast visible={archiveToast} />

      {/* Undo Toast */}
      <UndoToast
        visible={undo != null}
        onUndo={handleUndo}
        count={undo?.scrapData.length}
      />

      {/* Side Menu */}
      <SideMenu
        visible={menuOpen}
        scrapCount={scraps.length}
        onClose={() => setMenuOpen(false)}
        onMyPage={() => { setMenuOpen(false); setMyPageOpen(true) }}
      />

      {/* My Page */}
      <MyPage visible={myPageOpen} scrapCount={scraps.length} onClose={() => setMyPageOpen(false)} />

      {/* Archive Screen */}
      <ArchiveScreen visible={archiveOpen} onClose={() => setArchiveOpen(false)} />

      {/* Edit Sheet */}
      <EditScrapSheet
        scrap={editing}
        onClose={() => setEditing(null)}
        onSaved={loadScraps}
      />

      {/* Tag sheet (full tag list) */}
      <Modal
        visible={tagSheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTagSheetOpen(false)}
      >
        <SafeAreaView style={styles.tagSheetContainer} edges={['top', 'bottom']}>
          <View style={styles.tagSheetHeader}>
            <Text style={styles.tagSheetTitle}>태그 필터</Text>
            <TouchableOpacity onPress={() => setTagSheetOpen(false)} activeOpacity={0.6}>
              <Text style={styles.tagSheetClose}>완료</Text>
            </TouchableOpacity>
          </View>
          {selectedTags.length > 0 && (
            <TouchableOpacity
              style={styles.tagSheetClearBtn}
              onPress={() => { setSelectedTags([]); setTagSheetOpen(false) }}
              activeOpacity={0.7}
            >
              <Text style={styles.tagSheetClearText}>필터 초기화</Text>
            </TouchableOpacity>
          )}
          <View style={styles.tagSheetGrid}>
            {tagPool.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagSheetChip, active && styles.tagSheetChipActive]}
                  onPress={() => toggleTagFilter(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagSheetChipText, active && styles.tagSheetChipTextActive]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity
              style={styles.tagSheetAddBtn}
              onPress={() => {
                Alert.prompt('새 태그 추가', '태그 이름을 입력하세요', async (text) => {
                  const trimmed = text?.trim()
                  if (!trimmed) return
                  const updated = await addTagToPool(trimmed)
                  setTagPool(updated)
                })
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.tagSheetAddText}>+</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Archive toast ────────────────────────────────────────────────────────────

function ArchiveToast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[styles.archiveToastWrap, { opacity }]} pointerEvents="none">
      <View style={styles.archiveToast}>
        <Text style={styles.archiveToastText}>보관함으로 이동됨</Text>
      </View>
    </Animated.View>
  )
}

// ─── Selectable item (multi-select mode) ──────────────────────────────────────

function SelectableItem({
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

// ─── Swipeable wrapper ────────────────────────────────────────────────────────

type SwipeableCardProps = {
  scrap: Scrap
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onToggleStar: (id: string) => void
  onLongPress: () => void
  onSwipeOpen: (swipeable: Swipeable) => void
  onShouldCaptureTouch: () => boolean
}

function SwipeableCard({
  scrap,
  onDelete,
  onArchive,
  onToggleStar,
  onLongPress,
  onSwipeOpen,
  onShouldCaptureTouch,
}: SwipeableCardProps) {
  const ref = useRef<Swipeable>(null)

  function renderRightActions() {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => { ref.current?.close(); onDelete(scrap.id) }}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteText}>삭제</Text>
      </TouchableOpacity>
    )
  }

  function renderLeftActions() {
    return (
      <TouchableOpacity
        style={styles.archiveAction}
        onPress={() => { ref.current?.close(); onArchive(scrap.id) }}
        activeOpacity={0.8}
      >
        <Text style={styles.archiveActionText}>보관</Text>
      </TouchableOpacity>
    )
  }

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={60}
      leftThreshold={60}
      overshootRight={false}
      overshootLeft={false}
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  appTitle: { fontSize: 28, fontWeight: '700', color: '#111111', letterSpacing: -0.5 },
  appLogo: { height: 30, width: 30 * (883 / 327) },
  titleRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  selectTitle: { fontSize: 17, fontWeight: '700', color: '#111111' },
  selectCancel: { fontSize: 15, fontWeight: '600', color: '#3B82F6' },

  // Action bar — text-only controls (no pill background)
  actionText: { fontSize: 13, fontWeight: '600', color: '#AAAAAA' },
  actionTextActive: { color: '#D97706' },
  actionTextDisabled: { color: '#D5D5D5' },
  actionDivider: { fontSize: 12, color: '#DDDDDD' },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  searchBtnText: { fontSize: 15 },

  // Search mode header
  searchBackText: { fontSize: 22, color: '#555555', marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111111',
  },
  searchClearText: { fontSize: 16, color: '#AAAAAA', marginLeft: 10 },

  // Search filter bar
  searchFilterWrap: {
    paddingBottom: 6,
    gap: 6,
  },
  searchFilterRow: {
    paddingHorizontal: 20,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    height: 28,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  filterChipActive: { backgroundColor: '#111111' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#999999' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },

  // Tag bar — pill filter chips with overlay `...`
  tagBarWrap: {
    position: 'relative',
    paddingBottom: 10,
  },
  tagBarScroll: {
    paddingLeft: 20,
    paddingRight: 52,  // space under the overlay so last chip isn't hidden
    gap: 8,
  },
  tagChip: {
    height: 28,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  tagChipActive: { backgroundColor: '#111111' },
  tagChipText: { fontSize: 12, fontWeight: '500', color: '#999999' },
  tagChipTextActive: { color: '#FFFFFF' },
  // Overlay container — floats above ScrollView on the right
  tagMoreOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagMoreBtn: {
    height: 28,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#EBEBEB',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  tagMoreText: { fontSize: 12, fontWeight: '700', color: '#999999' },

  // Tag sheet (full tag list modal)
  tagSheetContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  tagSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  tagSheetTitle: { fontSize: 17, fontWeight: '700', color: '#111111' },
  tagSheetClose: { fontSize: 16, fontWeight: '500', color: '#555555' },
  tagSheetClearBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
  },
  tagSheetClearText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  tagSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  tagSheetChip: {
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
  },
  tagSheetChipActive: { backgroundColor: '#111111' },
  tagSheetChipText: { fontSize: 14, fontWeight: '500', color: '#888888' },
  tagSheetChipTextActive: { color: '#FFFFFF' },
  tagSheetAddBtn: {
    height: 36,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
  },
  tagSheetAddText: { fontSize: 18, fontWeight: '600', color: '#4F46E5' },

  list: { paddingTop: 4, paddingBottom: 100 },
  empty: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 14, color: '#999999', textAlign: 'center', lineHeight: 22 },

  // Swipe actions
  deleteAction: {
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  deleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  archiveAction: {
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 10,
    marginLeft: 12,
  },
  archiveActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E8E8E8',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 15, fontWeight: '700' },
  actionBtnArchive: { backgroundColor: '#F0F0F0' },
  actionBtnArchiveText: { color: '#555555' },
  actionBtnDelete: { backgroundColor: '#FEE2E2' },
  actionBtnDeleteText: { color: '#DC2626' },

  // Toasts
  archiveToastWrap: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
  },
  archiveToast: {
    backgroundColor: '#6B7280',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  archiveToastText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', lineHeight: 32, marginTop: -2 },
})
