# Wargames — Project Guide

## What This Is
A multi-agent AI war game platform. Players watch AI agents (powered by Gemini) compete in classic game theory scenarios. The frontend is a React + TypeScript + Vite SPA.

## Stack
- **React 19** with TypeScript
- **Vite 7** (bundler + dev server)
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` needed)
- **React Compiler** (`babel-plugin-react-compiler`) — enabled in `vite.config.ts`
- **`@google/generative-ai`** — Gemini SDK for agent reasoning

## Project Structure
```
wargames/
├── src/
│   ├── App.tsx        # All UI lives here — screens, components, mock data
│   ├── index.css      # Global styles + Tailwind v4 import + CSS variables
│   └── main.tsx       # Entry point
├── index.html
├── vite.config.ts
└── CLAUDE.md          # This file
```

## Screens
1. **Menu** — Card grid of available games. Only "Prisoner's Dilemma" is active; others show "Soon".
2. **Game Screen** — Agent cards, scoreboard, move history, agent log, and reasoning panel.

## Color Palette
All four palette colors are used as surface backgrounds — not just accents.

| Token | Hex | Used for |
|-------|-----|----------|
| `P.navy`   | `#181D31` | Page background, text on light surfaces |
| `P.teal`   | `#678983` | Header bar, scoreboard, play button, logo |
| `P.cream`  | `#E6DDC4` | History panel, log panel, menu cards |
| `P.bright` | `#F0E9D2` | Agent cards, reasoning cards, primary text on dark |

The `P` object is defined at the top of `App.tsx`. Use it for all color references — do not hardcode hex values elsewhere.

Text follows the surface: dark navy (`#181D31`) on cream/bright surfaces, bright cream (`#F0E9D2`) on navy/teal surfaces.

## Spotlight Effect
A cursor-following radial gradient is rendered via `<Spotlight />` (top of `App.tsx`). It uses `requestAnimationFrame` with lerp (factor `0.08`) to smoothly lag behind the cursor. Implemented with direct DOM mutation — no React state — for performance.

## Data Shape
```ts
type Agent = {
  id: string
  name: string
  color: string       // hex — used for dot, left border, badge color
  score: number
  lastMove: 'Cooperate' | 'Defect' | null
  reasoning: string
}

type HistoryEntry = {
  round: number
  agentId: string
  move: 'Cooperate' | 'Defect'
  points: number
}

type Message = {
  agentId: string
  text: string
}
```

## Games
### Prisoner's Dilemma
Each round every agent simultaneously chooses **Cooperate** or **Defect**.
- Both Cooperate → +3 each
- Both Defect → +1 each
- One Defects, one Cooperates → Defector +5, Cooperator +0

Supports ≥ 4 agents. Scores accumulate across rounds.

## Dev Commands
```bash
cd wargames
npm run dev       # start dev server
npm run build     # type-check + build
npm run lint      # eslint
npm run preview   # preview production build
```

## Environment Variables
```
VITE_GEMINI_API_KEY=...   # Primary Gemini API key
```
`.env` is already in `.gitignore`.

## Style Conventions
- All UI in `src/App.tsx`, global CSS in `src/index.css`
- Colors via the `P` palette object — no Tailwind color utilities for theme colors
- Tailwind used for layout/spacing only (`flex`, `grid`, `px-*`, `rounded-*`, etc.)
- Agent colors (dots, borders, badges) are per-agent hex values distinct from the palette
