'use client'

import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Bucket, Scrap } from '@mobile-types/scrap'

import { getNickname, useAuth } from '@/lib/auth'
import {
  archiveScrap,
  createQuickScrap,
  listScraps,
  markScrapOpened,
  unarchiveScrap,
  updateScrapEdit,
  updateScrapStarred,
} from '@/lib/scraps'
import { formatBucketLabel } from '@/lib/format'
import {
  type RemindPresetConfig,
  computeRemindDate,
  listRemindPresets,
} from '@/lib/remind-presets'
import { addTagToPool, listTagPool } from '@/lib/tag-pools'
import { describeDataError } from '@/lib/errors'

type BucketFilter = 'all' | Bucket

const BUCKET_OPTIONS: BucketFilter[] = ['all', 'read', 'do']

const MAX_CARDS = 50

function getErrorMessage(error: unknown): string {
  // Supabase 에러는 영어 메시지가 그대로 노출되면 사용자에게 도움이 안 되므로
  // 한국어 fallback으로 한 번 더 감싸준다. 매칭 안 된 영문 메시지도 일반화된
  // 한국어 안내로 떨어진다.
  const raw = error instanceof Error ? error.message : null
  return describeDataError(raw, '문제가 발생했어요. 잠시 후 다시 시도해주세요.')
}

const MIN_QUERY_LENGTH = 2

function matchesQuery(scrap: Scrap, query: string): boolean {
  if (query.length < MIN_QUERY_LENGTH) return true

  const fields = [scrap.rawTitle, scrap.memo]
  return fields.some((field) => field?.toLowerCase().includes(query))
}

function toggleTag(tags: string[], nextTag: string): string[] {
  if (tags.includes(nextTag)) {
    return tags.filter((tag) => tag !== nextTag)
  }
  return [...tags, nextTag]
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRemindPreview(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const hh = d.getHours()
  const mm = d.getMinutes()
  const period = hh < 12 ? '오전' : '오후'
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  const time = mm === 0 ? `${period} ${h12}시` : `${period} ${h12}:${String(mm).padStart(2, '0')}`
  if (isToday) return `오늘 ${time}`
  if (isTomorrow) return `내일 ${time}`
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${weekday}) ${time}`
}

export function DashboardShell() {
  const router = useRouter()
  const { session, user, loading, signOut, updateNickname } = useAuth()
  const nickname = getNickname(user)

  const [scraps, setScraps] = useState<Scrap[]>([])
  const [tagPool, setTagPool] = useState<string[]>([])
  const [remindPresets, setRemindPresets] = useState<RemindPresetConfig[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')

  const [query, setQuery] = useState('')
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [starredOnly, setStarredOnly] = useState(false)
  const [unopenedOnly, setUnopenedOnly] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionMode = selectedIds.size > 0

  const [editOpen, setEditOpen] = useState(false)
  const [editScrapId, setEditScrapId] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editMemo, setEditMemo] = useState('')
  const [editRemindAt, setEditRemindAt] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [undoState, setUndoState] = useState<{ scraps: Scrap[] } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [newUrl, setNewUrl] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [newBucket, setNewBucket] = useState<Bucket>('read')
  const [newTags, setNewTags] = useState<string[]>([])
  const [newRemindAt, setNewRemindAt] = useState<string | null>(null)
  const [quickAddError, setQuickAddError] = useState('')
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  const [tagAdding, setTagAdding] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [tagError, setTagError] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const [nicknameOpen, setNicknameOpen] = useState(false)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [nicknamePromptDismissed, setNicknamePromptDismissed] = useState(false)

  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, router, session])

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function loadWorkspace() {
      setWorkspaceLoading(true)
      setWorkspaceError('')

      try {
        const [nextScraps, nextTags, nextPresets] = await Promise.all([
          listScraps(),
          listTagPool(),
          listRemindPresets(),
        ])
        if (cancelled) return

        setScraps(nextScraps)
        setTagPool([...nextTags].sort((left, right) => left.localeCompare(right, 'ko')))
        setRemindPresets(nextPresets)
        setSelectedId((current) => {
          if (current && nextScraps.some((scrap) => scrap.id === current)) {
            return current
          }
          return nextScraps[0]?.id ?? null
        })
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(getErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false)
        }
      }
    }

    loadWorkspace()

    return () => {
      cancelled = true
    }
  }, [session])

  let filteredScraps = scraps.filter((scrap) => matchesQuery(scrap, deferredQuery))

  if (bucketFilter !== 'all') {
    filteredScraps = filteredScraps.filter((scrap) => scrap.bucket === bucketFilter)
  }

  if (starredOnly) {
    filteredScraps = filteredScraps.filter((scrap) => scrap.starred)
  }

  if (unopenedOnly) {
    filteredScraps = filteredScraps.filter((scrap) => scrap.openedAt === null)
  }

  if (selectedTags.length > 0) {
    filteredScraps = filteredScraps.filter((scrap) =>
      selectedTags.every((tag) => scrap.tags.includes(tag)),
    )
  }

  useEffect(() => {
    if (filteredScraps.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null)
      }
      return
    }

    if (!filteredScraps.some((scrap) => scrap.id === selectedId)) {
      setSelectedId(filteredScraps[0].id)
    }
  }, [filteredScraps, selectedId])

  const selectedScrap = filteredScraps.find((scrap) => scrap.id === selectedId) ?? null
  const editingScrap = scraps.find((scrap) => scrap.id === editScrapId) ?? null

  useEffect(() => {
    if (!editOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen])

  useEffect(() => {
    if (!quickAddOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setQuickAddOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickAddOpen])

  useEffect(() => {
    if (loading || !user) return
    if (nickname || nicknameOpen || nicknamePromptDismissed) return
    setNicknameDraft('')
    setNicknameError('')
    setNicknameOpen(true)
  }, [loading, user, nickname, nicknameOpen, nicknamePromptDismissed])

  useEffect(() => {
    if (!nicknameOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && nickname) closeNicknameEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicknameOpen, nickname])

  useEffect(() => {
    if (!menuOpen) return
    function onPointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!newUrl.trim()) {
      setQuickAddError('추가할 링크를 입력해주세요.')
      return
    }

    let normalizedRemindAt: string | null = null
    if (newRemindAt) {
      const parsed = new Date(newRemindAt)
      if (Number.isNaN(parsed.getTime())) {
        setQuickAddError('리마인드 시간 형식이 올바르지 않습니다.')
        return
      }
      if (parsed.getTime() <= Date.now()) {
        setQuickAddError('리마인드는 현재 이후 시각으로 설정해주세요.')
        return
      }
      normalizedRemindAt = parsed.toISOString()
    }

    setQuickAddSubmitting(true)
    setQuickAddError('')

    try {
      const created = await createQuickScrap({
        bucket: newBucket,
        memo: newMemo,
        originalUrl: newUrl.trim(),
        tags: newTags,
        remindAt: normalizedRemindAt,
      })

      setScraps((current) => [created, ...current])
      setSelectedId(created.id)
      setNewUrl('')
      setNewMemo('')
      setNewBucket('read')
      setNewTags([])
      setNewRemindAt(null)
      setQuickAddOpen(false)
    } catch (error) {
      setQuickAddError(getErrorMessage(error))
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  function openEdit(scrap: Scrap) {
    setEditScrapId(scrap.id)
    setEditTags([...scrap.tags])
    setEditMemo(scrap.memo ?? '')
    setEditRemindAt(scrap.remindAt ?? null)
    setEditError('')
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditScrapId(null)
    setEditError('')
  }

  async function handleEditSave() {
    if (!editingScrap) return

    if (editRemindAt) {
      const parsed = new Date(editRemindAt)
      if (Number.isNaN(parsed.getTime())) {
        setEditError('리마인드 시간 형식이 올바르지 않습니다.')
        return
      }
      if (parsed.getTime() <= Date.now()) {
        setEditError('현재 이후 시각을 선택해주세요.')
        return
      }
    }

    setEditSaving(true)
    setEditError('')

    try {
      const nextTags = Array.from(new Set(editTags))
      const nextMemo = editMemo.trim()
      const nextRemindAt = editRemindAt ? new Date(editRemindAt).toISOString() : null

      await updateScrapEdit(editingScrap.id, {
        tags: nextTags,
        memo: nextMemo,
        remindAt: nextRemindAt,
      })

      setScraps((current) =>
        current.map((scrap) =>
          scrap.id === editingScrap.id
            ? { ...scrap, tags: nextTags, memo: nextMemo, remindAt: nextRemindAt }
            : scrap,
        ),
      )
      closeEdit()
    } catch (error) {
      setEditError(getErrorMessage(error))
    } finally {
      setEditSaving(false)
    }
  }

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  useEffect(() => () => clearUndoTimer(), [])

  function startUndoTimer() {
    clearUndoTimer()
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null)
      undoTimerRef.current = null
    }, 5000)
  }

  async function handleDeleteScrap() {
    if (!editingScrap || editSaving) return
    const target = editingScrap
    closeEdit()
    setScraps((current) => current.filter((scrap) => scrap.id !== target.id))
    if (selectedId === target.id) setSelectedId(null)

    setUndoState({ scraps: [target] })
    startUndoTimer()

    try {
      await archiveScrap(target.id)
    } catch (error) {
      setScraps((current) => [target, ...current])
      clearUndoTimer()
      setUndoState(null)
      setWorkspaceError(getErrorMessage(error))
    }
  }

  function toggleCardSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const targets = scraps.filter((scrap) => selectedIds.has(scrap.id))
    if (targets.length === 0) return

    const targetIds = new Set(targets.map((t) => t.id))
    setScraps((current) => current.filter((scrap) => !targetIds.has(scrap.id)))
    if (selectedId && targetIds.has(selectedId)) setSelectedId(null)
    exitSelectionMode()

    setUndoState({ scraps: targets })
    startUndoTimer()

    try {
      await Promise.all(targets.map((t) => archiveScrap(t.id)))
    } catch (error) {
      setScraps((current) =>
        [...current, ...targets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
      clearUndoTimer()
      setUndoState(null)
      setWorkspaceError(getErrorMessage(error))
    }
  }

  async function handleUndoDelete() {
    if (!undoState) return
    const targets = undoState.scraps
    clearUndoTimer()
    setUndoState(null)
    setScraps((current) =>
      [...current, ...targets.map((t) => ({ ...t, archivedAt: null }))].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    )
    try {
      await Promise.all(targets.map((t) => unarchiveScrap(t.id)))
    } catch (error) {
      const targetIds = new Set(targets.map((t) => t.id))
      setScraps((current) => current.filter((scrap) => !targetIds.has(scrap.id)))
      setWorkspaceError(getErrorMessage(error))
    }
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  function openNicknameEditor() {
    setNicknameDraft(nickname ?? '')
    setNicknameError('')
    setNicknameOpen(true)
  }

  function closeNicknameEditor() {
    setNicknameOpen(false)
    setNicknameError('')
  }

  async function handleNicknameSave() {
    if (nicknameSaving) return
    const trimmed = nicknameDraft.trim()
    if (!trimmed) {
      setNicknameError('닉네임을 입력해주세요.')
      return
    }
    if (trimmed.length > 20) {
      setNicknameError('닉네임은 20자 이내로 입력해주세요.')
      return
    }
    setNicknameSaving(true)
    setNicknameError('')
    const message = await updateNickname(trimmed)
    setNicknameSaving(false)
    if (message) {
      setNicknameError(message)
      return
    }
    setNicknameOpen(false)
    setNicknamePromptDismissed(true)
  }

  async function handleOpenScrap(scrap: Scrap) {
    window.open(scrap.originalUrl, '_blank', 'noopener,noreferrer')

    if (scrap.openedAt) return

    const openedAt = new Date().toISOString()
    setScraps((current) =>
      current.map((item) => (item.id === scrap.id ? { ...item, openedAt } : item)),
    )
    try {
      await markScrapOpened(scrap.id, openedAt)
    } catch (error) {
      setScraps((current) =>
        current.map((item) => (item.id === scrap.id ? { ...item, openedAt: scrap.openedAt } : item)),
      )
      setWorkspaceError(getErrorMessage(error))
    }
  }

  async function handleToggleStar(scrap: Scrap) {
    const nextStarred = !scrap.starred
    setScraps((current) =>
      current.map((item) =>
        item.id === scrap.id ? { ...item, starred: nextStarred } : item,
      ),
    )
    try {
      await updateScrapStarred(scrap.id, nextStarred)
    } catch (error) {
      setScraps((current) =>
        current.map((item) =>
          item.id === scrap.id ? { ...item, starred: scrap.starred } : item,
        ),
      )
      setWorkspaceError(getErrorMessage(error))
    }
  }

  async function handleAddTag() {
    const trimmed = tagDraft.trim().replace(/^#/, '')
    if (!trimmed) {
      setTagError('태그 이름을 입력해주세요.')
      return
    }
    if (tagPool.includes(trimmed)) {
      setTagError('이미 있는 태그입니다.')
      return
    }

    try {
      const updated = await addTagToPool(trimmed)
      setTagPool([...updated].sort((left, right) => left.localeCompare(right, 'ko')))
      setTagDraft('')
      setTagError('')
      setTagAdding(false)
    } catch (error) {
      setTagError(getErrorMessage(error))
    }
  }

  function handleCancelAddTag() {
    setTagAdding(false)
    setTagDraft('')
    setTagError('')
  }

  if (loading || (!session && !loading)) {
    return <div className="loading-state">세션을 확인하는 중입니다...</div>
  }

  if (workspaceLoading) {
    return <div className="loading-state">웹 작업 공간을 불러오는 중입니다...</div>
  }

  function handleBackgroundClick(event: ReactMouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
      setSelectedId(null)
      if (selectionMode) exitSelectionMode()
    }
  }

  function renderQuickAddForm() {
    return (
      <form className="quick-add-form" onSubmit={handleQuickAdd}>
        <label className="field">
          <span>URL</span>
          <input
            className="text-input"
            onChange={(event) => {
              setNewUrl(event.target.value)
              setQuickAddError('')
            }}
            placeholder="https://example.com/article"
            type="url"
            value={newUrl}
          />
        </label>

        <div className="filter-group">
          <p className="bucket-section-label">저장 목적</p>
          <div className="bucket-row">
            {(['read', 'do'] as Bucket[]).map((bucket) => (
              <button
                className={`bucket-button ${newBucket === bucket ? 'bucket-button-active' : ''}`}
                key={bucket}
                onClick={() => setNewBucket(bucket)}
                type="button"
              >
                <span className="bucket-button-icon" aria-hidden="true">
                  {bucket === 'read' ? '📖' : '⚡'}
                </span>
                <span>{formatBucketLabel(bucket)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <p className="section-label">태그</p>
          <div className="chip-row">
            {tagPool.map((tag) => (
              <button
                className={`chip-button ${newTags.includes(tag) ? 'chip-button-active' : ''}`}
                key={tag}
                onClick={() => setNewTags((current) => toggleTag(current, tag))}
                type="button"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>메모</span>
          <textarea
            className="text-area"
            onChange={(event) => setNewMemo(event.target.value)}
            placeholder="왜 저장하는지, 나중에 어떻게 회수할지 짧게 적습니다."
            value={newMemo}
          />
        </label>

        <div className="filter-group">
          <p className="section-label">리마인드</p>
          <div className="chip-row">
            <button
              className={`chip-button ${newRemindAt === null ? 'chip-button-active' : ''}`}
              onClick={() => {
                setNewRemindAt(null)
                setQuickAddError('')
              }}
              type="button"
            >
              없음
            </button>
            {remindPresets.map((preset) => (
              <button
                className="chip-button"
                key={preset.id}
                onClick={() => {
                  setNewRemindAt(computeRemindDate(preset).toISOString())
                  setQuickAddError('')
                }}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            className="text-input"
            onChange={(event) => {
              const value = event.target.value
              if (!value) {
                setNewRemindAt(null)
              } else {
                const parsed = new Date(value)
                setNewRemindAt(Number.isNaN(parsed.getTime()) ? null : parsed.toISOString())
              }
              setQuickAddError('')
            }}
            style={{ marginTop: 8 }}
            type="datetime-local"
            value={toDateTimeLocal(newRemindAt)}
          />
          <p className="remind-hint" style={{ marginTop: 6 }}>
            {newRemindAt ? `🔔 ${formatRemindPreview(newRemindAt)} · ` : ''}웹에서 알람을 설정한 뒤 모바일 앱을 한 번도 실행하지 않으면 알람이 뜨지 않아요. 잊지 말고 앱을 실행해주세요!
          </p>
        </div>

        {quickAddError ? <p className="panel-error">{quickAddError}</p> : null}

        <button className="primary-button" disabled={quickAddSubmitting} type="submit">
          {quickAddSubmitting ? '추가 중...' : '링크 추가'}
        </button>
      </form>
    )
  }

  return (
    <main className="dashboard-shell" onClick={handleBackgroundClick}>
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-lead">
          <div className="brand-mark">
            <img alt="Insightful" className="brand-logo" src="/insightful-logo.png" />
          </div>
          <p className="dashboard-greeting">
            {nickname
              ? `안녕하세요 ${nickname}님! 오늘은 어떤 지식을 회수해볼까요?`
              : '안녕하세요! 오늘은 어떤 지식을 회수해볼까요?'}
          </p>
        </div>

        <div className="topbar-actions" ref={menuRef}>
          <button
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="계정 메뉴"
            className="account-button"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
          </button>

          {menuOpen ? (
            <div className="account-menu" role="menu">
              <div className="account-menu-header">
                <p className="account-menu-email">{user?.email ?? '내 작업 공간'}</p>
              </div>

              <div className="account-menu-usage">
                <div className="account-menu-usage-row">
                  <span>저장 카드</span>
                  <span>
                    {scraps.length} / {MAX_CARDS}
                  </span>
                </div>
                <div className="usage-track">
                  <div
                    className="usage-fill"
                    style={{
                      width: `${Math.min((scraps.length / MAX_CARDS) * 100, 100)}%`,
                      background:
                        scraps.length > 40
                          ? '#dc2626'
                          : scraps.length > 30
                            ? '#ea880c'
                            : 'var(--key)',
                    }}
                  />
                </div>
              </div>

              <button
                className="account-menu-item"
                onClick={() => {
                  setMenuOpen(false)
                  openNicknameEditor()
                }}
                role="menuitem"
                type="button"
              >
                닉네임 변경
              </button>

              <button
                className="account-menu-item account-menu-item-danger"
                onClick={() => {
                  setMenuOpen(false)
                  handleSignOut()
                }}
                role="menuitem"
                type="button"
              >
                로그아웃
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="dashboard-grid" onClick={handleBackgroundClick}>
        <aside className="filter-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Filter</p>
              <h2 className="list-count">카드 찾기</h2>
            </div>
          </div>

          <div className="filter-group">
            <p className="bucket-section-label">저장 목적</p>
            <div className="bucket-row bucket-row-three">
              {BUCKET_OPTIONS.map((bucket) => (
                <button
                  className={`bucket-button ${bucketFilter === bucket ? 'bucket-button-active' : ''}`}
                  key={bucket}
                  onClick={() => setBucketFilter(bucket)}
                  type="button"
                >
                  <span className="bucket-button-icon" aria-hidden="true">
                    {bucket === 'all' ? '🗂️' : bucket === 'read' ? '📖' : '⚡'}
                  </span>
                  <span>{bucket === 'all' ? '전체' : formatBucketLabel(bucket)}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>검색어</span>
            <input
              className="text-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 메모, 사이트, URL 검색"
              type="text"
              value={query}
            />
          </label>

          <div className="filter-group">
            <p className="section-label">태그</p>
            <div className="chip-row">
              {tagPool.map((tag) => (
                <button
                  className={`chip-button ${selectedTags.includes(tag) ? 'chip-button-active' : ''}`}
                  key={tag}
                  onClick={() => setSelectedTags((current) => toggleTag(current, tag))}
                  type="button"
                >
                  #{tag}
                </button>
              ))}

              {tagAdding ? (
                <div className="tag-add-inline">
                  <input
                    autoFocus
                    className="tag-add-input"
                    onChange={(event) => {
                      setTagDraft(event.target.value)
                      setTagError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddTag()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        handleCancelAddTag()
                      }
                    }}
                    placeholder="새 태그"
                    type="text"
                    value={tagDraft}
                  />
                  <button
                    aria-label="태그 추가"
                    className="chip-button chip-button-active"
                    onClick={handleAddTag}
                    type="button"
                  >
                    추가
                  </button>
                  <button
                    aria-label="취소"
                    className="chip-button"
                    onClick={handleCancelAddTag}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  aria-label="태그 추가"
                  className="chip-button chip-button-add"
                  onClick={() => setTagAdding(true)}
                  type="button"
                >
                  +
                </button>
              )}
            </div>
            {tagError ? <p className="form-error">{tagError}</p> : null}
          </div>

        </aside>

        <section className="list-panel">
          <div className="list-toolbar">
            {selectionMode ? (
              <>
                <div>
                  <p className="eyebrow">Library</p>
                  <p className="list-count">{selectedIds.size}개 선택됨</p>
                </div>
                <div className="list-toolbar-filters">
                  <button
                    className="selection-toolbar-button"
                    onClick={exitSelectionMode}
                    type="button"
                  >
                    선택 해제
                  </button>
                  <button
                    className="selection-toolbar-button selection-toolbar-button-danger"
                    onClick={handleBulkDelete}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="eyebrow">Library</p>
                  <p className="list-count">카드 {filteredScraps.length}개</p>
                </div>
                <div className="list-toolbar-filters">
                  <button
                    aria-label={unopenedOnly ? '미개봉 필터 해제' : '미개봉만 보기'}
                    aria-pressed={unopenedOnly}
                    className={`star-filter-button unopened-filter-button ${unopenedOnly ? 'unopened-filter-button-active' : ''}`}
                    onClick={() => setUnopenedOnly((current) => !current)}
                    type="button"
                  >
                    <span className="star-filter-glyph" aria-hidden="true">
                      {unopenedOnly ? '●' : '○'}
                    </span>
                    <span className="star-filter-label">미개봉</span>
                  </button>
                  <button
                    aria-label={starredOnly ? '중요 표시 필터 해제' : '중요 표시만 보기'}
                    aria-pressed={starredOnly}
                    className={`star-filter-button ${starredOnly ? 'star-filter-button-active' : ''}`}
                    onClick={() => setStarredOnly((current) => !current)}
                    type="button"
                  >
                    <span className="star-filter-glyph">{starredOnly ? '★' : '☆'}</span>
                    <span className="star-filter-label">중요</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {workspaceError ? <p className="panel-error">{workspaceError}</p> : null}

          {filteredScraps.length === 0 ? (
            <div className="empty-state">
              <h2>조건에 맞는 카드가 없습니다.</h2>
              <p>검색어를 줄이거나 태그·버킷 필터를 해제해보세요.</p>
            </div>
          ) : (
            <div className="scrap-list">
              {filteredScraps.map((scrap) => {
                const summary = scrap.memo || scrap.suggestedMemo || '아직 메모가 없습니다.'
                const isFocused = scrap.id === selectedScrap?.id && !selectionMode
                const isChecked = selectedIds.has(scrap.id)
                const isRead = scrap.openedAt != null
                const cardClasses = [
                  'scrap-card',
                  isRead ? 'scrap-card-read' : '',
                  isFocused ? 'scrap-card-selected' : '',
                  isChecked ? 'scrap-card-checked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <article className={cardClasses} key={scrap.id}>
                    <button
                      aria-label={isChecked ? '선택 해제' : '선택'}
                      aria-pressed={isChecked}
                      className={`card-check-button ${isChecked ? 'card-check-button-active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleCardSelection(scrap.id)
                      }}
                      type="button"
                    >
                      <span className="card-check-glyph" aria-hidden="true">
                        {isChecked ? '✓' : ''}
                      </span>
                    </button>

                    <button
                      className="card-select-button"
                      onClick={() => {
                        if (selectionMode) {
                          toggleCardSelection(scrap.id)
                        } else {
                          setSelectedId(scrap.id)
                        }
                      }}
                      onDoubleClick={() => {
                        if (!selectionMode) handleOpenScrap(scrap)
                      }}
                      type="button"
                    >
                      <div className="card-topline">
                        <div className="card-meta">
                          <span className="bucket-badge">{formatBucketLabel(scrap.bucket)}</span>
                          <span
                            className={`status-badge ${
                              scrap.status === 'processing' ? 'status-badge-processing' : ''
                            }`}
                          >
                            {scrap.status === 'processing' ? 'processing' : 'ready'}
                          </span>
                        </div>
                      </div>

                      <p className="card-memo">{summary}</p>
                    </button>

                    {!selectionMode ? (
                      <button
                        aria-label={scrap.starred ? '중요 표시 해제' : '중요 표시'}
                        aria-pressed={scrap.starred}
                        className={`star-button ${scrap.starred ? 'star-button-active' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleToggleStar(scrap)
                        }}
                        type="button"
                      >
                        {scrap.starred ? '★' : '☆'}
                      </button>
                    ) : null}

                    <div className="card-footer">
                      <div className="card-footer-left">
                        <p className="meta-copy">{scrap.siteName || scrap.originalUrl}</p>
                        {scrap.tags.length > 0 ? (
                          <div className="card-meta">
                            {scrap.tags.map((tag) => (
                              <span className="chip-button chip-button-muted" key={tag}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {isFocused ? (
                        <button
                          className="card-link-button card-link-button-edit"
                          onClick={() => openEdit(scrap)}
                          type="button"
                        >
                          수정
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="detail-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Save</p>
              <h2 className="list-count">새 링크 저장</h2>
            </div>
          </div>

          {renderQuickAddForm()}

        </aside>
      </div>

      <button
        aria-label="새 링크 저장"
        className="floating-add-button"
        onClick={() => setQuickAddOpen(true)}
        type="button"
      >
        +
      </button>

      {quickAddOpen ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setQuickAddOpen(false)
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Save</p>
                <h2>새 링크 저장</h2>
              </div>
              <button
                aria-label="닫기"
                className="modal-close"
                onClick={() => setQuickAddOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            {renderQuickAddForm()}
          </div>
        </div>
      ) : null}

      {editOpen && editingScrap ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEdit()
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Edit</p>
                <h2>카드 수정</h2>
              </div>
              <button
                aria-label="닫기"
                className="modal-close"
                onClick={closeEdit}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="meta-stack">
              <h3>{editingScrap.rawTitle || editingScrap.siteName || editingScrap.originalUrl}</h3>
              <p className="meta-copy">{editingScrap.originalUrl}</p>
            </div>

            <div className="filter-group">
              <p className="section-label">태그</p>
              <div className="chip-row">
                {tagPool.map((tag) => (
                  <button
                    className={`chip-button ${editTags.includes(tag) ? 'chip-button-active' : ''}`}
                    key={tag}
                    onClick={() => setEditTags((current) => toggleTag(current, tag))}
                    type="button"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>메모</span>
              <textarea
                autoFocus
                className="text-area"
                onChange={(event) => {
                  setEditMemo(event.target.value)
                  setEditError('')
                }}
                placeholder="이 카드를 나중에 어떻게 활용할지 적습니다."
                value={editMemo}
              />
            </label>

            <div className="filter-group">
              <p className="section-label">리마인드</p>
              <div className="chip-row">
                <button
                  className={`chip-button ${editRemindAt === null ? 'chip-button-active' : ''}`}
                  onClick={() => {
                    setEditRemindAt(null)
                    setEditError('')
                  }}
                  type="button"
                >
                  없음
                </button>
                {remindPresets.map((preset) => (
                  <button
                    className="chip-button"
                    key={preset.id}
                    onClick={() => {
                      setEditRemindAt(computeRemindDate(preset).toISOString())
                      setEditError('')
                    }}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                className="text-input"
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    setEditRemindAt(null)
                  } else {
                    const parsed = new Date(value)
                    setEditRemindAt(Number.isNaN(parsed.getTime()) ? null : parsed.toISOString())
                  }
                  setEditError('')
                }}
                style={{ marginTop: 8 }}
                type="datetime-local"
                value={toDateTimeLocal(editRemindAt)}
              />
              {editRemindAt ? (
                <p className="remind-hint" style={{ marginTop: 6 }}>
                  🔔 {formatRemindPreview(editRemindAt)} · 웹에서 알람을 설정한 뒤 모바일 앱을 한 번도 실행하지 않으면 알람이 뜨지 않아요. 잊지 말고 앱을 실행해주세요!
                </p>
              ) : (
                <p className="remind-hint" style={{ marginTop: 6 }}>
                  웹에서 알람을 설정한 뒤 모바일 앱을 한 번도 실행하지 않으면 알람이 뜨지 않아요. 잊지 말고 앱을 실행해주세요!
                </p>
              )}
            </div>

            {editError ? <p className="panel-error">{editError}</p> : null}

            <div className="modal-actions modal-actions-split">
              <button
                className="danger-button"
                disabled={editSaving}
                onClick={handleDeleteScrap}
                type="button"
              >
                삭제
              </button>
              <div className="modal-actions-trailing">
                <button
                  className="ghost-button"
                  disabled={editSaving}
                  onClick={closeEdit}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="primary-button"
                  disabled={editSaving}
                  onClick={handleEditSave}
                  type="button"
                >
                  {editSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {undoState ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <span className="undo-toast-text">
            {undoState.scraps.length > 1
              ? `${undoState.scraps.length}개 삭제됨`
              : '삭제됨'}
          </span>
          <button className="undo-toast-action" onClick={handleUndoDelete} type="button">
            실행취소
          </button>
        </div>
      ) : null}

      {nicknameOpen ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && nickname) closeNicknameEditor()
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>{nickname ? '닉네임 변경' : '닉네임 설정'}</h2>
              </div>
              {nickname ? (
                <button
                  aria-label="닫기"
                  className="modal-close"
                  onClick={closeNicknameEditor}
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </div>

            <p className="meta-copy">
              인사말과 메뉴에 표시될 닉네임을 알려주세요. (최대 20자)
            </p>

            <label className="field">
              <span>닉네임</span>
              <input
                autoFocus
                className="text-input"
                maxLength={20}
                onChange={(event) => {
                  setNicknameDraft(event.target.value)
                  setNicknameError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleNicknameSave()
                  }
                }}
                placeholder="예: 인사이트헌터"
                type="text"
                value={nicknameDraft}
              />
            </label>

            {nicknameError ? <p className="panel-error">{nicknameError}</p> : null}

            <div className="modal-actions">
              {nickname ? (
                <button
                  className="ghost-button"
                  disabled={nicknameSaving}
                  onClick={closeNicknameEditor}
                  type="button"
                >
                  취소
                </button>
              ) : null}
              <button
                className="primary-button"
                disabled={nicknameSaving}
                onClick={handleNicknameSave}
                type="button"
              >
                {nicknameSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
