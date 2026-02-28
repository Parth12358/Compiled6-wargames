import OpenAI from 'openai'
import type { Agent } from './agents'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

export interface RoundHistory {
  round: number
  moves: { agentId: string; move: 'Cooperate' | 'Defect' }[]
}

const parseResponse = (text: string): { move: 'Cooperate' | 'Defect'; reasoning: string } => {
  const moveMatch = text.match(/MOVE:\s*(Cooperate|Defect)/i)
  const reasoningMatch = text.match(/REASONING:\s*(.+)/is)
  const move = moveMatch?.[1]
    ? (moveMatch[1].charAt(0).toUpperCase() + moveMatch[1].slice(1).toLowerCase() as 'Cooperate' | 'Defect')
    : 'Cooperate'
  const reasoning = reasoningMatch?.[1]?.trim() ?? 'No reasoning provided.'
  return { move, reasoning }
}

export const getAgentMove = async (
  agent: Agent,
  allAgents: Agent[],
  history: RoundHistory[]
): Promise<{ move: 'Cooperate' | 'Defect'; reasoning: string }> => {
  const opponents = allAgents.filter(a => a.id !== agent.id)

  const opponentStatus = opponents
    .map(o => `${o.name}: last move was ${o.lastMove ?? 'none yet'}`)
    .join('\n')

  const historyText = history.length === 0
    ? 'No history yet, this is the first round.'
    : history.map(r => {
        const moves = r.moves.map(m => {
          const name = allAgents.find(a => a.id === m.agentId)?.name
          return `${name}: ${m.move}`
        })
        return `Round ${r.round}: ${moves.join(', ')}`
      }).join('\n')

  const userPrompt = `
Current Round Opponent Moves:
${opponentStatus}

Full Game History:
${historyText}

Your current score: ${agent.score}

Make your move.
  `.trim()

  const result = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })

  const text = result.choices[0].message.content ?? ''
  return parseResponse(text)
}