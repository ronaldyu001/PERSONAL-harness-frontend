import type { Conversation, ModelOption } from './types'

export const MODELS: ModelOption[] = [
  {
    id: 'llama',
    name: 'Llama 3.1',
    caption: 'Local model through LiteLLM',
    badge: 'Default',
  },
]

export const SUGGESTIONS = [
  'Plan a focused deep-work morning',
  'Explain vector databases, simply',
  'Draft a warm interview follow-up',
  'What can I cook with miso and rice?',
]

export const GROUP_LABELS: Record<Conversation['group'], string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Previous 7 days',
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Up late, Ronald'
  if (hour < 12) return 'Good morning, Ronald'
  if (hour < 17) return 'Good afternoon, Ronald'
  return 'Good evening, Ronald'
}
