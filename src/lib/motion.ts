import type { Variants } from 'motion/react'

/**
 * One vocabulary for every view that replaces another.
 *
 * §7 of DESIGN.md holds its shape: there is one authored moment, the face
 * re-registering, and everything else is state feedback in the 150–220ms
 * band. These are that band. They live here as shared values rather than as
 * numbers typed into three components, so a swap cannot read as a different
 * mechanism depending on which surface performed it.
 *
 * `--ease-standard` in the stylesheet is the same curve: fast departure, long
 * settle. The softness lives in the tail, which is what reads as composure.
 *
 * **Views travel on a rail.** Surfaces and the views inside them slide rather
 * than dissolve: what is arriving comes from the side it lives on and what is
 * leaving goes the other way, so a swap says which direction the reader moved
 * rather than only that something changed. The frame never moves — only its
 * contents do — and the distance is small enough that the panel reads as
 * exchanging its contents, not as a page turning.
 */

export const EASE_STANDARD = [0.32, 0.72, 0, 1] as const

/** Positive: the new surface arrives from the right. Negative: from the left. */
export type SlideDirection = 1 | -1

/* A surface is the whole width of the deck, so it travels further than a view
   inside one — but still a fraction of itself, never a full-width sweep. */
const SURFACE_TRAVEL = 34
const VIEW_TRAVEL = 18

/**
 * A whole surface arriving — the deck, or the bench that replaces it.
 *
 * Direction rides on `custom`, at the presence boundary as well as on the
 * child, so the outgoing surface leaves against the incoming one rather than
 * on the direction it happened to arrive with.
 */
export function surfaceSlide(reduceMotion: boolean): Variants {
  return {
    initial: (direction: SlideDirection) =>
      reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * SURFACE_TRAVEL },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: reduceMotion ? 0 : 0.28, ease: EASE_STANDARD },
    },
    exit: (direction: SlideDirection) => ({
      opacity: 0,
      x: reduceMotion ? 0 : direction * -SURFACE_TRAVEL,
      transition: { duration: reduceMotion ? 0 : 0.16, ease: EASE_STANDARD },
    }),
  }
}

/**
 * One view replacing another inside a panel that is staying put.
 *
 * Shorter travel than a surface, because the card around it did not move. The
 * exit is quicker than the entrance so the incoming view is never waiting on
 * the outgoing one.
 */
export function viewSlide(reduceMotion: boolean): Variants {
  return {
    initial: (direction: SlideDirection) =>
      reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * VIEW_TRAVEL },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: reduceMotion ? 0 : 0.22, ease: EASE_STANDARD },
    },
    exit: (direction: SlideDirection) => ({
      opacity: 0,
      x: reduceMotion ? 0 : direction * -VIEW_TRAVEL,
      transition: { duration: reduceMotion ? 0 : 0.13, ease: EASE_STANDARD },
    }),
  }
}

/**
 * A reading being replaced in place, with nothing to wait for.
 *
 * Used where the reader is moving quickly on purpose — down a ledger, row by
 * row — so there is no exit at all and no sideways travel: the rows run
 * vertically, and the record rises into the place the last one held. A slide
 * here would put a queue in front of the arrow keys.
 */
export function readingSwap(reduceMotion: boolean) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.16, ease: EASE_STANDARD },
  } as const
}
