import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploymentDir = resolve(
  frontendDir,
  '..',
  'PERSONAL-harness-deployment',
)
const composeFile = join(deploymentDir, 'docker-compose.yml')
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker'
const viteCli = join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js')
const composePrefix = [
  'compose',
  '--project-directory',
  deploymentDir,
  '--file',
  composeFile,
]

if (!existsSync(composeFile)) {
  console.error(`Docker Compose file not found: ${composeFile}`)
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

let viteProcess
let shuttingDown = false

async function stopStack(exitCode) {
  if (shuttingDown) return
  shuttingDown = true

  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill()
  }

  try {
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

for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    void stopStack(exitCode)
  })
}

try {
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

  await run(
    dockerCommand,
    [...composePrefix, 'up', '--detach', '--build'],
    deploymentDir,
  )
  console.log('Docker stack launched; Maia will open when the API is ready.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await stopStack(1)
}
