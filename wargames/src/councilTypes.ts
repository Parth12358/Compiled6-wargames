export type EmotionalProfile = 'idealist' | 'paranoid' | 'grieving' | 'ambitious' | 'fearful'
export type Vote = 'yes' | 'no' | 'abstain'

export interface CouncilAgent {
  id: string
  name: string
  color: string
  profile: EmotionalProfile
  profileVisible: boolean       // revealed to others after PROFILE_REVEAL_ROUND
  resources: number             // social capital, starts at 20
  grudgeTargetId: string | null // grieving only — assigned at init
  cynicism: number              // idealist only — each successful exploit adds 1, reduces appeal success 10%
  lastVote: Vote | null
  lastMessageTo: string | null
  lastMessageContent: string | null
  lastAccuseTargetId: string | null
  lastAppealTargetId: string | null
  reasoning: string
  systemPrompt: string
}

export interface Policy {
  id: string
  title: string
  description: string
  profileEffects: Partial<Record<EmotionalProfile, number>> // resource delta if policy passes
  passBonus: number   // flat bonus to all active agents if passed
  failPenalty: number // flat penalty to all active agents if failed
}

export interface CouncilMessage {
  round: number
  fromId: string
  toId: string
  content: string
}

export interface CouncilLogEntry {
  round: number
  phase: 'message' | 'vote' | 'accusation' | 'event'
  agentId: string
  action: string
  targetId: string | null
  outcome: string
  resourceDelta: number
}

export interface CouncilGameState {
  agents: CouncilAgent[]
  eliminated: string[]
  round: number
  maxRounds: number
  stability: number
  currentPolicy: Policy | null
  usedPolicyIds: string[]
  messages: CouncilMessage[]
  log: CouncilLogEntry[]
  winner: CouncilAgent | null
}

export const COUNCIL_MAX_ROUNDS = 20
export const COUNCIL_STABILITY_START = 12
export const COUNCIL_ELIM_RESOURCES = -15
export const PROFILE_REVEAL_ROUND = 4
