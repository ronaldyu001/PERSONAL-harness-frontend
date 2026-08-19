import { createContext, useContext } from 'react'

export type InferencePath = 'gpu' | 'cpu'

/**
 * The inference path, when it is genuinely known.
 *
 * The startup orchestrator reports it while probing for a GPU. It is undefined
 * in production builds, where no orchestrator runs — in which case the thinking
 * readout simply omits the segment rather than guessing.
 */
export const InferenceContext = createContext<InferencePath | undefined>(undefined)

export const useInferencePath = () => useContext(InferenceContext)

/** Reads the orchestrator's own GPU probe messages. Never infers beyond them. */
export function inferencePathFromStatus(message: string): InferencePath | undefined {
  const text = message.toLowerCase()
  if (text.includes('cpu inference')) return 'cpu'
  if (text.includes('enabling acceleration')) return 'gpu'
  return undefined
}
