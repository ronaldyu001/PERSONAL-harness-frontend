import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

/**
 * Links out of the desktop shell.
 *
 * The webview has nowhere to put a new tab, so an anchor to the open web dies
 * silently there: the link renders, the click lands, and nothing moves. The
 * host's default browser is the tab the app doesn't have, so the click is
 * handed to it. In a browser the anchor already does the right thing and this
 * stays out of the way.
 */

const OPENABLE = /^(https?:|mailto:)/

function externalHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const anchor = target.closest('a[href]')
  if (!anchor) return null

  /* href resolves relative paths against the app's own origin, which the
     webview navigates on its own; only the open web needs handing off. */
  const href = anchor.getAttribute('href') ?? ''
  return OPENABLE.test(href) ? href : null
}

export function installExternalLinkHandler(): () => void {
  if (!isTauri()) return () => {}

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return
    const href = externalHref(event.target)
    if (!href) return

    event.preventDefault()
    /* A browser that refuses to open leaves the app as it was: the link is
       still on screen, still readable, still copyable. */
    openUrl(href).catch(() => {})
  }

  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
