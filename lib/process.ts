import { Scrap } from '@/types/scrap'
import { extractLinkPreview } from './extract'
import { updateScrapFields } from './storage'
import { generateSuggestedMemo } from './suggested-memo'

/**
 * Background post-save processing: fetch the URL, extract metadata + excerpt,
 * regenerate suggestedMemo using the full preview, and mark the scrap done.
 *
 * If the user already wrote a memo we still refresh suggestedMemo — the UI
 * only shows suggestedMemo when memo is empty, so there's no risk of
 * overwriting their text.
 */
export async function processScrap(scrap: Scrap): Promise<void> {
  const { id, originalUrl } = scrap

  try {
    const preview = await extractLinkPreview(originalUrl)

    const suggestedMemo = generateSuggestedMemo({
      bucket: scrap.bucket,
      tags: scrap.tags,
      linkPreview: preview,
    })

    await updateScrapFields(id, {
      rawTitle: preview.rawTitle,
      rawDescription: preview.rawDescription,
      imageUrl: preview.imageUrl,
      siteName: preview.siteName,
      suggestedMemo,
      status: 'done',
    })
  } catch (err) {
    console.error('[process] error — marking failed', err)
    await updateScrapFields(id, { status: 'failed' }).catch((e) =>
      console.error('[process] failed to update status to failed', e),
    )
  }
}
