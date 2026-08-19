import type { JSX } from 'react'
import { CloudSun, ListTodo, MessagesSquare, type LucideIcon } from 'lucide-react'
import { TasksPanelBody, WeatherPanelBody } from './panels'

/**
 * The dashboard panel registry.
 *
 * Adding a region means adding an entry here, plus a body component in
 * panels.tsx when it has one. Regions without a live body render at rest.
 */
export interface PanelDef {
  id: string
  /** Engraved legend on the panel face; also the region accessible name. */
  legend: string
  icon: LucideIcon
  /** primary takes the large display field; secondary sits in the stack. */
  slot: 'primary' | 'secondary'
  /** live regions work; dormant regions have no signal on that input. */
  status: 'live' | 'dormant'
  /** Only live regions expand into a full surface. */
  expandable: boolean
  /** Dormant only: what would read here, and what it waits on. */
  awaiting?: string
}

export const PANELS: PanelDef[] = [
  {
    id: 'chat',
    legend: 'Conversation',
    icon: MessagesSquare,
    slot: 'primary',
    status: 'live',
    expandable: true,
  },
  {
    id: 'tasks',
    legend: 'Pending tasks',
    icon: ListTodo,
    slot: 'secondary',
    status: 'dormant',
    expandable: false,
    awaiting: 'Waiting on a task store.',
  },
  {
    id: 'weather',
    legend: 'Today',
    icon: CloudSun,
    slot: 'secondary',
    status: 'dormant',
    expandable: false,
    awaiting: 'No location source. Maia makes no outside calls.',
  },
]

export const PANEL_BODIES: Record<string, () => JSX.Element> = {
  tasks: TasksPanelBody,
  weather: WeatherPanelBody,
}
