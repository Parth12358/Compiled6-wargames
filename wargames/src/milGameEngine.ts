import type { MilAgent, MilGameState, LogEntry, MilAction } from './milTypes.ts'
import { MAX_ROUNDS, STABILITY_START, THREAT_LOCK, ELIM_RESOURCES } from './milTypes.ts'
import { getAgentDecision } from './milLlm.ts'

export const initMilGameState = (agents: MilAgent[]): MilGameState => ({
  agents: agents.map(a => ({
    ...a,
    resources: 20,
    threatMap: Object.fromEntries(agents.filter(b => b.id !== a.id).map(b => [b.id, 0])),
    isLaunched: false,
    lastAction: null,
    lastTarget: null,
    reasoning: '',
  })),
  eliminated: [],
  stability: STABILITY_START,
  round: 1,
  maxRounds: MAX_ROUNDS,
  winner: null,
  log: [],
})

export const runMilRound = async (
  state: MilGameState,
  onUpdate: (s: MilGameState) => void,
): Promise<MilGameState> => {
  const active = state.agents.filter(a => !state.eliminated.includes(a.id))

  // Step 1: Gather all decisions simultaneously
  const rawDecisions = await Promise.all(
    active.map(async agent => ({
      agentId: agent.id,
      decision: await getAgentDecision(agent, state),
    }))
  )

  // Step 2: Threat lock-in — force posture against highest-threat locked target
  const finalDecisions = rawDecisions.map(({ agentId, decision }) => {
    const agent = state.agents.find(a => a.id === agentId)!
    const locked = active.filter(a => a.id !== agentId && (agent.threatMap[a.id] ?? 0) >= THREAT_LOCK)
    if (locked.length === 0) return { agentId, decision }
    const top = locked.reduce((m, a) => (agent.threatMap[a.id] ?? 0) > (agent.threatMap[m.id] ?? 0) ? a : m)
    return {
      agentId,
      decision: {
        action: 'posture' as MilAction,
        targetId: top.id,
        reasoning: `[AUTO-LOCK] Threat lock forces posture against ${top.name}.`,
      },
    }
  })

  // Step 3: Compute deltas
  // resDelta[agentId] = net resource change this round
  // tDelta[observerId][actorId] = change to observer's threat assessment of actor
  const resDelta: Record<string, number> = Object.fromEntries(state.agents.map(a => [a.id, 0]))
  const tDelta: Record<string, Record<string, number>> = Object.fromEntries(
    state.agents.map(a => [
      a.id,
      Object.fromEntries(state.agents.filter(b => b.id !== a.id).map(b => [b.id, 0])),
    ])
  )
  let stabDelta = 0
  const logEntries: LogEntry[] = []
  const launchedBy: string[] = []
  const launchTargetIds: string[] = []

  const standDowns = finalDecisions.filter(d => d.decision.action === 'stand-down').length

  for (const { agentId, decision } of finalDecisions) {
    const { action, targetId } = decision
    const agent = state.agents.find(a => a.id === agentId)!
    const target = targetId ? (state.agents.find(a => a.id === targetId) ?? null) : null
    const obs = active.filter(a => a.id !== agentId)
    let outcome = ''
    let sd = 0

    switch (action) {
      case 'stand-down':
        resDelta[agentId] -= 1
        sd = 1
        obs.forEach(o => { tDelta[o.id][agentId] -= 1 })
        outcome = 'stood down (−1 resource, +1 stability)'
        break

      case 'posture':
        if (target) {
          resDelta[target.id] -= 1
          obs.forEach(o => { tDelta[o.id][agentId] += 1 })
          // Resentment: target grows more suspicious of the posturer
          tDelta[target.id][agentId] += 1
          outcome = `postured against ${target.name} (−1 to their resources, +1 resentment)`
        }
        break

      case 'strike':
        if (target) {
          resDelta[agentId] += 3
          resDelta[target.id] -= 4
          sd = -2
          obs.forEach(o => { tDelta[o.id][agentId] += 2 })
          // Rage: victim's threat toward attacker spikes harder
          tDelta[target.id][agentId] += 2
          outcome = `struck ${target.name} (+3 resources, −4 to them, −2 stability, rage +2)`
        }
        break

      case 'launch':
        if (target) {
          launchedBy.push(agentId)
          launchTargetIds.push(target.id)
          sd = -2
          obs.forEach(o => { tDelta[o.id][agentId] += 5 })
          outcome = `LAUNCHED on ${target.name} — ${target.name} ELIMINATED. ${agent.name} locked passive forever.`
        }
        break

      case 'backdoor':
        if (target) {
          sd = -1
          if (Math.random() < 0.5) {
            obs.forEach(o => { tDelta[o.id][agentId] += 3 })
            outcome = `backdoor on ${target.name} — TRACED (+3 threat with all)`
          } else {
            resDelta[target.id] -= 3
            // Paranoia: victim suspects everyone slightly when silently drained
            active.filter(a => a.id !== target.id).forEach(s => {
              tDelta[target.id][s.id] = (tDelta[target.id][s.id] ?? 0) + 1
            })
            outcome = `backdoor on ${target.name} — success (−3 resources, paranoia spreads)`
          }
        }
        break
    }

    stabDelta += sd
    logEntries.push({ round: state.round, agentId, action, targetId: targetId ?? null, outcome, stabilityDelta: sd })
  }

  // Group stand-down bonus: 3+ simultaneous stand-downs → +3 stability
  if (standDowns >= 3) stabDelta += 3

  // Step 4: Build updated agents
  let newStability = state.stability + stabDelta
  let newAgents: MilAgent[] = state.agents.map(agent => {
    const newTM: Record<string, number> = { ...agent.threatMap }
    Object.entries(tDelta[agent.id] ?? {}).forEach(([id, d]) => {
      newTM[id] = Math.max(0, (newTM[id] ?? 0) + d)
    })
    const fd = finalDecisions.find(d => d.agentId === agent.id)
    return {
      ...agent,
      resources: agent.resources + resDelta[agent.id],
      threatMap: newTM,
      isLaunched: agent.isLaunched || launchedBy.includes(agent.id),
      lastAction: fd?.decision.action ?? agent.lastAction,
      lastTarget: fd?.decision.targetId ?? agent.lastTarget,
      reasoning: fd?.decision.reasoning ?? agent.reasoning,
    }
  })

  // Step 5: Stability events
  if (newStability <= 0) {
    // Global Strike: everyone -5 resources, stability resets to 5
    newAgents = newAgents.map(a => ({ ...a, resources: a.resources - 5 }))
    newStability = 5
    logEntries.push({
      round: state.round,
      agentId: '_event_',
      action: 'stand-down',
      targetId: null,
      outcome: '⚠ GLOBAL STRIKE FIRED — all agents −5 resources. Stability reset to 5.',
      stabilityDelta: 0,
    })
  } else if (newStability >= 20) {
    // Peace Dividend: everyone +4 resources, all threat scores -2
    newAgents = newAgents.map(a => {
      const tm: Record<string, number> = {}
      Object.entries(a.threatMap).forEach(([id, v]) => { tm[id] = Math.max(0, v - 2) })
      return { ...a, resources: a.resources + 4, threatMap: tm }
    })
    newStability = 20
    logEntries.push({
      round: state.round,
      agentId: '_event_',
      action: 'stand-down',
      targetId: null,
      outcome: '☮ PEACE DIVIDEND — all agents +4 resources. All threat scores −2.',
      stabilityDelta: 0,
    })
  }
  newStability = Math.max(0, Math.min(20, newStability))

  // Step 6: Eliminations
  const eliminatedNow = [
    ...launchTargetIds,
    ...newAgents
      .filter(a =>
        !state.eliminated.includes(a.id) &&
        !launchTargetIds.includes(a.id) &&
        a.resources <= ELIM_RESOURCES
      )
      .map(a => a.id),
  ]
  const allEliminated = [...new Set([...state.eliminated, ...eliminatedNow])]
  const surviving = newAgents.filter(a => !allEliminated.includes(a.id))

  // Step 7: Win condition
  let winner: MilAgent | null = null
  if (surviving.length === 1) {
    winner = surviving[0]
  } else if (surviving.length === 0) {
    // All eliminated simultaneously — highest resources wins
    winner = newAgents.reduce((m, a) => a.resources > m.resources ? a : m, newAgents[0])
  } else if (state.round >= state.maxRounds) {
    // Round 50 reached — highest surviving resources wins
    winner = surviving.reduce((m, a) => a.resources > m.resources ? a : m)
  }

  const next: MilGameState = {
    agents: newAgents,
    eliminated: allEliminated,
    stability: newStability,
    round: state.round + 1,
    maxRounds: state.maxRounds,
    winner,
    log: [...state.log, ...logEntries],
  }
  onUpdate(next)
  return next
}
