import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Composer, type ComposerProps } from './Composer'
import { MaiaMark } from './MaiaMark'

const MemoComposer = memo(Composer)

const DEFAULT_WIDTH = 400
const MIN_WIDTH = 300
const MAX_WIDTH = 620
const MIN_HEIGHT = 104
const MAX_HEIGHT = 560
const DEFAULT_MARGIN = 12
const MOBILE_BREAKPOINT = 680
const KEYBOARD_STEP = 16
const KEYBOARD_FINE_STEP = 4

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'

interface Geometry {
  x: number
  y: number
  width: number
  height: number
}

interface Viewport {
  x: number
  y: number
  width: number
  height: number
}

interface Limits {
  minX: number
  minY: number
  maxRight: number
  maxBottom: number
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
}

type Interaction =
  | {
      kind: 'drag'
      pointerId: number
      lastX: number
      lastY: number
    }
  | {
      kind: 'resize'
      pointerId: number
      edge: ResizeEdge
      lastX: number
      lastY: number
    }

const RESIZE_EDGES: ResizeEdge[] = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']

const EDGE_LABELS: Record<ResizeEdge, string> = {
  n: 'top edge',
  e: 'right edge',
  s: 'bottom edge',
  w: 'left edge',
  ne: 'top-right corner',
  se: 'bottom-right corner',
  sw: 'bottom-left corner',
  nw: 'top-left corner',
}

const HANDLE_STYLES: Record<ResizeEdge, CSSProperties> = {
  n: { top: 0, right: 18, left: 18, height: 10, cursor: 'ns-resize' },
  e: { top: 18, right: 0, bottom: 18, width: 10, cursor: 'ew-resize' },
  s: { right: 18, bottom: 0, left: 18, height: 10, cursor: 'ns-resize' },
  w: { top: 18, bottom: 18, left: 0, width: 10, cursor: 'ew-resize' },
  ne: { top: 0, right: 0, width: 18, height: 18, cursor: 'nesw-resize' },
  se: { right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize' },
  sw: { bottom: 0, left: 0, width: 18, height: 18, cursor: 'nesw-resize' },
  nw: { top: 0, left: 0, width: 18, height: 18, cursor: 'nwse-resize' },
}

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[data-no-drag]',
  '[data-resize-edge]',
  '[role="button"]',
  '[role="link"]',
].join(',')

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function readViewport(): Viewport {
  const visualViewport = window.visualViewport
  return {
    x: visualViewport?.offsetLeft ?? 0,
    y: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  }
}

function readLimits(viewport: Viewport, margin: number, naturalHeight: number): Limits {
  const minX = viewport.x + margin
  const minY = viewport.y + margin
  const maxRight = viewport.x + viewport.width - margin
  const maxBottom = viewport.y + viewport.height - margin
  const availableWidth = Math.max(1, maxRight - minX)
  const availableHeight = Math.max(1, maxBottom - minY)
  const minWidth = Math.min(MIN_WIDTH, availableWidth)
  const maxWidth = Math.max(minWidth, Math.min(MAX_WIDTH, availableWidth))
  const minHeight = Math.min(Math.max(MIN_HEIGHT, naturalHeight), availableHeight)
  const maxHeight = Math.max(minHeight, Math.min(MAX_HEIGHT, availableHeight))

  return { minX, minY, maxRight, maxBottom, minWidth, maxWidth, minHeight, maxHeight }
}

function clampGeometry(geometry: Geometry, limits: Limits): Geometry {
  const width = clamp(geometry.width, limits.minWidth, limits.maxWidth)
  const height = clamp(geometry.height, limits.minHeight, limits.maxHeight)
  return {
    x: clamp(geometry.x, limits.minX, Math.max(limits.minX, limits.maxRight - width)),
    y: clamp(geometry.y, limits.minY, Math.max(limits.minY, limits.maxBottom - height)),
    width,
    height,
  }
}

function sameGeometry(a: Geometry | null, b: Geometry) {
  return (
    a !== null &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  )
}

export interface FloatingComposerProps extends ComposerProps {
  /** Disables positional transitions in addition to Composer's MotionConfig. */
  reduceMotion?: boolean
  /** Initial desktop width before the reader resizes the panel. */
  initialWidth?: number
  /** Minimum distance kept between the floating panel and the visible viewport. */
  viewportMargin?: number
}

/**
 * Viewport-level shell around the existing Composer.
 *
 * This component owns only geometry. Composer still owns the draft and every
 * chat action, so moving or resizing the shell cannot fork the submission,
 * model, temporary-chat, or stop behavior.
 */
export function FloatingComposer({
  reduceMotion = false,
  initialWidth = DEFAULT_WIDTH,
  viewportMargin = DEFAULT_MARGIN,
  ...composerProps
}: FloatingComposerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const geometryRef = useRef<Geometry | null>(null)
  const desktopGeometryRef = useRef<Geometry | null>(null)
  const naturalHeightRef = useRef(MIN_HEIGHT)
  const chromeHeightRef = useRef(0)
  const preferredHeightRef = useRef<number | null>(null)
  const resizeFrameRef = useRef(0)
  const mobileRef = useRef(false)

  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [interactionKind, setInteractionKind] = useState<Interaction['kind'] | null>(null)
  const [mobile, setMobile] = useState(false)
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const motionReduced = reduceMotion || systemReducedMotion

  const commitGeometry = useCallback((next: Geometry) => {
    geometryRef.current = next
    setGeometry((current) => (sameGeometry(current, next) ? current : next))
  }, [])

  const limitsForViewport = useCallback(() => {
    return readLimits(readViewport(), viewportMargin, naturalHeightRef.current)
  }, [viewportMargin])

  const dockForMobile = useCallback(() => {
    const viewport = readViewport()
    const limits = readLimits(viewport, viewportMargin, naturalHeightRef.current)
    const width = Math.max(1, limits.maxRight - limits.minX)
    const height = clamp(naturalHeightRef.current, limits.minHeight, limits.maxHeight)
    return {
      x: limits.minX,
      y: Math.max(limits.minY, limits.maxBottom - height),
      width,
      height,
    }
  }, [viewportMargin])

  const finishInteraction = useCallback((pointerId?: number) => {
    const interaction = interactionRef.current
    if (!interaction || (pointerId !== undefined && interaction.pointerId !== pointerId)) return

    interactionRef.current = null
    setInteractionKind(null)
    const panel = panelRef.current
    if (panel?.hasPointerCapture(interaction.pointerId)) {
      panel.releasePointerCapture(interaction.pointerId)
    }
  }, [])

  const syncToViewport = useCallback(() => {
    const current = geometryRef.current
    if (!current) return

    const nextMobile = readViewport().width <= MOBILE_BREAKPOINT
    const wasMobile = mobileRef.current
    if (nextMobile !== wasMobile) {
      if (nextMobile) desktopGeometryRef.current = current
      mobileRef.current = nextMobile
      setMobile(nextMobile)
    }

    if (nextMobile) {
      commitGeometry(dockForMobile())
      return
    }

    const candidate = wasMobile ? (desktopGeometryRef.current ?? current) : current
    const next = clampGeometry(candidate, limitsForViewport())
    desktopGeometryRef.current = next
    commitGeometry(next)
  }, [commitGeometry, dockForMobile, limitsForViewport])

  useLayoutEffect(() => {
    const panel = panelRef.current
    const content = contentRef.current
    if (!panel || !content || geometryRef.current) return

    const viewport = readViewport()
    const measuredPanel = panel.getBoundingClientRect()
    const measuredContent = content.getBoundingClientRect()
    chromeHeightRef.current = Math.max(0, measuredPanel.height - measuredContent.height)
    naturalHeightRef.current = Math.max(
      MIN_HEIGHT,
      Math.ceil(measuredContent.height + chromeHeightRef.current),
    )
    const limits = readLimits(viewport, viewportMargin, naturalHeightRef.current)
    const width = clamp(measuredPanel.width || initialWidth, limits.minWidth, limits.maxWidth)
    const height = clamp(
      Math.max(measuredPanel.height, naturalHeightRef.current),
      limits.minHeight,
      limits.maxHeight,
    )
    const isMobile = viewport.width <= MOBILE_BREAKPOINT
    mobileRef.current = isMobile
    setMobile(isMobile)

    const next = isMobile
      ? dockForMobile()
      : clampGeometry(
          {
            x: limits.maxRight - width,
            y: limits.maxBottom - height,
            width,
            height,
          },
          limits,
        )
    if (!isMobile) desktopGeometryRef.current = next
    commitGeometry(next)
  }, [commitGeometry, dockForMobile, initialWidth, viewportMargin])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const measure = () => {
      resizeFrameRef.current = 0
      const current = geometryRef.current
      if (!current || !content.isConnected) return

      const nextNaturalHeight = Math.max(
        MIN_HEIGHT,
        Math.ceil(content.getBoundingClientRect().height + chromeHeightRef.current),
      )
      if (nextNaturalHeight === naturalHeightRef.current) {
        commitGeometry(
          mobileRef.current
            ? dockForMobile()
            : clampGeometry(current, limitsForViewport()),
        )
        return
      }

      naturalHeightRef.current = nextNaturalHeight
      if (mobileRef.current) {
        commitGeometry(dockForMobile())
        return
      }

      const limits = limitsForViewport()
      const desiredHeight = Math.max(preferredHeightRef.current ?? 0, nextNaturalHeight)
      const height = clamp(desiredHeight, limits.minHeight, limits.maxHeight)
      const previousBottom = current.y + current.height
      const viewportMiddle = limits.minY + (limits.maxBottom - limits.minY) * 0.5
      const y = current.y + current.height * 0.5 > viewportMiddle
        ? previousBottom - height
        : current.y
      const next = clampGeometry({ ...current, y, height }, limits)
      desktopGeometryRef.current = next
      commitGeometry(next)
    }

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = window.requestAnimationFrame(measure)
    }

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(content)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = 0
    }
  }, [commitGeometry, dockForMobile, limitsForViewport])

  useEffect(() => {
    const viewport = window.visualViewport
    const handleViewportChange = () => {
      finishInteraction()
      syncToViewport()
    }
    const handleBlur = () => finishInteraction()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('blur', handleBlur)
    viewport?.addEventListener('resize', handleViewportChange)
    viewport?.addEventListener('scroll', handleViewportChange)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('blur', handleBlur)
      viewport?.removeEventListener('resize', handleViewportChange)
      viewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [finishInteraction, syncToViewport])

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (mobileRef.current || interactionRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const target = event.target instanceof Element ? event.target : null
    const dragHandle = target?.closest('[data-drag-handle]')
    if (!dragHandle && target?.closest(INTERACTIVE_SELECTOR)) return
    if (event.pointerType !== 'mouse' && !dragHandle) return

    event.preventDefault()
    if (dragHandle instanceof HTMLElement) dragHandle.focus({ preventScroll: true })
    interactionRef.current = {
      kind: 'drag',
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setInteractionKind('drag')
  }

  const startResize = (edge: ResizeEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (mobileRef.current || interactionRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    interactionRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      edge,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    panelRef.current?.setPointerCapture(event.pointerId)
    setInteractionKind('resize')
  }

  const resizeBy = useCallback(
    (edge: ResizeEdge, dx: number, dy: number) => {
      const current = geometryRef.current
      if (!current || mobileRef.current) return
      const limits = limitsForViewport()
      let left = current.x
      let top = current.y
      let right = current.x + current.width
      let bottom = current.y + current.height

      if (edge.includes('w')) {
        left = clamp(
          left + dx,
          Math.max(limits.minX, right - limits.maxWidth),
          right - limits.minWidth,
        )
      } else if (edge.includes('e')) {
        right = clamp(
          right + dx,
          left + limits.minWidth,
          Math.min(limits.maxRight, left + limits.maxWidth),
        )
      }

      if (edge.includes('n')) {
        top = clamp(
          top + dy,
          Math.max(limits.minY, bottom - limits.maxHeight),
          bottom - limits.minHeight,
        )
      } else if (edge.includes('s')) {
        bottom = clamp(
          bottom + dy,
          top + limits.minHeight,
          Math.min(limits.maxBottom, top + limits.maxHeight),
        )
      }

      const next = clampGeometry(
        { x: left, y: top, width: right - left, height: bottom - top },
        limits,
      )
      if (edge.includes('n') || edge.includes('s')) {
        preferredHeightRef.current = next.height
      }
      desktopGeometryRef.current = next
      commitGeometry(next)
    },
    [commitGeometry, limitsForViewport],
  )

  const moveInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    const dx = event.clientX - interaction.lastX
    const dy = event.clientY - interaction.lastY
    /* Update the pointer origin even when geometry is clamped. Reversing away
       from an edge therefore moves immediately instead of first crossing the
       original grab point. */
    interaction.lastX = event.clientX
    interaction.lastY = event.clientY

    if (interaction.kind === 'drag') {
      const current = geometryRef.current
      if (!current) return
      const next = clampGeometry(
        { ...current, x: current.x + dx, y: current.y + dy },
        limitsForViewport(),
      )
      desktopGeometryRef.current = next
      commitGeometry(next)
    } else {
      resizeBy(interaction.edge, dx, dy)
    }
  }

  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (mobileRef.current || !geometryRef.current) return
    const step = event.shiftKey ? KEYBOARD_FINE_STEP : KEYBOARD_STEP
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -step
    else if (event.key === 'ArrowRight') dx = step
    else if (event.key === 'ArrowUp') dy = -step
    else if (event.key === 'ArrowDown') dy = step
    else if (event.key === 'Home') {
      event.preventDefault()
      const current = geometryRef.current
      const limits = limitsForViewport()
      const next = clampGeometry(
        {
          ...current,
          x: limits.maxRight - current.width,
          y: limits.maxBottom - current.height,
        },
        limits,
      )
      desktopGeometryRef.current = next
      commitGeometry(next)
      return
    } else return

    event.preventDefault()
    const current = geometryRef.current
    const next = clampGeometry(
      { ...current, x: current.x + dx, y: current.y + dy },
      limitsForViewport(),
    )
    desktopGeometryRef.current = next
    commitGeometry(next)
  }

  const resizeWithKeyboard = (edge: ResizeEdge, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? KEYBOARD_FINE_STEP : KEYBOARD_STEP
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -step
    else if (event.key === 'ArrowRight') dx = step
    else if (event.key === 'ArrowUp') dy = -step
    else if (event.key === 'ArrowDown') dy = step
    else return

    const changesWidth = edge.includes('e') || edge.includes('w')
    const changesHeight = edge.includes('n') || edge.includes('s')
    if ((!changesWidth && dx !== 0) || (!changesHeight && dy !== 0)) return
    event.preventDefault()
    resizeBy(edge, dx, dy)
  }

  const initialPanelStyle: CSSProperties = {
    position: 'fixed',
    right: viewportMargin,
    bottom: viewportMargin,
    width: `min(${initialWidth}px, calc(100vw - ${viewportMargin * 2}px))`,
    maxHeight: `calc(100vh - ${viewportMargin * 2}px)`,
    boxSizing: 'border-box',
    zIndex: 40,
  }
  const positionedPanelStyle: CSSProperties | undefined = geometry
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: geometry.width,
        height: geometry.height,
        boxSizing: 'border-box',
        transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0)`,
        transition: motionReduced || interactionKind ? 'none' : undefined,
        zIndex: 40,
      }
    : undefined

  return (
    <section
      ref={panelRef}
      className={`maia-floating-composer${mobile ? ' maia-floating-composer--mobile' : ''}${
        interactionKind === 'drag' ? ' maia-floating-composer--dragging' : ''
      }${interactionKind === 'resize' ? ' maia-floating-composer--resizing' : ''}${
        motionReduced ? ' maia-floating-composer--reduce-motion' : ''
      }`}
      style={positionedPanelStyle ?? initialPanelStyle}
      aria-label="Message Maia"
      data-mobile={mobile || undefined}
      data-dragging={interactionKind === 'drag' || undefined}
      data-resizing={interactionKind === 'resize' || undefined}
      onPointerDown={startDrag}
      onPointerMove={moveInteraction}
      onPointerUp={(event) => finishInteraction(event.pointerId)}
      onPointerCancel={(event) => finishInteraction(event.pointerId)}
      onLostPointerCapture={(event) => finishInteraction(event.pointerId)}
    >
      <div ref={contentRef} className="maia-floating-composer__content">
        <header className="maia-floating-composer__header">
          <span className="maia-floating-composer__identity">
            <MaiaMark size={24} />
            <span>
              <strong>Maia</strong>
              <small>Your friendly secretary</small>
            </span>
          </span>
          <button
            type="button"
            className="maia-floating-composer__drag-handle"
            data-drag-handle
            aria-label="Move message composer. Use the arrow keys to move it; press Home to reset its position."
            aria-hidden={mobile || undefined}
            style={{ touchAction: 'none' }}
            onKeyDown={moveWithKeyboard}
            disabled={mobile}
          >
            <span className="maia-floating-composer__drag-label">Move&nbsp; ⠿</span>
          </button>
        </header>
        <div className="maia-floating-composer__body">
          <MemoComposer {...composerProps} />
        </div>
        <footer className="maia-floating-composer__footer">
          <span>{composerProps.temporary ? 'Temporary conversation' : 'Connected to Maia'}</span>
          <span>{composerProps.streaming ? 'Maia is thinking' : 'Ready when you are'}</span>
        </footer>
      </div>

      {RESIZE_EDGES.map((edge) => (
        <button
          key={edge}
          type="button"
          className={`maia-floating-composer__resize-handle maia-floating-composer__resize-handle--${edge}`}
          data-resize-edge={edge}
          aria-label={`Resize message composer from the ${EDGE_LABELS[edge]}${
            geometry ? `. Current size ${Math.round(geometry.width)} by ${Math.round(geometry.height)} pixels` : ''
          }. Use the arrow keys; hold Shift for fine adjustments.`}
          aria-hidden={mobile || undefined}
          disabled={mobile}
          style={{
            position: 'absolute',
            zIndex: 1,
            margin: 0,
            padding: 0,
            border: 0,
            background: 'transparent',
            display: mobile ? 'none' : undefined,
            touchAction: 'none',
            ...HANDLE_STYLES[edge],
          }}
          onPointerDown={(event) => startResize(edge, event)}
          onKeyDown={(event) => resizeWithKeyboard(edge, event)}
        />
      ))}
    </section>
  )
}
