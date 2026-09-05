import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 4_800
const DEPTH_STEPS = 8
const TONE_COUNT = 2
const ALPHA_BANDS = 3
const BUCKET_COUNT = DEPTH_STEPS * TONE_COUNT * ALPHA_BANDS
const TRANSITION_DURATION = 720
const PARTICLE_FADE_START = 0.86
const MAX_PIXEL_RATIO = 1.5

const SPRING = { mass: 1, stiffness: 100, damping: 20 } as const
const ALPHA_LEVELS = [0.3, 0.62, 1] as const

export type ParticleSphereState = 'landing' | 'entering' | 'conversation' | 'leaving'

export interface ParticleSphereProps {
  state: ParticleSphereState
  reduceMotion: boolean
  className?: string
}

interface ParticleData {
  count: number
  x: Float32Array
  y: Float32Array
  z: Float32Array
  size: Float32Array
  phaseSin: Float32Array
  phaseCos: Float32Array
  tone: Uint8Array
  alphaBand: Uint8Array
  fleck: Uint8Array
}

interface ProgressTransition {
  from: number
  to: number
  startedAt: number
  duration: number
}

interface ParticleSphereEngine {
  setState: (state: ParticleSphereState) => void
  setReduceMotion: (reduceMotion: boolean) => void
  destroy: () => void
}

function seededUnit(seed: number) {
  let value = seed >>> 0

  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296
  }
}

function createSphereParticles(count: number): ParticleData {
  // This seed fixes only the decorative composition; it never represents app data.
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
    size[index] =
      (0.44 + Math.pow(random(), 2.6) * 0.98) * (centerBiased ? 0.9 + radius * 0.04 : 1)
    phaseSin[index] = Math.sin(phase)
    phaseCos[index] = Math.cos(phase)
    tone[index] = random() > 0.24 ? 0 : 1
    alphaBand[index] = outerMote ? 0 : Math.min(2, Math.floor(random() * 3))
    fleck[index] = index % 8 === 3 ? 1 : 0
  }

  return { count, x, y, z, size, phaseSin, phaseCos, tone, alphaBand, fleck }
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value))
}

function targetProgressFor(state: ParticleSphereState) {
  return state === 'entering' || state === 'conversation' ? 1 : 0
}

function readProperty(styles: CSSStyleDeclaration, ...names: string[]) {
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim()
    if (value) return value
  }

  return ''
}

function createParticleSphereEngine(
  canvas: HTMLCanvasElement,
  initialState: ParticleSphereState,
  initialReduceMotion: boolean,
): ParticleSphereEngine | null {
  const canvasContext = canvas.getContext('2d', { alpha: true, desynchronized: true })
  if (!canvasContext) return null
  const context: CanvasRenderingContext2D = canvasContext

  const particleData = createSphereParticles(PARTICLE_COUNT)
  const projectedX = new Float32Array(particleData.count)
  const projectedY = new Float32Array(particleData.count)
  const projectedRadius = new Float32Array(particleData.count)
  const anchorWeight = new Float32Array(particleData.count)
  const bucketHeads = new Int32Array(BUCKET_COUNT)
  const bucketNext = new Int32Array(particleData.count)
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const systemDarkTheme = window.matchMedia('(prefers-color-scheme: dark)')
  const pointerState = {
    x: 0,
    y: 0,
    strength: 0,
    xVelocity: 0,
    yVelocity: 0,
    strengthVelocity: 0,
  }
  const pointerTarget = { x: 0, y: 0, strength: 0 }

  let colors: [string, string] = ['#d3bd91', '#aeb6bd']
  let alphaScale = 0.62
  let width = 1
  let height = 1
  let pixelRatio = 1
  let canvasBounds = canvas.getBoundingClientRect()
  let frame = 0
  let previousTime = 0
  let lastPaint = 0
  let elapsed = 0
  let rotation = -0.38
  let fastUntil = 0
  let pointerEngaged = false
  let visible = true
  let disposed = false
  let requestedReduceMotion = initialReduceMotion
  let targetProgress = targetProgressFor(initialState)
  let progress =
    initialState === 'entering' ? 0 : initialState === 'leaving' ? 1 : targetProgress
  let transition: ProgressTransition | null =
    progress === targetProgress || initialReduceMotion || systemReducedMotion.matches
      ? null
      : {
          from: progress,
          to: targetProgress,
          startedAt: performance.now(),
          duration: TRANSITION_DURATION,
        }

  if (!transition && (initialReduceMotion || systemReducedMotion.matches)) {
    progress = targetProgress
  }

  const isMotionReduced = () => requestedReduceMotion || systemReducedMotion.matches

  function isDarkTheme(styles: CSSStyleDeclaration) {
    const themeHost = canvas.closest<HTMLElement>('[data-theme]')
    const explicitTheme = themeHost?.dataset.theme ?? document.documentElement.dataset.theme
    if (explicitTheme === 'dark') return true
    if (explicitTheme === 'light') return false
    if (styles.colorScheme === 'dark') return true
    if (styles.colorScheme === 'light') return false
    return systemDarkTheme.matches
  }

  function refreshTheme() {
    if (disposed) return
    const styles = getComputedStyle(canvas)
    const dark = isDarkTheme(styles)
    const defaultColors: [string, string] = dark
      ? ['#d3bd91', '#aeb6bd']
      : ['#403329', '#344e62']
    const primary = readProperty(styles, '--maia-particle-primary', '--m3-dust-bright')
    const secondary = readProperty(styles, '--maia-particle-secondary', '--m3-dust-silver')
    const opacityProperty = readProperty(styles, '--maia-particle-opacity')
    const customOpacity = Number(opacityProperty)

    colors = [primary || defaultColors[0], secondary || defaultColors[1]]
    alphaScale = opacityProperty && Number.isFinite(customOpacity)
      ? clamp(customOpacity)
      : dark
        ? 0.62
        : 0.78

    if (visible && !document.hidden) drawFrame()
  }

  function updateBounds() {
    canvasBounds = canvas.getBoundingClientRect()
  }

  function resize() {
    if (disposed) return
    updateBounds()
    width = Math.max(1, canvasBounds.width)
    height = Math.max(1, canvasBounds.height)
    pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)

    const backingWidth = Math.round(width * pixelRatio)
    const backingHeight = Math.round(height * pixelRatio)
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth
      canvas.height = backingHeight
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    drawFrame()
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
    const sphereRadius = Math.min(width, height) * 0.35
    const centerX = width * 0.62
    const centerY = height * 0.5
    const waveAmount = 0.008
    const travelProgress = progress * (0.72 + progress * 0.78)
    const pointerStrength = clamp(pointerState.strength) * (1 - progress)
    const attractionRange = sphereRadius * 0.62
    const attractionRangeSquared = attractionRange * attractionRange
    const nucleusRange = sphereRadius * 0.2
    const nucleusRangeSquared = nucleusRange * nucleusRange
    let pullSumX = 0
    let pullSumY = 0
    let anchorWeightSum = 0

    bucketHeads.fill(-1)

    for (let index = 0; index < particleData.count; index += 1) {
      const wave =
        1 +
        waveAmount *
          (particleData.phaseSin[index] * waveCos + particleData.phaseCos[index] * waveSin)
      const baseX = particleData.x[index] * wave
      const baseY = particleData.y[index] * wave
      const baseZ = particleData.z[index] * wave
      const yawX = baseX * cosYaw + baseZ * sinYaw
      const yawZ = -baseX * sinYaw + baseZ * cosYaw
      const pitchY = baseY * cosPitch - yawZ * sinPitch
      const pitchZ = baseY * sinPitch + yawZ * cosPitch
      const perspective = 1 / (1 - pitchZ * 0.14)
      const depth = clamp((pitchZ + 1) * 0.5)
      const depthBucket = Math.min(DEPTH_STEPS - 1, Math.floor(depth * DEPTH_STEPS))
      const bucket =
        (depthBucket * TONE_COUNT + particleData.tone[index]) * ALPHA_BANDS +
        particleData.alphaBand[index]
      const projectedBaseX = yawX * sphereRadius * perspective
      const projectedBaseY = pitchY * sphereRadius * perspective
      const radialLength = Math.hypot(projectedBaseX, projectedBaseY)
      const radialDistanceSquared = radialLength * radialLength
      const radialProgress = Math.min(1, radialLength / sphereRadius)
      const particleAnchorWeight = 0.25 + 0.75 * radialProgress * radialProgress
      const nucleusDampener =
        0.68 + 0.32 * (radialDistanceSquared / (radialDistanceSquared + nucleusRangeSquared))
      const directionX =
        radialLength > 0.5 ? projectedBaseX / radialLength : particleData.phaseCos[index]
      const directionY =
        radialLength > 0.5 ? projectedBaseY / radialLength : particleData.phaseSin[index]
      const tangentX = -directionY
      const tangentY = directionX
      const disperseDistance =
        sphereRadius *
        travelProgress *
        (0.74 + depth * 0.7 + Math.abs(particleData.phaseSin[index]) * 0.18)
      const shearDistance =
        sphereRadius * travelProgress * particleData.phaseCos[index] * 0.12

      let particleX =
        centerX + projectedBaseX + directionX * disperseDistance + tangentX * shearDistance
      let particleY =
        centerY + projectedBaseY + directionY * disperseDistance + tangentY * shearDistance

      if (pointerStrength > 0.001) {
        const pointerDeltaX = pointerState.x - particleX
        const pointerDeltaY = pointerState.y - particleY
        const distanceSquared = pointerDeltaX * pointerDeltaX + pointerDeltaY * pointerDeltaY
        // The rational falloff deliberately has no hard radius cutoff.
        const falloff = 1 / (1 + distanceSquared / attractionRangeSquared)
        const depthGain = 0.72 + depth * 0.28
        const particleVariation = 0.94 + particleData.phaseSin[index] * 0.06
        const pull =
          falloff * pointerStrength * depthGain * particleVariation * nucleusDampener * 0.2
        const pullX = pointerDeltaX * pull
        const pullY = pointerDeltaY * pull
        particleX += pullX
        particleY += pullY
        pullSumX += pullX
        pullSumY += pullY
      }

      projectedX[index] = particleX
      projectedY[index] = particleY
      projectedRadius[index] =
        particleData.size[index] * perspective * (0.68 + depth * 0.7) * (1 - progress * 0.2)
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
    if (disposed) return
    context.clearRect(0, 0, width, height)
    const fade = progress <= PARTICLE_FADE_START
      ? 1
      : 1 - (progress - PARTICLE_FADE_START) / (1 - PARTICLE_FADE_START)
    if (fade <= 0 || canvasBounds.width <= 0 || canvasBounds.height <= 0) return

    projectParticles()

    for (let depth = 0; depth < DEPTH_STEPS; depth += 1) {
      for (let tone = 0; tone < TONE_COUNT; tone += 1) {
        context.fillStyle = colors[tone]
        for (let alphaBand = 0; alphaBand < ALPHA_BANDS; alphaBand += 1) {
          const bucket = (depth * TONE_COUNT + tone) * ALPHA_BANDS + alphaBand
          const depthAlpha = 0.34 + ((depth + 0.5) / DEPTH_STEPS) * 0.66
          context.globalAlpha = ALPHA_LEVELS[alphaBand] * depthAlpha * alphaScale * fade
          context.beginPath()

          for (let index = bucketHeads[bucket]; index !== -1; index = bucketNext[index]) {
            const particleRadius = projectedRadius[index]
            if (particleData.fleck[index]) {
              const angle =
                Math.atan2(
                  projectedY[index] - height * 0.5,
                  projectedX[index] - width * 0.62,
                ) +
                Math.PI * 0.5
              const longRadius = particleRadius * 1.6
              context.moveTo(
                projectedX[index] + Math.cos(angle) * longRadius,
                projectedY[index] + Math.sin(angle) * longRadius,
              )
              context.ellipse(
                projectedX[index],
                projectedY[index],
                longRadius,
                particleRadius * 0.58,
                angle,
                0,
                Math.PI * 2,
              )
            } else {
              context.moveTo(projectedX[index] + particleRadius, projectedY[index])
              context.arc(
                projectedX[index],
                projectedY[index],
                particleRadius,
                0,
                Math.PI * 2,
              )
            }
          }

          context.fill()
        }
      }
    }

    context.globalAlpha = 1
  }

  function integratePointerSpring(dt: number) {
    const xAcceleration =
      (-SPRING.stiffness * (pointerState.x - pointerTarget.x) -
        SPRING.damping * pointerState.xVelocity) /
      SPRING.mass
    const yAcceleration =
      (-SPRING.stiffness * (pointerState.y - pointerTarget.y) -
        SPRING.damping * pointerState.yVelocity) /
      SPRING.mass
    const strengthAcceleration =
      (-SPRING.stiffness * (pointerState.strength - pointerTarget.strength) -
        SPRING.damping * pointerState.strengthVelocity) /
      SPRING.mass

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

  function isSpringMoving() {
    return (
      Math.abs(pointerState.x - pointerTarget.x) +
        Math.abs(pointerState.y - pointerTarget.y) +
        Math.abs(pointerState.strength - pointerTarget.strength) +
        Math.abs(pointerState.xVelocity) +
        Math.abs(pointerState.yVelocity) +
        Math.abs(pointerState.strengthVelocity) >
      0.01
    )
  }

  function updateTransition(time: number) {
    if (!transition) return false
    const transitionProgress = clamp((time - transition.startedAt) / transition.duration)
    progress = transition.from + (transition.to - transition.from) * transitionProgress

    if (transitionProgress >= 1) {
      progress = transition.to
      transition = null
    }
    return true
  }

  function tick(time: number) {
    if (disposed) return
    if (!canvas.isConnected) {
      frame = 0
      return
    }
    frame = requestAnimationFrame(tick)

    const transitionWasActive = updateTransition(time)
    const interactionActive = transitionWasActive || time < fastUntil || isSpringMoving()
    const idleInterval = 1_000 / 30
    if (!interactionActive && time - lastPaint < idleInterval - 1) return

    const dt = Math.min((time - previousTime) / 1_000 || 0.016, 0.05)
    previousTime = time
    lastPaint = time
    elapsed += dt
    integratePointerSpring(dt)
    rotation += dt * 0.027
    drawFrame()

    if (!transition && progress >= 1) stop()
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function start() {
    if (
      frame ||
      disposed ||
      isMotionReduced() ||
      document.hidden ||
      !visible ||
      (!transition && progress >= 1)
    ) {
      return
    }
    previousTime = performance.now()
    lastPaint = 0
    frame = requestAnimationFrame(tick)
  }

  function resetPointer() {
    pointerEngaged = false
    pointerTarget.strength = 0
    fastUntil = performance.now() + 900
  }

  function settlePointer() {
    pointerState.x = pointerTarget.x
    pointerState.y = pointerTarget.y
    pointerState.strength = 0
    pointerState.xVelocity = 0
    pointerState.yVelocity = 0
    pointerState.strengthVelocity = 0
  }

  function handlePointerMove(event: PointerEvent) {
    if (
      event.pointerType !== 'mouse' ||
      !finePointer.matches ||
      isMotionReduced() ||
      transition !== null ||
      progress > 0.001 ||
      canvasBounds.width <= 0 ||
      canvasBounds.height <= 0
    ) {
      return
    }

    const inside =
      event.clientX >= canvasBounds.left &&
      event.clientX <= canvasBounds.right &&
      event.clientY >= canvasBounds.top &&
      event.clientY <= canvasBounds.bottom

    if (!inside) {
      if (pointerEngaged) resetPointer()
      return
    }

    const x = (event.clientX - canvasBounds.left) * (width / canvasBounds.width)
    const y = (event.clientY - canvasBounds.top) * (height / canvasBounds.height)

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
    start()
  }

  function handlePointerOut(event: PointerEvent) {
    if (event.relatedTarget === null) resetPointer()
  }

  function handleVisibility() {
    if (document.hidden) {
      if (transition) {
        progress = transition.to
        transition = null
      }
      stop()
      return
    }

    updateTransition(performance.now())
    drawFrame()
    start()
  }

  function applyMotionPreference() {
    if (isMotionReduced()) {
      if (transition) {
        progress = transition.to
        transition = null
      }
      resetPointer()
      settlePointer()
      elapsed = 0
      rotation = -0.38
      stop()
      drawFrame()
    } else {
      start()
    }
  }

  function handlePointerCapability() {
    if (!finePointer.matches) resetPointer()
  }

  function setState(state: ParticleSphereState) {
    const nextTarget = targetProgressFor(state)
    if (nextTarget === targetProgress) return

    targetProgress = nextTarget
    resetPointer()

    if (isMotionReduced()) {
      transition = null
      progress = targetProgress
      settlePointer()
      drawFrame()
      stop()
      return
    }

    const distance = Math.abs(targetProgress - progress)
    if (distance <= 0.001) {
      transition = null
      progress = targetProgress
      drawFrame()
      if (progress >= 1) stop()
      else start()
      return
    }

    transition = {
      from: progress,
      to: targetProgress,
      startedAt: performance.now(),
      duration: Math.max(1, TRANSITION_DURATION * distance),
    }
    fastUntil = performance.now() + TRANSITION_DURATION
    start()
  }

  function setReduceMotion(reduceMotion: boolean) {
    if (requestedReduceMotion === reduceMotion) return
    requestedReduceMotion = reduceMotion
    applyMotionPreference()
  }

  const resizeObserver = new ResizeObserver(resize)
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) {
      updateBounds()
      updateTransition(performance.now())
      drawFrame()
      start()
    } else {
      stop()
    }
  })
  const themeObserver = new MutationObserver(refreshTheme)
  const themeHost = canvas.closest<HTMLElement>('[data-theme]')
  const themeAttributes = ['class', 'style', 'data-theme', 'data-palette']

  resizeObserver.observe(canvas)
  intersectionObserver.observe(canvas)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: themeAttributes,
  })
  themeObserver.observe(canvas, { attributes: true, attributeFilter: ['class', 'style'] })
  if (themeHost && themeHost !== document.documentElement) {
    themeObserver.observe(themeHost, { attributes: true, attributeFilter: themeAttributes })
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerout', handlePointerOut, { passive: true })
  window.addEventListener('blur', resetPointer)
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('scroll', updateBounds, true)
  document.addEventListener('visibilitychange', handleVisibility)
  finePointer.addEventListener('change', handlePointerCapability)
  systemReducedMotion.addEventListener('change', applyMotionPreference)
  systemDarkTheme.addEventListener('change', refreshTheme)

  refreshTheme()
  resize()
  if (!isMotionReduced()) start()

  return {
    setState,
    setReduceMotion,
    destroy() {
      disposed = true
      transition = null
      stop()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerout', handlePointerOut)
      window.removeEventListener('blur', resetPointer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', updateBounds, true)
      document.removeEventListener('visibilitychange', handleVisibility)
      finePointer.removeEventListener('change', handlePointerCapability)
      systemReducedMotion.removeEventListener('change', applyMotionPreference)
      systemDarkTheme.removeEventListener('change', refreshTheme)
    },
  }
}

export function ParticleSphere({ state, reduceMotion, className }: ParticleSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ParticleSphereEngine | null>(null)
  const initialState = useRef(state)
  const initialReduceMotion = useRef(reduceMotion)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = createParticleSphereEngine(
      canvas,
      initialState.current,
      initialReduceMotion.current,
    )
    engineRef.current = engine

    return () => {
      engine?.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setState(state)
  }, [state])

  useEffect(() => {
    engineRef.current?.setReduceMotion(reduceMotion)
  }, [reduceMotion])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-particle-sphere=""
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
