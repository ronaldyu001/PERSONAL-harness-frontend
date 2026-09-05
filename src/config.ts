import type { HistoryGroup, ModelOption } from './types'

export const MODELS: ModelOption[] = [
  {
    id: 'llama',
    name: 'Maia local',
    caption: 'Backend-configured through LiteLLM',
    badge: 'Default',
  },
]

export const SUGGESTIONS = [
  'Plan a focused deep-work morning',
  'Explain vector databases, simply',
  'Draft a warm interview follow-up',
  'What can I cook with miso and rice?',
]

export const GROUP_LABELS: Record<HistoryGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Previous 7 days',
  older: 'Older',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
