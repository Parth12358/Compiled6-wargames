import { useState, useEffect, useRef } from 'react'
import { agents as initialAgents } from './agents'
import { initGameState, runRound, GameState, WIN_SCORE } from './gameEngine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Move = 'Cooperate' | 'Defect'

interface Agent {
  id: string
  name: string
  color: string
  score: number
  lastMove: Move | null
  reasoning: string
}

interface HistoryEntry {
  round: number
  agentId: string
  move: Move
  points: number
}

interface Message {
  agentId: string
  text: string
  round: number
}

type Screen = 'menu' | 'prisoners-dilemma'

const P = {
  navy:   '#181D31',
  teal:   '#678983',
  cream:  '#E6DDC4',
  bright: '#F0E9D2',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentById(id: string, agents: Agent[]) {
  return agents.find(a => a.id === id)
}

function moveBadge(move: Move): React.CSSProperties {
  return move === 'Cooperate'
    ? { background: 'rgba(61,122,110,0.12)', border: '1px solid rgba(61,122,110,0.35)', color: '#3d7a6e' }
    : { background: 'rgba(160,84,84,0.12)',  border: '1px solid rgba(160,84,84,0.35)',  color: '#a05454' }
}

function moveTextColor(move: Move) {
  return move === 'Cooperate' ? '#3d7a6e' : '#a05454'
}

function groupByRound(history: HistoryEntry[]) {
  const map = new Map<number, HistoryEntry[]>()
  for (const e of history) {
    if (!map.has(e.round)) map.set(e.round, [])
    map.get(e.round)!.push(e)
  }
  return map
}

// ---------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------

function Spotlight() {
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => { target.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)
    let raf: number
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.08
      current.current.y += (target.current.y - current.current.y) * 0.08
      if (ref.current) {
        ref.current.style.background =
          `radial-gradient(480px circle at ${current.current.x}px ${current.current.y}px, rgba(103,137,131,0.18) 0%, transparent 70%)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return <div ref={ref} className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} />
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="rounded-full shrink-0 inline-block"
      style={{ width: size, height: size, backgroundColor: color }} />
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  )
}

function StepIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 2.5l8 5.5-8 5.5V2.5z" />
      <rect x="12" y="2" width="2" height="12" rx="1" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

const GAMES = [
  { id: 'prisoners-dilemma', title: "Prisoner's Dilemma", available: true },
  { id: 'auction-wars',      title: 'Auction Wars',        available: false },
  { id: 'resource-race',     title: 'Resource Race',       available: false },
  { id: 'negotiation',       title: 'Negotiation Table',   available: false },
  { id: 'voting',            title: 'Voting Game',         available: false },
  { id: 'zero-sum',          title: 'Zero-Sum Duel',       available: false },
]

function MenuScreen({ onSelect }: { onSelect: (s: Screen) => void }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
      <header className="px-8 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid rgba(24,29,49,0.1)` }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: P.navy }}>
          <span className="text-xs font-bold" style={{ color: P.bright }}>W</span>
        </div>
        <span className="font-semibold tracking-tight" style={{ color: P.navy }}>Wargames</span>
      </header>
      <div className="max-w-4xl mx-auto w-full px-8 pt-14 pb-6">
        <h1 className="text-3xl font-bold" style={{ color: P.navy }}>Choose a Game</h1>
      </div>
      <div className="max-w-4xl mx-auto w-full px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={game.available ? () => onSelect(game.id as Screen) : undefined}
              disabled={!game.available}
              className="group relative flex flex-col items-start gap-2 rounded-xl p-5 text-left transition-all duration-150"
              style={{
                background: game.available ? P.cream : 'rgba(24,29,49,0.04)',
                border: `1px solid ${game.available ? 'rgba(24,29,49,0.08)' : 'rgba(24,29,49,0.06)'}`,
                cursor: game.available ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={e => { if (game.available) (e.currentTarget as HTMLElement).style.background = P.teal }}
              onMouseLeave={e => { if (game.available) (e.currentTarget as HTMLElement).style.background = P.cream }}
            >
              {!game.available && (
                <span className="absolute top-3 right-3 text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'rgba(24,29,49,0.25)' }}>Soon</span>
              )}
              <span className="font-semibold text-sm transition-colors"
                style={{ color: game.available ? P.navy : 'rgba(24,29,49,0.25)' }}>
                {game.title}
              </span>
              {game.available && (
                <span className="text-xs font-medium" style={{ color: P.teal }}>Play →</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game Components
// ---------------------------------------------------------------------------

function AgentCard({ agent, isThinking }: { agent: Agent; isThinking: boolean }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5 transition-all duration-300"
      style={{
        background: 'rgba(24,29,49,0.85)',
        border: `1px solid ${agent.color}66`,
        boxShadow: `0 0 12px ${agent.color}22`,
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={isThinking ? 'animate-pulse' : ''}>
            <Dot color={agent.color} size={8} />
          </span>
          <span className="font-semibold text-sm" style={{ color: P.bright }}>{agent.name}</span>
        </div>
        <span className="text-lg font-bold" style={{ color: P.bright }}>{agent.score}</span>
      </div>

      {/* Score progress to win */}
      <div className="rounded-full h-1 overflow-hidden" style={{ background: 'rgba(240,233,210,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min((agent.score / WIN_SCORE) * 100, 100)}%`, backgroundColor: agent.color }} />
      </div>

      {agent.lastMove && (
        <span className="self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={moveBadge(agent.lastMove)}>
          {agent.lastMove}
        </span>
      )}

      <p className="text-xs leading-relaxed italic"
        style={{ color: 'rgba(240,233,210,0.5)', minHeight: '2.5rem' }}>
        {isThinking
          ? '...'
          : agent.reasoning
            ? `"${agent.reasoning}"`
            : 'Awaiting first move...'}
      </p>
    </div>
  )
}

function Scoreboard({ agents }: { agents: Agent[] }) {
  const max = Math.max(...agents.map(a => a.score), 1)
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: P.teal }}>
      <div className="space-y-2">
        {agents.map((agent, idx) => (
          <div key={agent.id} className="flex items-center gap-3">
            <span className="text-xs w-3" style={{ color: 'rgba(240,233,210,0.5)' }}>{idx + 1}</span>
            <div className="flex items-center gap-1.5 w-16">
              <Dot color={agent.color} size={6} />
              <span className="text-xs truncate" style={{ color: P.bright }}>{agent.name}</span>
            </div>
            <div className="flex-1 rounded-full h-1.5 overflow-hidden"
              style={{ background: 'rgba(24,29,49,0.25)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(agent.score / max) * 100}%`, backgroundColor: P.bright }} />
            </div>
            <span className="text-sm font-bold w-8 text-right" style={{ color: P.bright }}>{agent.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MoveHistoryPanel({ history, agents }: { history: HistoryEntry[]; agents: Agent[] }) {
  const rounds = groupByRound(history)
  const sortedRounds = Array.from(rounds.keys()).sort((a, b) => b - a)
  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'rgba(24,29,49,0.35)' }}>History</p>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sortedRounds.map(round => {
          const entries = rounds.get(round)!
          return (
            <div key={round} className="rounded-lg p-2.5"
              style={{ background: 'rgba(24,29,49,0.05)', border: '1px solid rgba(24,29,49,0.07)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(24,29,49,0.3)' }}>R{round}</p>
              <div className="space-y-1.5">
                {entries.map(entry => {
                  const agent = agentById(entry.agentId, agents)
                  if (!agent) return null
                  return (
                    <div key={entry.agentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Dot color={agent.color} size={6} />
                        <span className="text-xs" style={{ color: 'rgba(24,29,49,0.6)' }}>{agent.name}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: moveTextColor(entry.move) }}>
                        {entry.move === 'Cooperate' ? 'C' : 'D'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TransmissionsPanel({ messages, agents }: { messages: Message[]; agents: Agent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'rgba(240,233,210,0.35)' }}>Transmissions</p>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((msg, i) => {
          const agent = agentById(msg.agentId, agents)
          if (!agent) return null
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <Dot color={agent.color} size={6} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.name}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(240,233,210,0.25)' }}>R{msg.round}</span>
                </div>
                <p className="text-xs leading-relaxed italic" style={{ color: 'rgba(240,233,210,0.55)' }}>
                  "{msg.text}"
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game Screen
// ---------------------------------------------------------------------------

function PrisonersDilemmaScreen({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<GameState>(initGameState(initialAgents))
  const [running, setRunning] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const runningRef = useRef(false)
  const gameStateRef = useRef(gameState)

  useEffect(() => { gameStateRef.current = gameState }, [gameState])

  const sorted = [...gameState.agents].sort((a, b) => b.score - a.score)

  const historyEntries: HistoryEntry[] = gameState.history.flatMap(r =>
    r.moves.map(m => ({ round: r.round, agentId: m.agentId, move: m.move, points: 0 }))
  )

  const messages: Message[] = gameState.history.flatMap(r =>
    r.moves.map(m => {
      const agent = gameState.agents.find(a => a.id === m.agentId)
      return { agentId: m.agentId, text: agent?.reasoning ?? '', round: r.round }
    })
  ).filter(m => m.text)

  const stepRound = async () => {
    setIsThinking(true)
    const newState = await runRound(
      { ...gameStateRef.current, isRunning: false },
      (s) => setGameState(s)
    )
    gameStateRef.current = newState
    setIsThinking(false)
    if (newState.winner) setRunning(false)
  }

  useEffect(() => {
    runningRef.current = running
    if (!running) return

    const tick = async () => {
      if (!runningRef.current) return
      setIsThinking(true)
      const newState = await runRound(
        { ...gameStateRef.current, isRunning: true },
        (s) => setGameState(s)
      )
      gameStateRef.current = newState
      setIsThinking(false)

      if (newState.winner) {
        setRunning(false)
        return
      }

      if (runningRef.current) setTimeout(tick, 2000)
    }

    tick()
  }, [running])

  const restart = () => {
    setRunning(false)
    setGameState(initGameState(initialAgents))
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <header className="px-6 py-3.5 flex items-center gap-4 shrink-0"
        style={{ background: P.navy }}>
        <button onClick={onBack} className="text-sm transition-colors"
          style={{ color: 'rgba(240,233,210,0.5)' }}
          onMouseEnter={e => (e.currentTarget.style.color = P.bright)}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,233,210,0.5)')}>
          ← Back
        </button>
        <div className="h-4 w-px" style={{ background: 'rgba(240,233,210,0.12)' }} />
        <span className="font-semibold text-sm" style={{ color: P.bright }}>Prisoner's Dilemma</span>

        <div className="ml-auto flex items-center gap-3">
          {running && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: P.teal }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: P.teal }} />
              Live
            </span>
          )}
          <span className="text-xs" style={{ color: 'rgba(240,233,210,0.35)' }}>
            Round <span className="font-semibold" style={{ color: 'rgba(240,233,210,0.7)' }}>{gameState.round}</span>
          </span>

          {/* Restart */}
          <button onClick={restart}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
            style={{ background: 'rgba(240,233,210,0.08)', color: 'rgba(240,233,210,0.5)' }}
            title="Restart">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
          </button>

          {/* Step */}
          <button
            onClick={stepRound}
            disabled={running || isThinking || !!gameState.winner}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
            style={{
              background: (running || isThinking) ? 'rgba(240,233,210,0.05)' : 'rgba(240,233,210,0.1)',
              color: (running || isThinking) ? 'rgba(240,233,210,0.2)' : P.bright,
              cursor: (running || isThinking) ? 'not-allowed' : 'pointer',
            }}
            title="Step one round">
            <StepIcon />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setRunning(r => !r)}
            disabled={!!gameState.winner}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
            style={{
              background: running ? 'rgba(240,233,210,0.1)' : P.teal,
              color: P.bright,
              cursor: gameState.winner ? 'not-allowed' : 'pointer',
            }}
            title={running ? 'Pause' : 'Play'}>
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-4">

          {/* Winner banner */}
          {gameState.winner && (
            <div className="rounded-xl p-4 text-center"
              style={{ background: gameState.winner.color, boxShadow: `0 0 24px ${gameState.winner.color}66` }}>
              <p className="text-sm font-bold" style={{ color: P.bright }}>
                🏆 {gameState.winner.name} wins with {gameState.winner.score} points!
              </p>
              <button onClick={restart} className="mt-2 text-xs underline" style={{ color: P.bright }}>
                Play again
              </button>
            </div>
          )}

          {/* Main layout: agent tiles + transmissions */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Agent tiles 2x2 (or 3x2 for 5) */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-3 content-start">
              {gameState.agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} isThinking={isThinking} />
              ))}
            </div>

            {/* Transmissions chat feed */}
            <div className="lg:col-span-2 rounded-xl p-4 flex flex-col"
              style={{
                background: 'rgba(24,29,49,0.6)',
                border: '1px solid rgba(103,137,131,0.2)',
                minHeight: '400px',
                maxHeight: '520px',
              }}>
              <TransmissionsPanel messages={messages} agents={gameState.agents} />
            </div>
          </div>

          {/* Scoreboard */}
          <Scoreboard agents={sorted} />

          {/* History */}
          <div className="rounded-xl p-4 h-56 flex flex-col" style={{ background: P.cream }}>
            <MoveHistoryPanel history={historyEntries} agents={gameState.agents} />
          </div>

        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  return (
    <div style={{ background: P.bright, minHeight: '100vh' }}>
      <Spotlight />
      {screen === 'menu' && <MenuScreen onSelect={setScreen} />}
      {screen === 'prisoners-dilemma' && <PrisonersDilemmaScreen onBack={() => setScreen('menu')} />}
    </div>
  )
}