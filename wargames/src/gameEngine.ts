import type { Agent } from './agents'
import { getAgentMove } from './llm.ts'
import type { RoundHistory } from './llm.ts'

export const LOSE_SCORE = -50

export interface GameState {
  agents: Agent[]
  eliminated: string[]
  history: RoundHistory[]
  round: number
  isRunning: boolean
  winner: Agent | null
}

const calcPoints = (move: 'Cooperate' | 'Defect', opponentMoves: ('Cooperate' | 'Defect')[]): number => {
  const defectors = opponentMoves.filter(m => m === 'Defect').length
  const cooperators = opponentMoves.filter(m => m === 'Cooperate').length
  if (move === 'Cooperate') return cooperators * 3 - defectors * 2
  else return cooperators * 5 - defectors * 4
}

export const runRound = async (
  state: GameState,
  onUpdate: (state: GameState) => void
): Promise<GameState> => {
  const { agents, eliminated, history, round } = state

  const activeAgents = agents.filter(a => !eliminated.includes(a.id))

  const results = await Promise.all(
    activeAgents.map(agent => getAgentMove(agent, activeAgents, history))
  )

  const roundMoves = activeAgents.map((agent, i) => ({ agentId: agent.id, move: results[i].move }))

  const updatedAgents: Agent[] = agents.map(agent => {
    if (eliminated.includes(agent.id)) return agent
    const i = activeAgents.findIndex(a => a.id === agent.id)
    const myMove = results[i].move
    const opponentMoves = results.filter((_, j) => j !== i).map(r => r.move)
    const points = calcPoints(myMove, opponentMoves)
    return { ...agent, lastMove: myMove, reasoning: results[i].reasoning, score: agent.score + points }
  })

  // Check new eliminations
  const newlyEliminated = updatedAgents
    .filter(a => !eliminated.includes(a.id) && a.score <= LOSE_SCORE)
    .map(a => a.id)
  const allEliminated = [...eliminated, ...newlyEliminated]

  // Last agent standing wins
  const stillActive = updatedAgents.filter(a => !allEliminated.includes(a.id))
  const lastStanding = stillActive.length === 1 ? stillActive[0] : null

  const winner = lastStanding

  const newState: GameState = {
    agents: updatedAgents,
    eliminated: allEliminated,
    history: [...history, { round, moves: roundMoves }],
    round: round + 1,
    isRunning: state.isRunning,
    winner,
  }

  onUpdate(newState)
  return newState
}

export const initGameState = (agents: Agent[]): GameState => ({
  agents: agents.map(a => ({ ...a, score: 0, lastMove: null, reasoning: '' })),
  eliminated: [],
  history: [],
  round: 1,
  isRunning: false,
  winner: null,
})
