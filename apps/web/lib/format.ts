import type { Bucket, SourcePlatform } from '@mobile-types/scrap'

export function formatBucketLabel(bucket: Bucket): string {
  return bucket === 'read' ? 'To Read' : 'To Do'
}

export function formatSourceLabel(source: SourcePlatform): string {
  switch (source) {
    case 'instagram':
      return 'Instagram'
    case 'threads':
      return 'Threads'
    case 'twitter':
      return 'X'
    case 'youtube':
      return 'YouTube'
    case 'web':
      return 'Web'
    default:
      return 'Unknown'
  }
}

export function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
