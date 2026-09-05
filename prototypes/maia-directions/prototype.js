import { atelier, dayOffice, salon } from './round-three.js'

const variants = [salon, atelier, dayOffice]
const themeKeys = ['salon', 'atelier', 'dayoffice']
const colorModeStorageKey = 'maia-prototype-color-mode'
const themeStorageKey = 'maia-prototype-theme'
const conversationRuns = new WeakMap()
const composerFitters = new WeakMap()
const mindDiveDuration = 720
const conversationRevealProgress = 0.72
const particleFadeProgress = 0.86
const assistantReplies = [
  'I’m with you. I’ve set that thought here where we can work with it. We can shape the next step, make room in the schedule, or simply think it through together.',
  'That makes sense. I’ll keep hold of the thread while we sort what matters now from what can wait. What would feel most useful to settle first?',
  'I’ve got the next piece. We can take it gently and still leave with something concrete. Tell me where you’d like a little more clarity.',
]

function readColorMode() {
  try {
    const storedMode = localStorage.getItem(colorModeStorageKey)
    if (storedMode === 'light' || storedMode === 'dark') return storedMode
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  return 'dark'
}

function storeColorMode(mode) {
  try {
    localStorage.setItem(colorModeStorageKey, mode)
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }
}

function readStoredTheme() {
  try {
    const storedTheme = themeKeys.indexOf(localStorage.getItem(themeStorageKey))
    if (storedTheme >= 0) return storedTheme
  } catch {
    // The URL remains the source of truth when storage is unavailable.
  }
  return 0
}

function storeTheme(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme)
  } catch {
    // The URL still preserves the selected theme for this prototype.
  }
}

let colorMode = readColorMode()

function fitComposerInput(input) {
  composerFitters.get(input)?.()
}

function currentConcept() {
  return document.querySelector('.concept')
}

function closePanels(concept) {
  concept?.classList.remove('history-open', 'inspect-open')
}

function toggleAppearanceSettings(concept) {
  closePanels(concept)
  const settings = concept?.querySelector('.m3-settings')
  if (settings?.matches(':popover-open')) settings.hidePopover()
  else settings?.showPopover()
}

function syncAppearanceControls(concept) {
  concept?.querySelectorAll('[data-theme-choice]').forEach((input) => {
    input.checked = input.value === themeKeys[current]
  })
  concept?.querySelectorAll('[data-mode-choice]').forEach((input) => {
    input.checked = input.value === colorMode
  })
}

function applyColorMode(concept) {
  if (!concept) return
  concept.classList.toggle('alt-palette', colorMode === 'light')
  concept.dataset.colorMode = colorMode
  document.documentElement.style.colorScheme = colorMode
  syncAppearanceControls(concept)
}

function setColorMode(mode) {
  if (mode !== 'light' && mode !== 'dark') return
  colorMode = mode
  storeColorMode(mode)
  const concept = currentConcept()
  applyColorMode(concept)
  refreshMountedTheme()
}

function initSettingsPopover(concept) {
  const brand = concept?.querySelector('.m3-brand')
  const popover = concept?.querySelector('.m3-settings')
  const closeButton = popover?.querySelector('[popovertargetaction="hide"]')
  if (!brand || !popover || typeof popover.showPopover !== 'function') {
    return { dispose() {}, open() {} }
  }

  let restoreFocusOnClose = false

  function positionPopover() {
    const brandBounds = brand.getBoundingClientRect()
    const panelWidth = Math.min(304, window.innerWidth - 24)
    const left = Math.max(12, Math.min(brandBounds.left, window.innerWidth - panelWidth - 12))
    let top = brandBounds.bottom + 10
    const panelBounds = popover.getBoundingClientRect()
    if (panelBounds.height && top + panelBounds.height > window.innerHeight - 12) {
      top = Math.max(12, brandBounds.top - panelBounds.height - 10)
    }
    popover.style.setProperty('--m3-settings-left', `${Math.round(left)}px`)
    popover.style.setProperty('--m3-settings-top', `${Math.round(top)}px`)
  }

  function handleToggle(event) {
    const open = event.newState === 'open'
    brand.setAttribute('aria-expanded', String(open))
    concept.classList.toggle('settings-open', open)
    if (open) {
      requestAnimationFrame(() => {
        positionPopover()
        popover.querySelector('[data-theme-choice]:checked')?.focus({ preventScroll: true })
      })
    } else if (restoreFocusOnClose) {
      restoreFocusOnClose = false
      brand.focus({ preventScroll: true })
    }
  }

  function handleOutsidePointerDown(event) {
    if (!popover.matches(':popover-open')) return
    if (popover.contains(event.target) || brand.contains(event.target)) return
    popover.hidePopover()
  }

  function handleEscape(event) {
    if (event.key !== 'Escape' || !popover.matches(':popover-open')) return
    event.preventDefault()
    event.stopPropagation()
    restoreFocusOnClose = true
    popover.hidePopover()
  }

  function handleClose() {
    restoreFocusOnClose = true
  }

  function open() {
    positionPopover()
    if (!popover.matches(':popover-open')) popover.showPopover()
  }

  popover.addEventListener('toggle', handleToggle)
  closeButton?.addEventListener('click', handleClose)
  document.addEventListener('pointerdown', handleOutsidePointerDown, true)
  document.addEventListener('keydown', handleEscape, true)
  window.addEventListener('resize', positionPopover)

  return {
    open,
    dispose() {
      popover.removeEventListener('toggle', handleToggle)
      closeButton?.removeEventListener('click', handleClose)
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
      document.removeEventListener('keydown', handleEscape, true)
      window.removeEventListener('resize', positionPopover)
    },
  }
}

function nextConversationRun(concept) {
  const run = (conversationRuns.get(concept) || 0) + 1
  conversationRuns.set(concept, run)
  return run
}

function setComposerBusy(concept, busy) {
  const form = concept?.querySelector('.proto-composer')
  const input = form?.querySelector('textarea')
  const send = form?.querySelector('[data-action="send"]')
  if (busy) form?.setAttribute('aria-busy', 'true')
  else form?.removeAttribute('aria-busy')
  if (input) input.disabled = busy
  if (send) send.disabled = busy
}

function setViewExposure(concept, view) {
  const room = concept?.querySelector('.m3-room')
  const conversation = concept?.querySelector('.m3-conversation')
  const roomVisible = view === 'room'
  const conversationVisible = view === 'conversation'

  if (room) {
    room.inert = !roomVisible
    room.setAttribute('aria-hidden', String(!roomVisible))
  }
  if (conversation) {
    conversation.inert = !conversationVisible
    conversation.setAttribute('aria-hidden', String(!conversationVisible))
  }
}

function announceReply(concept, reply) {
  const announcer = concept?.querySelector('[data-live-announcer]')
  if (!announcer) return
  announcer.textContent = ''
  requestAnimationFrame(() => {
    if (announcer.isConnected) announcer.textContent = `Maia: ${reply}`
  })
}

function clearConversation(concept) {
  concept?.querySelector('[data-thread-list]')?.replaceChildren()
  const announcer = concept?.querySelector('[data-live-announcer]')
  if (announcer) announcer.textContent = ''
  const input = concept?.querySelector('.proto-composer textarea')
  if (input) {
    input.value = ''
    input.placeholder = input.dataset.landingPlaceholder || ''
    fitComposerInput(input)
  }
}

function appendConversationTurn(concept, value) {
  const list = concept.querySelector('[data-thread-list]')
  if (!list) return

  const turn = document.createElement('li')
  turn.className = 'm3-turn'

  const userMessage = document.createElement('p')
  userMessage.className = 'm3-turn-user'
  userMessage.textContent = value

  const maiaMessage = document.createElement('article')
  maiaMessage.className = 'm3-turn-maia'
  const messageHeader = document.createElement('header')
  const mark = concept.querySelector('.m3-chat .m3-emblem')?.cloneNode(true)
  if (mark) messageHeader.append(mark)
  const name = document.createElement('strong')
  name.textContent = 'Maia'
  const time = document.createElement('time')
  const now = new Date()
  time.dateTime = now.toISOString()
  time.textContent = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now)
  messageHeader.append(name, time)
  const response = document.createElement('p')
  response.textContent = assistantReplies[list.children.length % assistantReplies.length]
  maiaMessage.append(messageHeader, response)
  turn.append(userMessage, maiaMessage)
  if (concept.classList.contains('is-thread')) turn.classList.add('is-new')
  list.append(turn)
  const traceTurns = concept.querySelector('[data-trace-turns]')
  if (traceTurns) {
    const count = list.children.length
    traceTurns.textContent = `${count} conversation ${count === 1 ? 'turn' : 'turns'}`
  }

  requestAnimationFrame(() => {
    const shell = concept.querySelector('.m3-thread-shell')
    if (shell) shell.scrollTop = shell.scrollHeight
  })

  return response.textContent
}

async function resetConversation(concept, { cinematic = false } = {}) {
  if (!concept) return
  const run = nextConversationRun(concept)
  const hasConversation = concept.classList.contains('has-turn')
  closePanels(concept)

  if (!hasConversation) {
    await resetMountedConversation({ animate: false })
    concept.classList.remove('is-thread', 'is-thread-revealing', 'is-mind-entering', 'is-mind-leaving', 'is-room-hidden')
    clearConversation(concept)
    setViewExposure(concept, 'room')
    return
  }

  setComposerBusy(concept, true)
  setViewExposure(concept, 'transition')
  if (cinematic) {
    concept.classList.add('is-mind-leaving', 'is-room-hidden')
    concept.classList.remove('is-thread-revealing', 'is-mind-entering')
    concept.classList.remove('is-thread')
    void concept.offsetWidth
    const mindReset = resetMountedConversation({ animate: true })
    requestAnimationFrame(() => {
      if (concept.isConnected && conversationRuns.get(concept) === run) concept.classList.remove('is-room-hidden')
    })
    await mindReset
  } else {
    concept.classList.remove('is-thread', 'is-thread-revealing', 'is-mind-entering', 'is-mind-leaving', 'is-room-hidden')
    await resetMountedConversation({ animate: false })
  }

  if (!concept.isConnected || conversationRuns.get(concept) !== run) return
  concept.classList.remove('has-turn', 'is-mind-leaving', 'is-room-hidden')
  clearConversation(concept)
  setViewExposure(concept, 'room')
  setComposerBusy(concept, false)
  concept.querySelector('.proto-composer textarea')?.focus({ preventScroll: true })
}

async function sendCurrent(concept, { cinematic = true } = {}) {
  const input = concept?.querySelector('.proto-composer textarea')
  const value = input?.value.trim()
  if (!concept || !input || !value || input.disabled) return

  const firstTurn = !concept.classList.contains('has-turn')
  const run = nextConversationRun(concept)
  const reply = appendConversationTurn(concept, value)
  concept.classList.add('has-turn')
  closePanels(concept)
  input.value = ''
  input.placeholder = 'Reply to Maia…'
  fitComposerInput(input)

  if (!firstTurn) {
    announceReply(concept, reply)
    input.focus({ preventScroll: true })
    return
  }

  setComposerBusy(concept, true)
  setViewExposure(concept, 'transition')
  if (cinematic) concept.classList.add('is-mind-entering')
  const mindTransition = enterMountedConversation({ animate: cinematic })

  if (cinematic) {
    await Promise.race([
      mindTransition,
      waitForMountedConversationReveal(conversationRevealProgress),
    ])
    if (!concept.isConnected || conversationRuns.get(concept) !== run || concept.classList.contains('is-mind-leaving')) return
    concept.classList.add('is-thread-revealing')
    setViewExposure(concept, 'conversation')
    announceReply(concept, reply)
  }

  await mindTransition

  if (!concept.isConnected || conversationRuns.get(concept) !== run || concept.classList.contains('is-mind-leaving')) return
  concept.classList.add('is-thread')
  if (!cinematic) {
    setViewExposure(concept, 'conversation')
    announceReply(concept, reply)
    setComposerBusy(concept, false)
    input.focus({ preventScroll: true })
    return
  }
  concept.classList.remove('is-thread-revealing', 'is-mind-entering')
  setComposerBusy(concept, false)
  input.focus({ preventScroll: true })
}

document.getElementById('stage').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const concept = currentConcept()
  const action = button.dataset.action

  if (action === 'prompt') {
    const input = concept?.querySelector('.proto-composer textarea')
    if (input) {
      input.value = button.dataset.prompt || ''
      fitComposerInput(input)
      input.focus()
    }
    closePanels(concept)
  } else if (action === 'send') {
    event.preventDefault()
    sendCurrent(concept, { cinematic: event.detail > 0 })
  } else if (action === 'home' || action === 'new') {
    resetConversation(concept, { cinematic: event.detail > 0 })
    closePanels(concept)
  } else if (action === 'conversation') {
    closePanels(concept)
    concept?.querySelector('.proto-composer textarea')?.focus()
  } else if (action === 'history') {
    concept?.classList.toggle('history-open')
    concept?.classList.remove('inspect-open')
  } else if (action === 'investigate') {
    concept?.classList.toggle('inspect-open')
    concept?.classList.remove('history-open')
  } else if (action === 'settings') {
    event.preventDefault()
    toggleAppearanceSettings(concept)
  } else if (action === 'close-settings') {
    event.preventDefault()
    concept?.querySelector('.m3-settings')?.hidePopover()
  } else if (action === 'close-panel') {
    closePanels(concept)
  }
})

document.getElementById('stage').addEventListener('submit', (event) => {
  event.preventDefault()
  sendCurrent(currentConcept(), { cinematic: false })
})

document.getElementById('stage').addEventListener('input', (event) => {
  if (event.target.matches('.proto-composer textarea')) fitComposerInput(event.target)
})

document.getElementById('stage').addEventListener('change', (event) => {
  const themeChoice = event.target.closest('[data-theme-choice]')
  if (themeChoice) {
    const nextTheme = themeKeys.indexOf(themeChoice.value)
    if (nextTheme >= 0 && nextTheme !== current) setActive(nextTheme)
    return
  }

  const modeChoice = event.target.closest('[data-mode-choice]')
  if (modeChoice) setColorMode(modeChoice.value)
})

document.getElementById('stage').addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.m3-brand')) {
    event.preventDefault()
    toggleAppearanceSettings(currentConcept())
    return
  }

  if (event.key === 'Enter' && !event.shiftKey && event.target.matches('textarea')) {
    event.preventDefault()
    sendCurrent(currentConcept(), { cinematic: true })
  }
})

// `variants` is an array of render functions, one per variant, in picker order.
const stage = document.getElementById('stage');
const picker = document.querySelector('.proto-picker');
const highlight = picker.querySelector('.proto-picker-highlight');
const items = [...picker.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)')];
const replay = picker.querySelector('.proto-picker-replay');
let current = 0;
let mountFrame = 0;
let cleanupMountedAnimation = () => {};
let refreshMountedTheme = () => {};
let enterMountedConversation = () => Promise.resolve();
let resetMountedConversation = () => Promise.resolve();
let waitForMountedConversationReveal = () => Promise.resolve();

function initDraggableChat(concept) {
  const chat = concept?.querySelector('.m3-chat')
  const resizeHandles = [...(chat?.querySelectorAll('[data-resize-edge]') || [])]
  const input = chat?.querySelector('textarea')
  const entry = chat?.querySelector('.m3-chat-entry')
  const send = chat?.querySelector('[data-action="send"]')
  const main = concept?.querySelector('.m3-main')
  if (!chat || !input || !entry || !send || !main) return () => {}

  let drag = null
  let resizeDrag = null
  let clampFrame = 0
  let intrinsicTextHeight = 22

  const initialChatRect = chat.getBoundingClientRect()
  const initialConceptRect = concept.getBoundingClientRect()
  const initialEntryRect = entry.getBoundingClientRect()
  const initialInputRect = input.getBoundingClientRect()
  let sendHeight = send.getBoundingClientRect().height
  let fixedChromeHeight = initialChatRect.height - initialEntryRect.height
  let entryChromeHeight = initialEntryRect.height - Math.max(initialInputRect.height, sendHeight)
  let naturalMinHeight = initialChatRect.height
  const geometry = {
    x: initialChatRect.left - initialConceptRect.left,
    y: initialChatRect.top - initialConceptRect.top,
    width: initialChatRect.width,
    height: initialChatRect.height,
    userWidth: null,
    userHeight: null,
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value))
  }

  function measurePreferredWidth() {
    const previousWidth = chat.style.width
    chat.style.removeProperty('width')
    const preferredWidth = chat.getBoundingClientRect().width
    if (previousWidth) chat.style.width = previousWidth
    return preferredWidth
  }

  function measureChromeMetrics() {
    const previousChatHeight = chat.style.height
    const previousInputHeight = input.style.height
    const previousInputMinHeight = input.style.minHeight
    const previousOverflow = input.style.overflowY

    chat.style.height = 'auto'
    input.style.height = '22px'
    input.style.minHeight = '22px'
    input.style.overflowY = 'hidden'

    const chatRect = chat.getBoundingClientRect()
    const entryRect = entry.getBoundingClientRect()
    sendHeight = send.getBoundingClientRect().height
    fixedChromeHeight = chatRect.height - entryRect.height
    entryChromeHeight = entryRect.height - Math.max(22, sendHeight)
    naturalMinHeight = chatRect.height

    chat.style.height = previousChatHeight
    input.style.height = previousInputHeight
    input.style.minHeight = previousInputMinHeight
    input.style.overflowY = previousOverflow
  }

  function getLimits() {
    const minX = 12
    const minY = 12
    const maxRight = concept.clientWidth - 12
    const maxBottom = concept.clientHeight - 12
    const availableWidth = Math.max(1, maxRight - minX)
    const availableHeight = Math.max(1, maxBottom - minY)
    const maxWidth = Math.max(1, Math.min(620, availableWidth))
    return {
      minX,
      minY,
      maxRight,
      maxBottom,
      minWidth: Math.min(300, maxWidth),
      maxWidth,
      minHeight: Math.min(naturalMinHeight, availableHeight),
      maxHeight: availableHeight,
    }
  }

  function applyGeometry() {
    if (!chat.isConnected) return
    const limits = getLimits()
    geometry.width = clamp(geometry.width, limits.minWidth, limits.maxWidth)
    geometry.height = clamp(geometry.height, limits.minHeight, limits.maxHeight)
    geometry.x = clamp(geometry.x, limits.minX, Math.max(limits.minX, limits.maxRight - geometry.width))
    geometry.y = clamp(geometry.y, limits.minY, Math.max(limits.minY, limits.maxBottom - geometry.height))
    chat.dataset.x = String(geometry.x)
    chat.dataset.y = String(geometry.y)
    chat.style.width = `${geometry.width}px`
    chat.style.height = `${geometry.height}px`
    chat.style.transform = `translate3d(${geometry.x}px, ${geometry.y}px, 0)`
  }

  function measureIntrinsicText() {
    input.style.height = '0px'
    input.style.minHeight = '0px'
    intrinsicTextHeight = Math.max(22, input.scrollHeight)
    input.style.removeProperty('min-height')
    return intrinsicTextHeight
  }

  function getAutomaticHeight() {
    const maxTextHeight = Math.max(22, Math.min(240, main.clientHeight * 0.4))
    const textHeight = Math.min(intrinsicTextHeight, maxTextHeight)
    return Math.max(
      naturalMinHeight,
      fixedChromeHeight + entryChromeHeight + Math.max(sendHeight, textHeight),
    )
  }

  function syncInputHeight() {
    const availableHeight = Math.max(22, geometry.height - fixedChromeHeight - entryChromeHeight)
    const automaticTextHeight = Math.min(intrinsicTextHeight, Math.max(22, Math.min(240, main.clientHeight * 0.4)))
    const targetHeight = geometry.userHeight === null
      ? Math.min(availableHeight, automaticTextHeight)
      : availableHeight
    input.style.height = `${Math.max(22, targetHeight)}px`
    input.style.overflowY = intrinsicTextHeight > targetHeight + 1 ? 'auto' : 'hidden'
  }

  function fitInput() {
    if (!chat.isConnected) return
    const previousHeight = geometry.height
    const previousBottom = geometry.y + previousHeight
    measureIntrinsicText()
    const desiredHeight = Math.max(geometry.userHeight || 0, getAutomaticHeight())
    geometry.height = Math.min(desiredHeight, getLimits().maxHeight)

    const limits = getLimits()
    const viewportMidpoint = limits.minY + (limits.maxBottom - limits.minY) * 0.5
    if (geometry.y + previousHeight * 0.5 > viewportMidpoint) geometry.y = previousBottom - geometry.height

    applyGeometry()
    syncInputHeight()
  }

  chat.style.right = 'auto'
  chat.style.bottom = 'auto'
  chat.style.left = '0px'
  chat.style.top = '0px'
  measureChromeMetrics()
  applyGeometry()
  composerFitters.set(input, fitInput)
  fitInput()

  function clampGeometry() {
    clampFrame = 0
    if (!chat.isConnected) return
    if (geometry.userWidth === null) {
      const previousRight = geometry.x + geometry.width
      geometry.width = measurePreferredWidth()
      geometry.x = previousRight - geometry.width
    }
    applyGeometry()
    measureChromeMetrics()
    const limits = getLimits()
    if (geometry.userHeight !== null) geometry.userHeight = Math.min(geometry.userHeight, limits.maxHeight)
    applyGeometry()
    fitInput()
  }

  function scheduleClamp() {
    if (clampFrame) cancelAnimationFrame(clampFrame)
    clampFrame = requestAnimationFrame(clampGeometry)
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return
    const pointerId = drag.pointerId
    drag = null
    chat.classList.remove('is-dragging')
    if (chat.hasPointerCapture?.(pointerId)) chat.releasePointerCapture(pointerId)
  }

  function startDrag(event) {
    if (drag || resizeDrag || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target instanceof Element ? event.target : null
    const ownsPointer = target?.closest('textarea, input, select, button, a, label, [contenteditable], [role="button"], [role="link"], [data-resize-edge], [data-no-drag]')
    if (ownsPointer) return
    if (event.pointerType !== 'mouse' && !target?.closest('[data-drag-handle]')) return
    event.preventDefault()
    drag = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    chat.setPointerCapture(event.pointerId)
    chat.classList.add('is-dragging')
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return
    geometry.x += event.clientX - drag.lastX
    geometry.y += event.clientY - drag.lastY
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    applyGeometry()
  }

  function startResize(event) {
    if (resizeDrag || drag || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.stopPropagation()
    fitInput()
    const edge = event.currentTarget.dataset.resizeEdge
    resizeDrag = {
      pointerId: event.pointerId,
      handle: event.currentTarget,
      edge,
      lastX: event.clientX,
      lastY: event.clientY,
      minimumHeight: Math.max(getLimits().minHeight, getAutomaticHeight()),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    chat.classList.add('is-resizing')
  }

  function moveResize(event) {
    if (!resizeDrag || event.pointerId !== resizeDrag.pointerId) return
    const limits = getLimits()
    const dx = event.clientX - resizeDrag.lastX
    const dy = event.clientY - resizeDrag.lastY
    let left = geometry.x
    let top = geometry.y
    let right = geometry.x + geometry.width
    let bottom = geometry.y + geometry.height
    resizeDrag.lastX = event.clientX
    resizeDrag.lastY = event.clientY

    if (resizeDrag.edge.includes('w')) {
      left = clamp(
        left + dx,
        Math.max(limits.minX, right - limits.maxWidth),
        right - limits.minWidth,
      )
    } else if (resizeDrag.edge.includes('e')) {
      right = clamp(
        right + dx,
        left + limits.minWidth,
        Math.min(limits.maxRight, left + limits.maxWidth),
      )
    }

    if (resizeDrag.edge.includes('n')) {
      top = clamp(
        top + dy,
        limits.minY,
        bottom - resizeDrag.minimumHeight,
      )
    } else if (resizeDrag.edge.includes('s')) {
      bottom = clamp(
        bottom + dy,
        top + resizeDrag.minimumHeight,
        limits.maxBottom,
      )
    }

    geometry.x = left
    geometry.y = top
    geometry.width = right - left
    geometry.height = bottom - top
    const resizingWidth = resizeDrag.edge.includes('e') || resizeDrag.edge.includes('w')
    const resizingHeight = resizeDrag.edge.includes('n') || resizeDrag.edge.includes('s')
    if (resizingWidth) geometry.userWidth = geometry.width
    if (resizingHeight) geometry.userHeight = geometry.height
    applyGeometry()
    if (resizingWidth) {
      measureIntrinsicText()
      if (resizingHeight) {
        const requiredHeight = Math.min(getAutomaticHeight(), getLimits().maxHeight)
        if (geometry.height < requiredHeight) {
          if (resizeDrag.edge.includes('n')) geometry.y = bottom - requiredHeight
          geometry.height = requiredHeight
          applyGeometry()
        }
      }
    }
    if (resizingWidth && !resizingHeight) fitInput()
    else syncInputHeight()
  }

  function finishResize(event) {
    if (!resizeDrag || event.pointerId !== resizeDrag.pointerId) return
    const { handle: resizeHandle, pointerId } = resizeDrag
    resizeDrag = null
    chat.classList.remove('is-resizing')
    if (resizeHandle.hasPointerCapture?.(pointerId)) resizeHandle.releasePointerCapture(pointerId)
    fitInput()
  }

  function cancelInteractions() {
    const dragPointerId = drag?.pointerId
    const resizePointerId = resizeDrag?.pointerId
    const activeResizeHandle = resizeDrag?.handle
    drag = null
    resizeDrag = null
    chat.classList.remove('is-dragging', 'is-resizing')
    if (dragPointerId !== undefined && chat.hasPointerCapture?.(dragPointerId)) {
      chat.releasePointerCapture(dragPointerId)
    }
    if (resizePointerId !== undefined && activeResizeHandle?.hasPointerCapture?.(resizePointerId)) {
      activeResizeHandle.releasePointerCapture(resizePointerId)
    }
  }

  function resizeWithKeyboard(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 4 : 16
    if (event.key === 'ArrowLeft') {
      geometry.width -= step
      geometry.userWidth = geometry.width
    } else if (event.key === 'ArrowRight') {
      geometry.width += step
      geometry.userWidth = geometry.width
    } else if (event.key === 'ArrowUp') {
      geometry.height -= step
      geometry.userHeight = geometry.height
    } else {
      geometry.height += step
      geometry.userHeight = geometry.height
    }
    applyGeometry()
    fitInput()
  }

  chat.addEventListener('pointerdown', startDrag)
  chat.addEventListener('pointermove', moveDrag)
  chat.addEventListener('pointerup', finishDrag)
  chat.addEventListener('pointercancel', finishDrag)
  chat.addEventListener('lostpointercapture', finishDrag)
  resizeHandles.forEach((resizeHandle) => {
    resizeHandle.addEventListener('pointerdown', startResize)
    resizeHandle.addEventListener('pointermove', moveResize)
    resizeHandle.addEventListener('pointerup', finishResize)
    resizeHandle.addEventListener('pointercancel', finishResize)
    resizeHandle.addEventListener('lostpointercapture', finishResize)
    resizeHandle.addEventListener('keydown', resizeWithKeyboard)
  })
  window.addEventListener('blur', cancelInteractions)
  window.addEventListener('resize', scheduleClamp)
  const resizeObserver = new ResizeObserver(scheduleClamp)
  resizeObserver.observe(concept)
  resizeObserver.observe(main)

  return () => {
    if (clampFrame) cancelAnimationFrame(clampFrame)
    composerFitters.delete(input)
    window.removeEventListener('blur', cancelInteractions)
    window.removeEventListener('resize', scheduleClamp)
    resizeObserver.disconnect()
    chat.removeEventListener('pointerdown', startDrag)
    chat.removeEventListener('pointermove', moveDrag)
    chat.removeEventListener('pointerup', finishDrag)
    chat.removeEventListener('pointercancel', finishDrag)
    chat.removeEventListener('lostpointercapture', finishDrag)
    resizeHandles.forEach((resizeHandle) => {
      resizeHandle.removeEventListener('pointerdown', startResize)
      resizeHandle.removeEventListener('pointermove', moveResize)
      resizeHandle.removeEventListener('pointerup', finishResize)
      resizeHandle.removeEventListener('pointercancel', finishResize)
      resizeHandle.removeEventListener('lostpointercapture', finishResize)
      resizeHandle.removeEventListener('keydown', resizeWithKeyboard)
    })
  }
}

function seededUnit(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function createSphereParticles(count) {
  const random = seededUnit(0x4d414941)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const z = new Float32Array(count)
  const size = new Float32Array(count)
  const phaseSin = new Float32Array(count)
  const phaseCos = new Float32Array(count)
  const tone = new Uint8Array(count)
  const alphaBand = new Uint8Array(count)
  const fleck = new Uint8Array(count)

  for (let index = 0; index < count; index += 1) {
    const vertical = 1 - 2 * ((index + 0.5) / count)
    const ring = Math.sqrt(Math.max(0, 1 - vertical * vertical))
    const theta = index * goldenAngle + (random() - 0.5) * 0.16
    const densitySlot = index % 20
    const centerBiased = densitySlot >= 1 && densitySlot <= 15
    const outerMote = densitySlot === 0
    const radialSample = random()
    const radius = outerMote
      ? 1 + radialSample * 0.12
      : centerBiased
        ? Math.pow(radialSample, 1.05)
        : Math.cbrt(radialSample)
    const bulge = 1 + 0.035 * Math.sin(theta * 2.6 + vertical * 2)
    const phase = random() * Math.PI * 2

    x[index] = radius * ring * Math.cos(theta) * bulge
    y[index] = radius * vertical * 0.94
    z[index] = radius * ring * Math.sin(theta) * bulge
    size[index] = (0.44 + Math.pow(random(), 2.6) * 0.98) * (centerBiased ? 0.9 + radius * 0.04 : 1)
    phaseSin[index] = Math.sin(phase)
    phaseCos[index] = Math.cos(phase)
    tone[index] = random() > 0.24 ? 0 : 1
    alphaBand[index] = outerMote ? 0 : Math.min(2, Math.floor(random() * 3))
    fleck[index] = index % 8 === 3 ? 1 : 0
  }

  return { count, x, y, z, size, phaseSin, phaseCos, tone, alphaBand, fleck }
}

function initParticleSphere(concept) {
  const main = concept?.querySelector('.m3-main')
  const art = concept?.querySelector('.m3-art')
  const canvas = concept?.querySelector('[data-particle-sphere]')
  const context = canvas?.getContext('2d', { alpha: true, desynchronized: true })
  if (!main || !art || !canvas || !context) {
    return {
      dispose() {},
      refreshTheme() {},
      enterConversation() { return Promise.resolve() },
      resetHome() { return Promise.resolve() },
      waitForReveal() { return Promise.resolve() },
    }
  }

  const particleData = createSphereParticles(4800)
  const projectedX = new Float32Array(particleData.count)
  const projectedY = new Float32Array(particleData.count)
  const projectedRadius = new Float32Array(particleData.count)
  const anchorWeight = new Float32Array(particleData.count)
  const bucketHeads = new Int32Array(48)
  const bucketNext = new Int32Array(particleData.count)
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const spring = { mass: 1, stiffness: 100, damping: 20 }
  const pointerState = { x: 0, y: 0, strength: 0, xVelocity: 0, yVelocity: 0, strengthVelocity: 0 }
  const pointerTarget = { x: 0, y: 0, strength: 0 }
  const alphaLevels = [0.3, 0.62, 1]
  let colors = ['#091f21', '#292923']
  let alphaScale = 1
  let width = 1
  let height = 1
  let pixelRatio = 1
  let artBounds = art.getBoundingClientRect()
  let frame = 0
  let previousTime = 0
  let lastPaint = 0
  let elapsed = 0
  let rotation = -0.38
  let fastUntil = 0
  let pointerEngaged = false
  let visible = true
  let disposed = false
  let mindAnimation = null
  let mindPromise = Promise.resolve()
  let mindRun = 0
  let mindState = 'home'
  const mindDiveEnd = mindDiveDuration

  function refreshTheme() {
    const styles = getComputedStyle(concept)
    colors = [styles.getPropertyValue('--m3-dust-bright').trim(), styles.getPropertyValue('--m3-dust-silver').trim()]
    const lightPalette = concept.classList.contains('alt-palette')
    alphaScale = lightPalette ? 0.76 : 0.48
    drawFrame()
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth)
    height = Math.max(1, canvas.clientHeight)
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    artBounds = art.getBoundingClientRect()
    drawFrame()
  }

  function getMindProgress() {
    if (mindState === 'conversation') return 1
    if (!mindAnimation) return 0
    const progress = mindAnimation.effect?.getComputedTiming().progress
    return typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : 0
  }

  function waitForReveal(targetProgress = 0.5) {
    if (disposed || reducedMotion.matches || mindState === 'conversation') return Promise.resolve()
    const run = mindRun

    return new Promise((resolve) => {
      function checkProgress() {
        if (disposed || mindRun !== run || mindState !== 'diving' || getMindProgress() >= targetProgress) {
          resolve()
          return
        }
        requestAnimationFrame(checkProgress)
      }

      checkProgress()
    })
  }

  function projectParticles() {
    const waveSin = Math.sin(elapsed * 0.52)
    const waveCos = Math.cos(elapsed * 0.52)
    const yaw = rotation
    const pitch = Math.sin(elapsed * 0.22) * 0.05
    const cosYaw = Math.cos(yaw)
    const sinYaw = Math.sin(yaw)
    const cosPitch = Math.cos(pitch)
    const sinPitch = Math.sin(pitch)
    const radius = Math.min(width, height) * 0.35
    const centerX = width * 0.62
    const centerY = height * 0.5
    const waveAmount = 0.008
    const mindProgress = getMindProgress()
    const travelProgress = mindProgress * (0.72 + mindProgress * 0.78)
    const pointerStrength = Math.max(0, Math.min(1, pointerState.strength)) * (1 - mindProgress)
    const attractionRange = radius * 0.62
    const attractionRangeSquared = attractionRange * attractionRange
    const nucleusRange = radius * 0.2
    const nucleusRangeSquared = nucleusRange * nucleusRange
    let pullSumX = 0
    let pullSumY = 0
    let anchorWeightSum = 0

    bucketHeads.fill(-1)

    for (let index = 0; index < particleData.count; index += 1) {
      const wave = 1 + waveAmount * (particleData.phaseSin[index] * waveCos + particleData.phaseCos[index] * waveSin)
      const baseX = particleData.x[index] * wave
      const baseY = particleData.y[index] * wave
      const baseZ = particleData.z[index] * wave
      const yawX = baseX * cosYaw + baseZ * sinYaw
      const yawZ = -baseX * sinYaw + baseZ * cosYaw
      const pitchY = baseY * cosPitch - yawZ * sinPitch
      const pitchZ = baseY * sinPitch + yawZ * cosPitch
      const perspective = 1 / (1 - pitchZ * 0.14)
      const depth = Math.max(0, Math.min(1, (pitchZ + 1) * 0.5))
      const depthBucket = Math.min(7, Math.floor(depth * 8))
      const bucket = ((depthBucket * 2 + particleData.tone[index]) * 3) + particleData.alphaBand[index]
      const projectedBaseX = yawX * radius * perspective
      const projectedBaseY = pitchY * radius * perspective
      const radialLength = Math.hypot(projectedBaseX, projectedBaseY)
      const radialDistanceSquared = radialLength * radialLength
      const radialProgress = Math.min(1, radialLength / radius)
      const particleAnchorWeight = 0.25 + 0.75 * radialProgress * radialProgress
      const nucleusDampener = 0.68 + 0.32 * (radialDistanceSquared / (radialDistanceSquared + nucleusRangeSquared))
      const directionX = radialLength > 0.5 ? projectedBaseX / radialLength : particleData.phaseCos[index]
      const directionY = radialLength > 0.5 ? projectedBaseY / radialLength : particleData.phaseSin[index]
      const tangentX = -directionY
      const tangentY = directionX
      const disperseDistance = radius * travelProgress * (0.74 + depth * 0.7 + Math.abs(particleData.phaseSin[index]) * 0.18)
      const shearDistance = radius * travelProgress * particleData.phaseCos[index] * 0.12

      let particleX = centerX + projectedBaseX + directionX * disperseDistance + tangentX * shearDistance
      let particleY = centerY + projectedBaseY + directionY * disperseDistance + tangentY * shearDistance

      if (pointerStrength > 0.001) {
        const pointerDeltaX = pointerState.x - particleX
        const pointerDeltaY = pointerState.y - particleY
        const distanceSquared = pointerDeltaX * pointerDeltaX + pointerDeltaY * pointerDeltaY
        const falloff = 1 / (1 + distanceSquared / attractionRangeSquared)
        const depthGain = 0.72 + depth * 0.28
        const particleVariation = 0.94 + particleData.phaseSin[index] * 0.06
        const pull = falloff * pointerStrength * depthGain * particleVariation * nucleusDampener * 0.2
        const pullX = pointerDeltaX * pull
        const pullY = pointerDeltaY * pull
        particleX += pullX
        particleY += pullY
        pullSumX += pullX
        pullSumY += pullY
      }

      projectedX[index] = particleX
      projectedY[index] = particleY
      projectedRadius[index] = particleData.size[index] * perspective * (0.68 + depth * 0.7) * (1 - mindProgress * 0.2)
      anchorWeight[index] = particleAnchorWeight
      anchorWeightSum += particleAnchorWeight
      bucketNext[index] = bucketHeads[bucket]
      bucketHeads[bucket] = index
    }

    if (pointerStrength > 0.001 && anchorWeightSum > 0) {
      const compensateX = pullSumX / anchorWeightSum
      const compensateY = pullSumY / anchorWeightSum
      for (let index = 0; index < particleData.count; index += 1) {
        projectedX[index] -= compensateX * anchorWeight[index]
        projectedY[index] -= compensateY * anchorWeight[index]
      }
    }
  }

  function drawFrame() {
    context.clearRect(0, 0, width, height)
    projectParticles()

    for (let depth = 0; depth < 8; depth += 1) {
      for (let tone = 0; tone < 2; tone += 1) {
        context.fillStyle = colors[tone]
        for (let alphaBand = 0; alphaBand < 3; alphaBand += 1) {
          const bucket = ((depth * 2 + tone) * 3) + alphaBand
          const depthAlpha = 0.34 + ((depth + 0.5) / 8) * 0.66
          context.globalAlpha = alphaLevels[alphaBand] * depthAlpha * alphaScale
          context.beginPath()

          for (let index = bucketHeads[bucket]; index !== -1; index = bucketNext[index]) {
            const radius = projectedRadius[index]
            if (particleData.fleck[index]) {
              const angle = Math.atan2(projectedY[index] - height * 0.5, projectedX[index] - width * 0.62) + Math.PI * 0.5
              const longRadius = radius * 1.6
              context.moveTo(projectedX[index] + Math.cos(angle) * longRadius, projectedY[index] + Math.sin(angle) * longRadius)
              context.ellipse(projectedX[index], projectedY[index], longRadius, radius * 0.58, angle, 0, Math.PI * 2)
            } else {
              context.moveTo(projectedX[index] + radius, projectedY[index])
              context.arc(projectedX[index], projectedY[index], radius, 0, Math.PI * 2)
            }
          }

          context.fill()
        }
      }
    }

    context.globalAlpha = 1
  }

  function integratePointerSpring(dt) {
    const xAcceleration = (-spring.stiffness * (pointerState.x - pointerTarget.x) - spring.damping * pointerState.xVelocity) / spring.mass
    const yAcceleration = (-spring.stiffness * (pointerState.y - pointerTarget.y) - spring.damping * pointerState.yVelocity) / spring.mass
    const strengthAcceleration = (-spring.stiffness * (pointerState.strength - pointerTarget.strength) - spring.damping * pointerState.strengthVelocity) / spring.mass
    pointerState.xVelocity += xAcceleration * dt
    pointerState.yVelocity += yAcceleration * dt
    pointerState.strengthVelocity += strengthAcceleration * dt
    pointerState.x += pointerState.xVelocity * dt
    pointerState.y += pointerState.yVelocity * dt
    pointerState.strength += pointerState.strengthVelocity * dt

    if (pointerState.strength < 0) {
      pointerState.strength = 0
      pointerState.strengthVelocity = 0
    } else if (pointerState.strength > 1.05) {
      pointerState.strength = 1.05
      pointerState.strengthVelocity = 0
    }
  }

  function tick(time) {
    if (disposed || !canvas.isConnected) return
    frame = requestAnimationFrame(tick)
    const springMoving = Math.abs(pointerState.x - pointerTarget.x) + Math.abs(pointerState.y - pointerTarget.y) + Math.abs(pointerState.strength - pointerTarget.strength) + Math.abs(pointerState.xVelocity) + Math.abs(pointerState.yVelocity) + Math.abs(pointerState.strengthVelocity) > 0.01
    const interactionActive = time < fastUntil || springMoving
    const idleInterval = 1000 / 30
    if (!interactionActive && time - lastPaint < idleInterval - 1) return

    const dt = Math.min((time - previousTime) / 1000 || 0.016, 0.05)
    previousTime = time
    lastPaint = time
    elapsed += dt
    integratePointerSpring(dt)
    rotation += dt * 0.027
    drawFrame()
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function start() {
    if (frame || disposed || reducedMotion.matches || document.hidden || !visible || mindState === 'conversation') return
    previousTime = performance.now()
    lastPaint = 0
    frame = requestAnimationFrame(tick)
  }

  function resetPointer() {
    pointerEngaged = false
    pointerTarget.strength = 0
    fastUntil = performance.now() + 900
  }

  function handlePointerMove(event) {
    if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches || mindState !== 'home') return
    const x = (event.clientX - artBounds.left) * (width / artBounds.width)
    const y = (event.clientY - artBounds.top) * (height / artBounds.height)

    if (!pointerEngaged) {
      if (pointerState.strength < 0.05) {
        pointerState.x = x
        pointerState.y = y
        pointerState.xVelocity = 0
        pointerState.yVelocity = 0
      }
      pointerEngaged = true
    }

    pointerTarget.x = x
    pointerTarget.y = y
    pointerTarget.strength = 1
    fastUntil = performance.now() + 900
  }

  function handlePointerEnter() {
    artBounds = art.getBoundingClientRect()
  }

  function handleVisibility() {
    if (document.hidden) {
      if (mindAnimation && (mindState === 'diving' || mindState === 'returning')) mindAnimation.finish()
      stop()
    }
    else start()
  }

  function handleMotionPreference() {
    if (reducedMotion.matches) {
      if (mindAnimation && (mindState === 'diving' || mindState === 'returning')) mindAnimation.finish()
      stop()
      resetPointer()
      pointerState.strength = 0
      pointerState.xVelocity = 0
      pointerState.yVelocity = 0
      pointerState.strengthVelocity = 0
      elapsed = 0
      rotation = -0.38
      drawFrame()
    } else {
      start()
    }
  }

  function handlePointerCapability() {
    if (!finePointer.matches) resetPointer()
  }

  function createMindAnimation() {
    return art.animate(
      [
        { offset: 0, opacity: 1 },
        { offset: particleFadeProgress, opacity: 1 },
        { offset: 1, opacity: 0 },
      ],
      {
        duration: mindDiveDuration,
        easing: 'linear',
        fill: 'both',
      },
    )
  }

  function watchMindAnimation(animation, targetState) {
    const run = ++mindRun
    mindPromise = animation.finished
      .then(() => {
        if (disposed || run !== mindRun || mindAnimation !== animation) return
        mindState = targetState
        if (targetState === 'conversation') {
          stop()
        } else {
          animation.cancel()
          mindAnimation = null
          art.style.removeProperty('opacity')
          resize()
          start()
        }
      })
      .catch(() => {})
    return mindPromise
  }

  function enterConversation({ animate = true } = {}) {
    if (mindState === 'conversation') return Promise.resolve()
    if (mindState === 'diving') return mindPromise
    resetPointer()

    if (!animate || reducedMotion.matches) {
      mindRun += 1
      mindAnimation?.cancel()
      mindAnimation = null
      art.style.opacity = '0'
      mindState = 'conversation'
      stop()
      return Promise.resolve()
    }

    art.style.removeProperty('opacity')
    if (!mindAnimation || mindAnimation.playState === 'idle') mindAnimation = createMindAnimation()
    else {
      mindAnimation.playbackRate = 1
      mindAnimation.play()
    }
    mindState = 'diving'
    return watchMindAnimation(mindAnimation, 'conversation')
  }

  function resetHome({ animate = true } = {}) {
    if (mindState === 'home') return Promise.resolve()
    if (mindState === 'returning') return mindPromise
    resetPointer()

    if (!animate || reducedMotion.matches) {
      mindRun += 1
      mindAnimation?.cancel()
      mindAnimation = null
      art.style.removeProperty('opacity')
      mindState = 'home'
      resize()
      start()
      return Promise.resolve()
    }

    art.style.removeProperty('opacity')
    resize()
    if (!mindAnimation || mindAnimation.playState === 'idle') {
      mindAnimation = createMindAnimation()
      mindAnimation.pause()
      mindAnimation.currentTime = mindDiveEnd
    }
    mindAnimation.playbackRate = -1
    mindAnimation.play()
    mindState = 'returning'
    start()
    return watchMindAnimation(mindAnimation, 'home')
  }

  const resizeObserver = new ResizeObserver(resize)
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) start()
    else stop()
  })

  resizeObserver.observe(art)
  intersectionObserver.observe(art)
  main.addEventListener('pointerenter', handlePointerEnter)
  main.addEventListener('pointermove', handlePointerMove)
  main.addEventListener('pointerleave', resetPointer)
  document.addEventListener('visibilitychange', handleVisibility)
  finePointer.addEventListener?.('change', handlePointerCapability)
  reducedMotion.addEventListener?.('change', handleMotionPreference)
  refreshTheme()
  resize()
  start()

  return {
    refreshTheme,
    enterConversation,
    resetHome,
    waitForReveal,
    dispose() {
      disposed = true
      mindRun += 1
      mindAnimation?.cancel()
      stop()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      main.removeEventListener('pointerenter', handlePointerEnter)
      main.removeEventListener('pointermove', handlePointerMove)
      main.removeEventListener('pointerleave', resetPointer)
      document.removeEventListener('visibilitychange', handleVisibility)
      finePointer.removeEventListener?.('change', handlePointerCapability)
      reducedMotion.removeEventListener?.('change', handleMotionPreference)
    },
  }
}

function initBrandPressMotion(concept) {
  const brand = concept?.querySelector('.m3-brand')
  if (!brand) return () => {}

  const minimumPressDuration = 140
  let pressedAt = 0
  let releaseTimer = 0

  function beginPress() {
    if (releaseTimer) window.clearTimeout(releaseTimer)
    pressedAt = performance.now()
    brand.classList.add('is-pressing')
  }

  function endPress() {
    if (!brand.classList.contains('is-pressing')) return
    const remaining = Math.max(0, minimumPressDuration - (performance.now() - pressedAt))
    if (releaseTimer) window.clearTimeout(releaseTimer)
    releaseTimer = window.setTimeout(() => {
      brand.classList.remove('is-pressing')
      releaseTimer = 0
    }, remaining)
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    beginPress()
  }

  function handleKeyDown(event) {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) beginPress()
  }

  function handleKeyUp(event) {
    if (event.key === 'Enter' || event.key === ' ') endPress()
  }

  brand.addEventListener('pointerdown', handlePointerDown)
  brand.addEventListener('pointerup', endPress)
  brand.addEventListener('pointercancel', endPress)
  brand.addEventListener('pointerleave', endPress)
  brand.addEventListener('keydown', handleKeyDown)
  brand.addEventListener('keyup', handleKeyUp)
  brand.addEventListener('blur', endPress)

  return () => {
    if (releaseTimer) window.clearTimeout(releaseTimer)
    brand.classList.remove('is-pressing')
    brand.removeEventListener('pointerdown', handlePointerDown)
    brand.removeEventListener('pointerup', endPress)
    brand.removeEventListener('pointercancel', endPress)
    brand.removeEventListener('pointerleave', endPress)
    brand.removeEventListener('keydown', handleKeyDown)
    brand.removeEventListener('keyup', handleKeyUp)
    brand.removeEventListener('blur', endPress)
  }
}

function moveHighlight() {
  const el = items[current];
  highlight.style.width = el.offsetWidth + 'px';
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
}

function mount(i) {
  cleanupMountedAnimation()
  cleanupMountedAnimation = () => {}
  refreshMountedTheme = () => {}
  enterMountedConversation = () => Promise.resolve()
  resetMountedConversation = () => Promise.resolve()
  waitForMountedConversationReveal = () => Promise.resolve()
  if (mountFrame) cancelAnimationFrame(mountFrame)
  stage.innerHTML = '';
  // Clear first, render next frame, so entrance animations re-run.
  mountFrame = requestAnimationFrame(() => {
    stage.innerHTML = variants[i]();
    const concept = currentConcept()
    applyColorMode(concept)
    setViewExposure(concept, 'room')
    const cleanupChat = initDraggableChat(concept)
    const sphere = initParticleSphere(concept)
    const cleanupBrandPress = initBrandPressMotion(concept)
    const settingsPopover = initSettingsPopover(concept)
    refreshMountedTheme = sphere.refreshTheme
    enterMountedConversation = sphere.enterConversation
    resetMountedConversation = sphere.resetHome
    waitForMountedConversationReveal = sphere.waitForReveal
    cleanupMountedAnimation = () => {
      sphere.dispose()
      settingsPopover.dispose()
      cleanupBrandPress()
      cleanupChat()
    }
    mountFrame = 0
  });
}

function setActive(i) {
  if (i < 0 || i >= variants.length) return;
  current = i;
  storeTheme(themeKeys[i])
  items.forEach((el, j) => {
    el.toggleAttribute('data-active', j === i);
    if (j === i) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  moveHighlight();
  const url = new URL(location);
  url.searchParams.set('v', i + 1);
  history.replaceState(null, '', url);
  const concept = currentConcept()
  if (!concept) {
    mount(i)
    return
  }

  concept.classList.remove(...themeKeys.map((theme) => `concept-${theme}`))
  concept.classList.add(`concept-${themeKeys[i]}`)
  concept.setAttribute('aria-label', `${items[i].textContent.trim()} design direction`)
  syncAppearanceControls(concept)
  refreshMountedTheme()
}

items.forEach((el, i) => el.addEventListener('click', () => setActive(i)));
replay?.addEventListener('click', () => mount(current));
window.addEventListener('resize', moveHighlight);

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= variants.length) setActive(num - 1);
  else if (e.key === 'ArrowRight') setActive((current + 1) % variants.length);
  else if (e.key === 'ArrowLeft') setActive((current - 1 + variants.length) % variants.length);
  else if (e.key === 'r' || e.key === 'R') mount(current);
});

const requestedTheme = parseInt(new URLSearchParams(location.search).get('v'), 10) - 1
setActive(requestedTheme >= 0 && requestedTheme < variants.length ? requestedTheme : readStoredTheme());
// Enable the slide only after first paint, so load doesn't animate.
requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute('data-ready', '')));
