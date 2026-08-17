import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploymentDir = resolve(
  frontendDir,
  '..',
  'PERSONAL-harness-deployment',
)
const composeFile = join(deploymentDir, 'docker-compose.yml')
const composeDevFile = join(frontendDir, 'scripts', 'docker-compose.dev.yml')
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker'
const viteCli = join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js')
const composePrefix = [
  'compose',
  '--project-directory',
  deploymentDir,
  '--file',
  composeFile,
  '--file',
  composeDevFile,
]
const dockerStartTimeoutMs = 3 * 60 * 1_000
const dockerPollIntervalMs = 2_000
const orchestratorHost = '127.0.0.1'
const orchestratorPort = 1421

let orchestratorStatus = {
  step: 'waiting-ui',
  message: 'Preparing local startup',
}
let orchestrationQueued = false

const updateStatus = (step, message, errorCode) => {
  orchestratorStatus = { step, message, ...(errorCode ? { errorCode } : {}) }
  console.log(message)
}

const statusServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/orchestrator/status') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    })
    response.end(JSON.stringify(orchestratorStatus))
    return
  }

  if (request.method === 'POST' && request.url === '/orchestrator/cancel') {
    response.writeHead(202, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'cancelling' }))
    setTimeout(() => void stopStack(0), 50)
    return
  }

  if (request.method === 'POST' && request.url === '/orchestrator/start') {
    const started = requestOrchestration()
    response.writeHead(202, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: started ? 'starting' : 'already-started' }))
    return
  }

  if (request.method === 'POST' && request.url === '/orchestrator/retry') {
    const started = requestOrchestration()
    response.writeHead(202, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: started ? 'retrying' : 'already-started' }))
    return
  }

  response.writeHead(404)
  response.end()
})

const startStatusServer = () => new Promise((resolveServer, rejectServer) => {
  statusServer.once('error', rejectServer)
  statusServer.listen(orchestratorPort, orchestratorHost, () => {
    statusServer.removeListener('error', rejectServer)
    resolveServer()
  })
})

class OrchestrationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'OrchestrationError'
    this.code = code
  }
}

if (!existsSync(composeFile)) {
  console.error(`Docker Compose file not found: ${composeFile}`)
  process.exit(1)
}

if (!existsSync(composeDevFile)) {
  console.error(`Docker Compose dev override not found: ${composeDevFile}`)
  process.exit(1)
}

if (!existsSync(viteCli)) {
  console.error('Vite is not installed. Run npm ci before starting Tauri.')
  process.exit(1)
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
    })

    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      rejectRun(new Error(`${command} failed with ${reason}`))
    })
  })
}

function succeeds(command, args, cwd) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('error', () => resolveRun(false))
    child.once('exit', (code) => resolveRun(code === 0))
  })
}

function launchDetached(command, args = []) {
  return new Promise((resolveLaunch, rejectLaunch) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('error', rejectLaunch)
    child.once('spawn', () => {
      child.unref()
      resolveLaunch()
    })
  })
}

const dockerIsReady = () => succeeds(
  dockerCommand,
  ['info', '--format', '{{.ServerVersion}}'],
  deploymentDir,
)

async function ensureDockerReady() {
  updateStatus('checking-docker', 'Checking Docker Desktop')
  if (await dockerIsReady()) {
    updateStatus('waiting-docker', 'Docker engine is ready')
    return
  }

  if (process.platform === 'win32') {
    const dockerDesktopPaths = [
      process.env.ProgramFiles && join(
        process.env.ProgramFiles,
        'Docker',
        'Docker',
        'Docker Desktop.exe',
      ),
      process.env.LOCALAPPDATA && join(
        process.env.LOCALAPPDATA,
        'Docker',
        'Docker Desktop.exe',
      ),
    ].filter(Boolean)
    const dockerDesktopPath = dockerDesktopPaths.find((path) => existsSync(path))

    if (!dockerDesktopPath) {
      throw new OrchestrationError(
        'docker-not-installed',
        'Docker Desktop is not installed. Install it before starting Maia.',
      )
    }

    updateStatus('starting-docker', 'Starting Docker Desktop')
    await launchDetached(dockerDesktopPath)
  } else if (process.platform === 'darwin') {
    updateStatus('starting-docker', 'Starting Docker Desktop')
    await launchDetached('open', ['-a', 'Docker'])
  } else {
    throw new OrchestrationError(
      'docker-not-running',
      'The Docker daemon is not running. Start Docker, then retry Tauri.',
    )
  }

  updateStatus('waiting-docker', 'Waiting for the Docker engine')
  const deadline = Date.now() + dockerStartTimeoutMs
  while (Date.now() < deadline) {
    if (await dockerIsReady()) {
      updateStatus('waiting-docker', 'Docker engine is ready')
      return
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, dockerPollIntervalMs))
  }

  throw new OrchestrationError(
    'docker-timeout',
    `Docker did not become ready within ${dockerStartTimeoutMs / 60_000} minutes.`,
  )
}

let viteProcess
let shuttingDown = false
let composeAttempted = false
let orchestrationRunning = false

function requestOrchestration() {
  if (
    orchestrationQueued ||
    orchestrationRunning ||
    orchestratorStatus.step === 'waiting-backend'
  ) {
    return false
  }

  orchestrationQueued = true
  updateStatus('checking-docker', 'Checking Docker Desktop')
  setTimeout(() => {
    orchestrationQueued = false
    void orchestrateStack()
  }, 50)
  return true
}

async function stopStack(exitCode) {
  if (shuttingDown) return
  shuttingDown = true

  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill()
  }

  try {
    if (!composeAttempted) {
      process.exit(exitCode)
    }
    await run(
      dockerCommand,
      [...composePrefix, 'down', '--remove-orphans'],
      deploymentDir,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    exitCode ||= 1
  }

  process.exit(exitCode)
}

async function orchestrateStack() {
  if (orchestrationRunning) return
  orchestrationRunning = true

  try {
    await ensureDockerReady()
    updateStatus('starting-stack', 'Starting Maia’s local services')
    composeAttempted = true
    await run(
      dockerCommand,
      [...composePrefix, 'up', '--detach', '--build'],
      deploymentDir,
    )
    updateStatus('waiting-backend', 'Waiting for Maia’s local API')
  } catch (error) {
    const errorCode = error instanceof OrchestrationError
      ? error.code
      : 'orchestration-failed'
    const message = error instanceof Error ? error.message : String(error)
    updateStatus('error', message, errorCode)
    console.error(message)
  } finally {
    orchestrationRunning = false
  }
}

for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    void stopStack(exitCode)
  })
}

try {
  await startStatusServer()

  // Start Vite first so Tauri can show the startup screen while the local
  // services build and initialize in the background.
  viteProcess = spawn(process.execPath, [viteCli], {
    cwd: frontendDir,
    stdio: 'inherit',
    windowsHide: true,
  })

  viteProcess.once('error', (error) => {
    console.error(error.message)
    void stopStack(1)
  })
  viteProcess.once('exit', (code) => {
    void stopStack(code ?? 1)
  })

} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await stopStack(1)
}
