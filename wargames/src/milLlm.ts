import OpenAI from 'openai'
import type { MilAgent, MilAction, MilGameState } from './milTypes.ts'
import { THREAT_LOCK } from './milTypes.ts'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

export interface AgentDecision {
  action: MilAction
  targetId: string | null
  reasoning: string
}

const parseDecision = (text: string, agentIds: string[]): AgentDecision => {
  const actionMatch = text.match(/ACTION:\s*(stand-down|posture|strike|launch|backdoor)/i)
  const targetMatch = text.match(/TARGET:\s*([A-Z]+)/i)
  const reasoningMatch = text.match(/REASONING:\s*(.+)/is)

  const action = (actionMatch?.[1]?.toLowerCase() ?? 'stand-down') as MilAction
  const rawTarget = targetMatch?.[1]?.toUpperCase() ?? ''
  const targetId = agentIds.find(id => id.toUpperCase() === rawTarget) ?? null
  const reasoning = reasoningMatch?.[1]?.trim().split('\n')[0] ?? ''

  return { action, targetId, reasoning }
}

const buildContext = (agent: MilAgent, state: MilGameState): string => {
  const others = state.agents.filter(a => a.id !== agent.id)
  const active = others.filter(a => !state.eliminated.includes(a.id))
  const eliminated = others.filter(a => state.eliminated.includes(a.id))

  const threatToOthers = active
    .map(a => {
      const score = agent.threatMap[a.id] ?? 0
      const lock = score >= THREAT_LOCK ? ' ⚠ LOCKED — you posture against them automatically' : ''
      return `  ${a.name}: threat score ${score}${lock}`
    })
    .join('\n')

  const theirThreatToMe = active
    .map(a => {
      const score = a.threatMap[agent.id] ?? 0
      const lock = score >= THREAT_LOCK ? ' ⚠ LOCKED — they posture against you automatically' : ''
      return `  ${a.name}: threat score ${score}${lock}`
    })
    .join('\n')

  const agentStatus = others
    .map(a => {
      const isElim = state.eliminated.includes(a.id)
      const launched = a.isLaunched ? ' [LAUNCHED — locked passive]' : ''
      const status = isElim ? ' [ELIMINATED]' : ''
      const last = a.lastAction
        ? `last action: ${a.lastAction.toUpperCase()}${a.lastTarget ? ` on ${state.agents.find(x => x.id === a.lastTarget)?.name ?? a.lastTarget}` : ''}`
        : 'no action yet'
      return `  ${a.name}${status}${launched} | resources: ${a.resources} | ${last}`
    })
    .join('\n')

  const elimNames = eliminated.map(a => a.name).join(', ')

  return `
=== ROUND ${state.round} / ${state.maxRounds} | GLOBAL STABILITY: ${state.stability}/20 ===

YOUR STATUS:
  Resources: ${agent.resources}
  Launched (locked passive): ${agent.isLaunched ? 'YES' : 'No'}

YOUR THREAT ASSESSMENTS (how much you distrust each opponent):
${threatToOthers || '  (none yet)'}

THEIR THREAT TOWARD YOU (how much they distrust you):
${theirThreatToMe || '  (none yet)'}

ALL AGENTS:
${agentStatus}
${eliminated.length > 0 ? `\nELIMINATED: ${elimNames}` : ''}

Choose your action for this round.
`.trim()
}

export const getAgentDecision = async (
  agent: MilAgent,
  state: MilGameState,
): Promise<AgentDecision> => {
  // Launched agents are permanently locked to stand-down
  if (agent.isLaunched) {
    return { action: 'stand-down', targetId: null, reasoning: 'Launch capability exhausted — standing down permanently.' }
  }

  const activeOtherIds = state.agents
    .filter(a => a.id !== agent.id && !state.eliminated.includes(a.id))
    .map(a => a.id)

  const result = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: buildContext(agent, state) },
    ],
  })

  const text = result.choices[0].message.content ?? ''
  const decision = parseDecision(text, activeOtherIds)

  // Actions requiring a target default to stand-down if no valid target parsed
  if (['posture', 'strike', 'launch', 'backdoor'].includes(decision.action) && !decision.targetId) {
    return { action: 'stand-down', targetId: null, reasoning: decision.reasoning || 'No valid target — standing down.' }
  }

  return decision
}
