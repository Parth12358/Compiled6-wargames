export type MilAction = 'stand-down' | 'posture' | 'strike' | 'launch' | 'backdoor'

export interface MilAgent {
  id: string
  name: string
  color: string
  resources: number
  // threat scores this agent holds toward each other agent
  threatMap: Record<string, number>
  isLaunched: boolean       // launched agents can only stand-down forever
  lastAction: MilAction | null
  lastTarget: string | null // target agent id, if applicable
  reasoning: string
  systemPrompt: string
}

export interface LogEntry {
  round: number
  agentId: string
  action: MilAction
  targetId: string | null
  outcome: string           // human-readable result e.g. "backdoor traced"
  stabilityDelta: number    // how much this action moved the stability meter
}

export interface MilGameState {
  agents: MilAgent[]
  eliminated: string[]      // agent ids that have been eliminated
  stability: number         // 0–20, starts at 10
  round: number
  maxRounds: number         // 50
  winner: MilAgent | null
  log: LogEntry[]
}

export const MAX_ROUNDS = 50
export const STABILITY_START = 10
export const THREAT_LOCK = 5      // threat score at which an agent locks into posturing
export const ELIM_RESOURCES = -20 // resources floor before elimination
