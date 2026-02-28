import { useState, useRef, useEffect } from 'react'
import { agents, type Agent } from './agents'
import { initGameState, runRound, type GameState, LOSE_SCORE } from './gameEngine'
import { milAgents } from './milAgents.ts'
import { initMilGameState, runMilRound } from './milGameEngine.ts'
import { THREAT_LOCK } from './milTypes.ts'
import type { MilGameState, MilAction } from './milTypes.ts'

type Screen = 'menu' | 'game' | 'wargames'
type Mode = 'play' | 'fast' | null

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  if (screen === 'menu') return <MenuScreen onSelect={setScreen} />
  if (screen === 'wargames') return <WarGamesScreen onBack={() => setScreen('menu')} />
  return <GameScreen onBack={() => setScreen('menu')} />
}

function MenuScreen({ onSelect }: { onSelect: (s: Screen) => void }) {
  return (
    <div style={{ background: '#080b12', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: 16, fontSize: 48 }}>⚔️</div>
      <h1 style={{ color: '#f0f0f0', fontSize: 42, fontWeight: 800, letterSpacing: -1, margin: '0 0 8px' }}>Wargames</h1>
      <p style={{ color: '#555', fontSize: 15, marginBottom: 48 }}>AI agents play game theory. Last one standing wins.</p>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ background: '#111827', border: '1px solid #1e2a40', borderRadius: 14, padding: '28px 32px', width: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🤝</span>
          <span style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 17 }}>Prisoner's Dilemma</span>
          <span style={{ color: '#445', fontSize: 13, lineHeight: 1.5 }}>Cooperate or defect. Last agent above -50 wins.</span>
          <button onClick={() => onSelect('game')}
            style={{ marginTop: 8, background: '#4ade80', color: '#000', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
            Play
          </button>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1e2a40', borderRadius: 14, padding: '28px 32px', width: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 28 }}>☢️</span>
          <span style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 17 }}>WarGames</span>
          <span style={{ color: '#445', fontSize: 13, lineHeight: 1.5 }}>Strike, posture, launch. The only winning move is not to play.</span>
          <button onClick={() => onSelect('wargames')}
            style={{ marginTop: 8, background: '#f87171', color: '#000', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
            Play
          </button>
        </div>
      </div>
    </div>
  )
}

const ACTION_COLOR: Record<MilAction, string> = {
  'stand-down': '#4ade80',
  'posture':    '#facc15',
  'strike':     '#f87171',
  'launch':     '#fb923c',
  'backdoor':   '#c084fc',
}

const getThreatColors = (score: number) => {
  if (score === 0)         return { bg: '#0a0e1a', text: '#1e2a3a' }
  if (score <= 2)          return { bg: '#1c1506', text: '#a07838' }
  if (score <= 4)          return { bg: '#2e1a06', text: '#e07828' }
  if (score < THREAT_LOCK) return { bg: '#3e1208', text: '#f86038' }
  return                          { bg: '#5e0e0e', text: '#f87171' }
}

function WarGamesScreen({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<MilGameState>(initMilGameState(milAgents))
  const [thinking, setThinking] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [flashAgents, setFlashAgents] = useState<Set<string>>(new Set())
  const [stabEvent, setStabEvent] = useState<'strike' | 'peace' | null>(null)
  const [showRules, setShowRules] = useState(false)
  const modeRef = useRef<Mode>(null)
  const gameStateRef = useRef(gameState)
  const logRef = useRef<HTMLDivElement>(null)
  const prevRoundRef = useRef(1)

  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [gameState.log])

  // Flash cards whenever a new round completes
  useEffect(() => {
    if (gameState.round <= prevRoundRef.current) return
    prevRoundRef.current = gameState.round
    const actors = new Set(gameState.agents.filter(a => a.lastAction && !gameState.eliminated.includes(a.id)).map(a => a.id))
    setFlashAgents(actors)
    setTimeout(() => setFlashAgents(new Set()), 900)
  }, [gameState.round])

  // Detect Global Strike / Peace Dividend events
  useEffect(() => {
    const lastRound = gameState.round - 1
    const ev = gameState.log.find(e => e.agentId === '_event_' && e.round === lastRound)
    if (!ev) return
    const type = ev.outcome.includes('GLOBAL STRIKE') ? 'strike' : ev.outcome.includes('PEACE DIVIDEND') ? 'peace' : null
    if (!type) return
    setStabEvent(type)
    setTimeout(() => setStabEvent(null), 1400)
  }, [gameState.log.length])

  const winner = gameState.winner
  const running = mode !== null
  const disabled = !!winner

  const step = async () => {
    if (thinking) return
    setThinking(true)
    const next = await runMilRound(gameStateRef.current, setGameState)
    gameStateRef.current = next
    setThinking(false)
    if (next.winner) setMode(null)
    return next
  }

  useEffect(() => {
    modeRef.current = mode
    if (!mode) return
    const delay = mode === 'fast' ? 500 : 5000
    const tick = async () => {
      if (!modeRef.current) return
      await step()
      if (modeRef.current) setTimeout(tick, delay)
    }
    tick()
  }, [mode])

  const restart = () => {
    setMode(null)
    setThinking(false)
    prevRoundRef.current = 1
    setGameState(initMilGameState(milAgents))
  }

  const btnBase: React.CSSProperties = { border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }
  const stabPct = (gameState.stability / 20) * 100
  const stabColor = gameState.stability >= 15 ? '#4ade80' : gameState.stability >= 8 ? '#facc15' : '#f87171'

  return (
    <div style={{ background: '#080b12', minHeight: '100vh', color: '#e8e8e8', fontFamily: "'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <style>{`
        @keyframes threatPulse {
          0%, 100% { box-shadow: inset 0 0 6px #f8717166; }
          50%       { box-shadow: inset 0 0 14px #f87171bb; }
        }
        @keyframes cardFlash {
          0%   { filter: brightness(2.2); }
          60%  { filter: brightness(1.3); }
          100% { filter: brightness(1);   }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes eventFlashRed {
          0%   { opacity: 0.55; }
          100% { opacity: 0;    }
        }
        @keyframes eventFlashGreen {
          0%   { opacity: 0.45; }
          100% { opacity: 0;    }
        }
      `}</style>

      {/* Stability event overlay */}
      {stabEvent && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
          background: stabEvent === 'strike' ? '#f87171' : '#4ade80',
          animation: `${stabEvent === 'strike' ? 'eventFlashRed' : 'eventFlashGreen'} 1.4s ease-out forwards`,
        }} />
      )}

      {showRules && (
        <RulesModal title="☢️ WarGames — Rules" onClose={() => setShowRules(false)}>
          <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' }}>
            50 rounds. Each agent picks one action per round. <strong style={{ color: '#e8e8e8' }}>Highest resources at round 50 wins.</strong> Fall to −20 and you're eliminated.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
            <tbody>
              {([
                ['stand-down', '#4ade80', '−1 res · +1 stability (3+ together: +3 bonus)'],
                ['posture',    '#facc15', 'Target −1 res · threat +1 with all'],
                ['strike',     '#f87171', 'You +3, target −4 res · threat +2 with all'],
                ['launch',     '#fb923c', 'Target eliminated · you locked to stand-down · threat +5'],
                ['backdoor',   '#c084fc', '50%: target −3 silent · 50%: traced, threat +3'],
              ] as const).map(([action, color, desc]) => (
                <tr key={action} style={{ borderBottom: '1px solid #131a28' }}>
                  <td style={{ padding: '6px 10px 6px 0', color, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{action}</td>
                  <td style={{ padding: '6px 0', color: '#8899bb', lineHeight: 1.4 }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 8px', lineHeight: 1.6 }}>⚠ Threat ≥7 → auto-posture lock every round.</p>
          <p style={{ color: '#8899bb', fontSize: 12, margin: 0, lineHeight: 1.6 }}>Stability 0 → Global Strike (everyone −5). Stability 20 → Peace Dividend (everyone +4, all threats −2).</p>
        </RulesModal>
      )}

      {/* Header */}
      <div style={{ background: '#0d1120', borderBottom: '1px solid #1e2540', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Back</button>
        <span style={{ color: '#778', fontSize: 13 }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>☢️ WarGames</span>
        <span style={{ color: '#445', fontSize: 13, background: '#1a2030', borderRadius: 5, padding: '2px 8px' }}>
          Round {gameState.round} / {gameState.maxRounds}
        </span>
        <span style={{ fontSize: 12, color: stabColor, background: stabColor + '18', borderRadius: 5, padding: '2px 8px', fontWeight: 700, transition: 'color 0.5s, background 0.5s' }}>
          ⚖ Stability {gameState.stability}/20
        </span>
        {thinking && <span style={{ color: '#f87171', fontSize: 12 }}>● computing...</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowRules(r => !r)} style={{ ...btnBase, background: showRules ? '#1a2535' : '#1a2030', color: showRules ? '#88aacc' : '#778', border: `1px solid ${showRules ? '#2a3a50' : 'transparent'}` }}>Rules</button>
          <button onClick={restart} style={{ ...btnBase, background: '#1a2030', color: '#aaa' }}>↺ Restart</button>
          <button onClick={step} disabled={thinking || running || disabled}
            style={{ ...btnBase, background: '#1a2030', color: '#e8e8e8', opacity: (thinking || running || disabled) ? 0.3 : 1, cursor: (thinking || running || disabled) ? 'default' : 'pointer' }}>
            Step
          </button>
          <button onClick={() => setMode(m => m === 'play' ? null : 'play')} disabled={disabled || mode === 'fast'}
            style={{ ...btnBase, background: mode === 'play' ? '#f87171' : '#4ade80', color: '#000', opacity: (disabled || mode === 'fast') ? 0.3 : 1, cursor: (disabled || mode === 'fast') ? 'default' : 'pointer' }}>
            {mode === 'play' ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => setMode(m => m === 'fast' ? null : 'fast')} disabled={disabled || mode === 'play'}
            style={{ ...btnBase, background: mode === 'fast' ? '#f87171' : '#facc15', color: '#000', opacity: (disabled || mode === 'play') ? 0.3 : 1, cursor: (disabled || mode === 'play') ? 'default' : 'pointer' }}>
            {mode === 'fast' ? '⏸ Pause' : '⏩ Fast'}
          </button>
        </div>
      </div>

      {/* Stability bar */}
      <div style={{ height: 5, background: '#060810', flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#1e2535' }} />
        <div style={{ height: '100%', width: `${stabPct}%`, background: stabColor, transition: 'width 0.7s ease, background 0.7s ease', boxShadow: `0 0 8px ${stabColor}88` }} />
      </div>

      {/* Winner banner */}
      {winner && (
        <div style={{ background: `${winner.color}22`, borderBottom: `2px solid ${winner.color}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ color: winner.color, fontWeight: 800, fontSize: 17 }}>🏆 {winner.name} wins!</span>
          <span style={{ color: '#888', fontSize: 14 }}>Ended with {winner.resources} resources</span>
          <button onClick={restart} style={{ ...btnBase, marginLeft: 'auto', background: winner.color, color: '#000' }}>Play Again</button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Agent cards */}
        <div style={{ flex: 5, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
          {gameState.agents.map(agent => {
            const isElim = gameState.eliminated.includes(agent.id)
            const health = Math.max(0, Math.min(1, (agent.resources + 20) / 40))
            const healthColor = health > 0.6 ? '#4ade80' : health > 0.3 ? '#facc15' : '#f87171'
            const actionColor = agent.lastAction ? (ACTION_COLOR[agent.lastAction] ?? '#778') : '#778'
            const isFlashing = flashAgents.has(agent.id)
            return (
              <div key={agent.id} style={{
                background: isElim ? '#0a0d16' : '#111827',
                border: `1px solid ${isElim ? '#151c2a' : agent.color + '55'}`,
                borderRadius: 12, padding: 14,
                opacity: isElim ? 0.38 : 1,
                boxShadow: isElim ? 'none' : `0 0 20px ${agent.color}11`,
                transition: 'opacity 0.4s, border-color 0.4s, box-shadow 0.4s',
                animation: isFlashing ? 'cardFlash 0.9s ease-out forwards' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isElim ? '#222' : agent.color, boxShadow: isElim ? 'none' : `0 0 6px ${agent.color}` }} />
                    <span style={{ color: isElim ? '#333' : agent.color, fontWeight: 700, fontSize: 14, textDecoration: isElim ? 'line-through' : 'none' }}>{agent.name}</span>
                    {isElim && <span style={{ fontSize: 9, color: '#f87171', fontWeight: 700, background: '#f8717118', borderRadius: 4, padding: '1px 5px' }}>OUT</span>}
                    {agent.isLaunched && !isElim && <span style={{ fontSize: 9, color: '#fb923c', fontWeight: 700, background: '#fb923c18', borderRadius: 4, padding: '1px 5px' }}>LAUNCHED</span>}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 20, color: agent.resources < 0 ? '#f87171' : '#e8e8e8', fontVariantNumeric: 'tabular-nums', transition: 'color 0.4s' }}>{agent.resources}</span>
                </div>

                {/* Resource bar */}
                <div style={{ background: '#0d1120', borderRadius: 3, height: 3, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ background: healthColor, width: `${health * 100}%`, height: '100%', borderRadius: 3, transition: 'width 0.6s ease, background 0.6s ease' }} />
                </div>

                {/* Last action badge */}
                {agent.lastAction && !isElim && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                    background: actionColor + '18', color: actionColor, border: `1px solid ${actionColor}33`,
                    textTransform: 'uppercase', display: 'inline-block',
                  }}>
                    {agent.lastAction}{agent.lastTarget ? ` → ${gameState.agents.find(a => a.id === agent.lastTarget)?.name ?? agent.lastTarget}` : ''}
                  </span>
                )}

                {/* Reasoning */}
                {!isElim && (
                  <p style={{ color: '#8899bb', fontSize: 12, fontStyle: 'italic', marginTop: 8, marginBottom: 0, minHeight: 28, lineHeight: 1.5 }}>
                    {thinking ? '...' : agent.reasoning ? `"${agent.reasoning}"` : 'Awaiting orders...'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Right panel: threat heatmap + log */}
        <div style={{ flex: 3, borderLeft: '1px solid #131a28', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Threat heatmap */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #131a28', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#334', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Threat Matrix</div>
            {(() => {
              const all = gameState.agents
              const CELL = 32
              const ROW_HEADER = 54
              return (
                <div style={{ display: 'inline-block' }}>
                  {/* Column headers */}
                  <div style={{ display: 'flex', paddingLeft: ROW_HEADER }}>
                    {all.map(a => (
                      <div key={a.id} style={{ width: CELL, textAlign: 'center', fontSize: 8, color: gameState.eliminated.includes(a.id) ? '#222' : a.color, fontWeight: 700, letterSpacing: 0.5, overflow: 'hidden' }}>
                        {a.name.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {all.map(rowAgent => {
                    const rowElim = gameState.eliminated.includes(rowAgent.id)
                    return (
                      <div key={rowAgent.id} style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                        <div style={{ width: ROW_HEADER, fontSize: 9, color: rowElim ? '#222' : rowAgent.color, fontWeight: 700, textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>
                          {rowAgent.name}
                        </div>
                        {all.map(colAgent => {
                          if (rowAgent.id === colAgent.id) {
                            return <div key={colAgent.id} style={{ width: CELL, height: CELL, background: '#060810', border: '1px solid #0d1020', flexShrink: 0 }} />
                          }
                          const score = rowAgent.threatMap[colAgent.id] ?? 0
                          const isLocked = score >= THREAT_LOCK
                          const colElim = gameState.eliminated.includes(colAgent.id)
                          const { bg, text } = getThreatColors(rowElim || colElim ? 0 : score)
                          return (
                            <div key={colAgent.id} style={{
                              width: CELL, height: CELL, flexShrink: 0,
                              background: bg, border: '1px solid #0d1020',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: text,
                              transition: 'background 0.5s, color 0.5s',
                              animation: isLocked && !rowElim && !colElim ? 'threatPulse 1.6s ease-in-out infinite' : 'none',
                            }}>
                              {rowElim || colElim ? '' : (score === 0 ? '' : score)}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Operations log */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #131a28', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#334', letterSpacing: 2, textTransform: 'uppercase' }}>Operations Log</span>
            </div>
            <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gameState.log.length === 0 && (
                <p style={{ color: '#1e2535', fontSize: 12, fontStyle: 'italic', margin: 0 }}>No operations logged...</p>
              )}
              {gameState.log.map((entry, i) => {
                const isEvent = entry.agentId === '_event_'
                const agent = isEvent ? null : gameState.agents.find(a => a.id === entry.agentId)
                const ac = isEvent ? '#facc15' : (agent ? (ACTION_COLOR[entry.action] ?? '#778') : '#778')
                const isNew = entry.round === gameState.round - 1
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, animation: isNew ? 'slideInUp 0.3s ease-out' : 'none' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isEvent ? '#facc15' : (agent?.color ?? '#334'), marginTop: 4, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 1, flexWrap: 'wrap' }}>
                        <span style={{ color: isEvent ? '#facc15' : (agent?.color ?? '#556'), fontWeight: 700, fontSize: 11 }}>
                          {isEvent ? 'SYSTEM' : (agent?.name ?? entry.agentId)}
                        </span>
                        <span style={{ color: '#1e2535', fontSize: 9 }}>R{entry.round}</span>
                        {!isEvent && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, color: ac, background: ac + '14', textTransform: 'uppercase' }}>
                            {entry.action}
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#445566', fontSize: 10, margin: 0, lineHeight: 1.4 }}>{entry.outcome}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RulesModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1120', border: '1px solid #1e2540', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 80px #000000cc' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2540', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#e8e8e8' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

function GameScreen({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<GameState>(initGameState(agents))
  const [thinking, setThinking] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const modeRef = useRef<Mode>(null)
  const gameStateRef = useRef(gameState)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [gameState.history])

  const winner = gameState.winner
  const running = mode !== null
  const disabled = !!winner
  const [showRules, setShowRules] = useState(false)

  const step = async () => {
    if (thinking) return
    setThinking(true)
    const next = await runRound(gameStateRef.current, setGameState)
    gameStateRef.current = next
    setThinking(false)
    if (next.winner) setMode(null)
    return next
  }

  useEffect(() => {
    modeRef.current = mode
    if (!mode) return
    const delay = mode === 'fast' ? 500 : 5000
    const tick = async () => {
      if (!modeRef.current) return
      await step()
      if (modeRef.current) setTimeout(tick, delay)
    }
    tick()
  }, [mode])

  const restart = () => {
    setMode(null)
    setThinking(false)
    setGameState(initGameState(agents))
  }

  const btnBase: React.CSSProperties = { border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }

  return (
    <div style={{ background: '#080b12', minHeight: '100vh', color: '#e8e8e8', fontFamily: "'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#0d1120', borderBottom: '1px solid #1e2540', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Back</button>
        <span style={{ color: '#778', fontSize: 13 }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Prisoner's Dilemma</span>
        <span style={{ color: '#445', fontSize: 13, background: '#1a2030', borderRadius: 5, padding: '2px 8px' }}>Round {gameState.round}</span>
        {thinking && <span style={{ color: '#4ade80', fontSize: 12 }}>● thinking...</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowRules(r => !r)} style={{ ...btnBase, background: showRules ? '#0d1f14' : '#1a2030', color: showRules ? '#4ade80' : '#778', border: `1px solid ${showRules ? '#1e4030' : 'transparent'}` }}>Rules</button>
          <button onClick={restart} style={{ ...btnBase, background: '#1a2030', color: '#aaa' }}>↺ Restart</button>
          <button onClick={step} disabled={thinking || running || disabled}
            style={{ ...btnBase, background: '#1a2030', color: '#e8e8e8', opacity: (thinking || running || disabled) ? 0.3 : 1, cursor: (thinking || running || disabled) ? 'default' : 'pointer' }}>
            Step
          </button>
          <button onClick={() => setMode(m => m === 'play' ? null : 'play')} disabled={disabled || mode === 'fast'}
            style={{ ...btnBase, background: mode === 'play' ? '#f87171' : '#4ade80', color: '#000', opacity: (disabled || mode === 'fast') ? 0.3 : 1, cursor: (disabled || mode === 'fast') ? 'default' : 'pointer' }}>
            {mode === 'play' ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => setMode(m => m === 'fast' ? null : 'fast')} disabled={disabled || mode === 'play'}
            style={{ ...btnBase, background: mode === 'fast' ? '#f87171' : '#facc15', color: '#000', opacity: (disabled || mode === 'play') ? 0.3 : 1, cursor: (disabled || mode === 'play') ? 'default' : 'pointer' }}>
            {mode === 'fast' ? '⏸ Pause' : '⏩ Fast'}
          </button>
        </div>
      </div>

      {/* Winner banner */}
      {winner && (
        <div style={{ background: `${winner.color}22`, borderBottom: `2px solid ${winner.color}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: winner.color, fontWeight: 800, fontSize: 17 }}>🏆 {winner.name} wins!</span>
          <span style={{ color: '#888', fontSize: 14 }}>Last faction standing with {winner.score} points</span>
          <button onClick={restart} style={{ ...btnBase, marginLeft: 'auto', background: winner.color, color: '#000' }}>Play Again</button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Agent cards */}
        <div style={{ flex: 3, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start', overflowY: 'auto' }}>
          {gameState.agents.map((agent: Agent) => {
            const isEliminated = gameState.eliminated.includes(agent.id)
            const health = Math.max(0, Math.min(1, (agent.score - LOSE_SCORE) / (-LOSE_SCORE)))
            const healthColor = health > 0.6 ? '#4ade80' : health > 0.3 ? '#facc15' : '#f87171'
            return (
              <div key={agent.id} style={{
                background: isEliminated ? '#0a0d16' : '#111827',
                border: `1px solid ${isEliminated ? '#151c2a' : agent.color + '44'}`,
                borderRadius: 12,
                padding: 16,
                opacity: isEliminated ? 0.4 : 1,
                boxShadow: isEliminated ? 'none' : `0 0 24px ${agent.color}0d`,
                transition: 'all 0.3s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isEliminated ? '#222' : agent.color, boxShadow: isEliminated ? 'none' : `0 0 6px ${agent.color}` }} />
                    <span style={{ color: isEliminated ? '#333' : agent.color, fontWeight: 700, fontSize: 15, textDecoration: isEliminated ? 'line-through' : 'none' }}>{agent.name}</span>
                    {isEliminated && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, background: '#f8717118', borderRadius: 4, padding: '1px 5px' }}>OUT</span>}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 22, color: agent.score < 0 ? '#f87171' : '#e8e8e8', fontVariantNumeric: 'tabular-nums' }}>{agent.score}</span>
                </div>

                {/* Health bar */}
                <div style={{ background: '#0d1120', borderRadius: 3, height: 4, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ background: healthColor, width: `${health * 100}%`, height: '100%', borderRadius: 3, transition: 'width 0.5s, background 0.5s' }} />
                </div>

                {/* Last move badge */}
                {agent.lastMove && !isEliminated && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: agent.lastMove === 'Cooperate' ? '#4ade8018' : '#f8717118',
                    color: agent.lastMove === 'Cooperate' ? '#4ade80' : '#f87171',
                    border: `1px solid ${agent.lastMove === 'Cooperate' ? '#4ade8033' : '#f8717133'}`,
                  }}>
                    {agent.lastMove}
                  </span>
                )}

                {/* Reasoning */}
                {!isEliminated && (
                  <p style={{ color: '#8899bb', fontSize: 18, fontStyle: 'italic', marginTop: 10, marginBottom: 0, minHeight: 32, lineHeight: 1.5 }}>
                    {thinking ? '...' : agent.reasoning ? `"${agent.reasoning}"` : 'Awaiting first move...'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {showRules && (
          <RulesModal title="🤝 Prisoner's Dilemma — Rules" onClose={() => setShowRules(false)}>
            <p style={{ color: '#8899bb', fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' }}>
              Each round, every agent simultaneously picks <strong style={{ color: '#4ade80' }}>Cooperate</strong> or <strong style={{ color: '#f87171' }}>Defect</strong>. Score is updated against all opponents.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #131a28' }}>
                  <td style={{ padding: '8px 12px 8px 0', color: '#4ade80', fontWeight: 700 }}>Cooperate</td>
                  <td style={{ padding: '8px 0', color: '#8899bb' }}>+3 per cooperating opponent, −2 per defecting opponent</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 8px 0', color: '#f87171', fontWeight: 700 }}>Defect</td>
                  <td style={{ padding: '8px 0', color: '#8899bb' }}>+5 per cooperating opponent, −4 per defecting opponent</td>
                </tr>
              </tbody>
            </table>
            <p style={{ color: '#8899bb', fontSize: 12, margin: 0, lineHeight: 1.6 }}>Score drops to <strong style={{ color: '#f87171' }}>−50</strong> → eliminated. Last survivor wins.</p>
          </RulesModal>
        )}

        {/* Transmissions panel */}
        <div style={{ flex: 2, borderLeft: '1px solid #131a28', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #131a28', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#334', letterSpacing: 2, textTransform: 'uppercase' }}>Transmissions</span>
          </div>
          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {gameState.history.length === 0 && (
              <p style={{ color: '#1e2535', fontSize: 13, fontStyle: 'italic', margin: 0 }}>No transmissions yet...</p>
            )}
            {gameState.history.map(round =>
              round.moves.map(m => {
                const agent = gameState.agents.find(a => a.id === m.agentId)
                if (!agent) return null
                return (
                  <div key={`${round.round}-${m.agentId}`} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: agent.color, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ color: agent.color, fontWeight: 700, fontSize: 13 }}>{agent.name}</span>
                        <span style={{ color: '#1e2535', fontSize: 11 }}>R{round.round}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                          color: m.move === 'Cooperate' ? '#4ade80' : '#f87171',
                          background: m.move === 'Cooperate' ? '#4ade8012' : '#f8717112',
                        }}>
                          {m.move}
                        </span>
                      </div>
                      {agent.reasoning && <p style={{ color: '#7788aa', fontSize: 12, fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>"{agent.reasoning}"</p>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
