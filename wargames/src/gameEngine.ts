import type { Agent } from "./agents";
import { getAgentMove, RoundHistory } from "./gemini";

export const WIN_SCORE = 50;

export interface GameState {
  agents: Agent[];
  history: RoundHistory[];
  round: number;
  isRunning: boolean;
  winner: Agent | null;
}

const calcPoints = (move: "Cooperate" | "Defect", opponentMoves: ("Cooperate" | "Defect")[]): number => {
  const defectors = opponentMoves.filter((m) => m === "Defect").length;
  const cooperators = opponentMoves.filter((m) => m === "Cooperate").length;

  if (move === "Cooperate") {
    return cooperators * 3 - defectors * 5;
  } else {
    return cooperators * 5 - defectors * 1;
  }
};

export const checkWinner = (agents: Agent[]): Agent | null => {
  return agents.find(a => a.score >= WIN_SCORE) ?? null;
};

export const runRound = async (
  state: GameState,
  onUpdate: (state: GameState) => void
): Promise<GameState> => {
  const { agents, history, round } = state;

  const results = await Promise.all(
    agents.map((agent) => getAgentMove(agent, agents, history))
  );

  const roundMoves: RoundHistory["moves"] = agents.map((agent, i) => ({
    agentId: agent.id,
    move: results[i].move,
  }));

  const updatedAgents: Agent[] = agents.map((agent, i) => {
    const myMove = results[i].move;
    const opponentMoves = results
      .filter((_, j) => j !== i)
      .map(r => r.move);

    const points = calcPoints(myMove, opponentMoves);

    return {
      ...agent,
      lastMove: myMove,
      reasoning: results[i].reasoning,
      score: agent.score + points,
    };
  });

  const winner = checkWinner(updatedAgents);

  const newHistory: RoundHistory = { round, moves: roundMoves };

  const newState: GameState = {
    agents: updatedAgents,
    history: [...history, newHistory],
    round: round + 1,
    isRunning: state.isRunning,
    winner: winner ?? null,
  };

  onUpdate(newState);
  return newState;
};

export const initGameState = (agents: Agent[]): GameState => ({
  agents: agents.map((a) => ({ ...a, score: 0, lastMove: null, reasoning: "" })),
  history: [],
  round: 1,
  isRunning: false,
  winner: null,
});