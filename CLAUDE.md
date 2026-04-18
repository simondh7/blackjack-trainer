# Blackjack Trainer — Project Reference

## Goal
A browser-based blackjack practice tool to help the user master perfect basic strategy and card counting. Three game modes are planned; Game 1 is complete.

**Tech stack:** Plain HTML + CSS + JavaScript. No frameworks, no build tools, no server. Open any `.html` file directly in a browser.

---

## File Structure

```
blackjack-trainer/
├── index.html          — Home page (3 mode buttons; only Game 1 active)
├── game1.html          — Game 1: Perfect Blackjack drill screen
├── css/
│   └── style.css       — Shared casino felt theme (all pages use this)
└── js/
    ├── strategy.js     — H17 basic strategy lookup tables + getOptimalAction()
    ├── handQueue.js    — ~330-combo queue generator + mistake reinforcement
    └── game1.js        — Game 1 state machine, DOM rendering, session stats
```

---

## Game Modes

### Game 1 — Perfect Blackjack (COMPLETE)
Drill every possible starting hand against every dealer upcard using perfect H17 basic strategy. Goal: build muscle memory for the correct action in every situation.

**How it works:**
- ~330 unique (player hand, dealer upcard) combinations cycle in shuffled order
- If you make the wrong move: red overlay appears showing the correct play + explanation → click Continue
- If correct: green flash, auto-advances to next hand after 0.8s
- Every 4 hands, a previously-wrong hand is re-injected into the upcoming queue
- Recent Mistakes panel shows your last 5 errors
- Keyboard shortcuts: H = Hit, S = Stand, D = Double, P = Split, R = Surrender, Enter = Continue

**Hand categories drilled (330 total):**
- Pairs: 10 pair types (2,2 through A,A) × 10 dealer upcards = 100
- Soft hands: A,2 through A,9 × 10 dealer upcards = 80
- Hard hands: Hard 5 through Hard 19 × 10 dealer upcards = 150

---

### Game 2 — Card Counting (NOT YET BUILT)
Practice the Hi-Lo card counting system with a running shoe.

**Planned features:**
- Real shoe simulation (6 decks)
- Cards are revealed one at a time; player must maintain a running count
- Feedback when count is wrong — show the correct running count and explain the Hi-Lo value of each card
- Practice the running count, then add true count conversion (running count ÷ decks remaining)
- Drill count alone (no playing decisions) so it can be mastered independently

**Hi-Lo count values:**
- 2, 3, 4, 5, 6 = +1
- 7, 8, 9 = 0
- 10, J, Q, K, A = -1

---

### Game 3 — Perfect Game (NOT YET BUILT)
Combine Game 1 (strategy) + Game 2 (counting) together as a full casino simulation.

**Planned features:**
- Play full blackjack hands from a running 6-deck shoe
- Must make the correct basic strategy decision AND maintain accurate count simultaneously
- Feedback on both: wrong play AND wrong count each trigger corrections
- Simulates real casino pressure of doing both at once

---

## Strategy Reference: H17 Basic Strategy

**Rules:** 6-deck, Dealer Hits Soft 17, Late Surrender, DAS (Double After Split) offered.
**Source:** Blackjack Apprenticeship H17 Basic Strategy chart.

### Hard Totals (dealer upcard: 2, 3, 4, 5, 6, 7, 8, 9, 10, A)
```
≤8:   H   H   H   H   H   H   H   H   H   H
9:    H   D   D   D   D   H   H   H   H   H
10:   D   D   D   D   D   D   D   D   H   H
11:   D   D   D   D   D   D   D   D   D   D   ← Double vs Ace (H17 rule!)
12:   H   H   S   S   S   H   H   H   H   H
13:   S   S   S   S   S   H   H   H   H   H
14:   S   S   S   S   S   H   H   H   H   H
15:   S   S   S   S   S   H   H   H   Rh  Rh  ← Surrender vs 10, A
16:   S   S   S   S   S   H   H   Rh  Rh  Rh  ← Surrender vs 9, 10, A
17:   S   S   S   S   S   S   S   S   S   Rs  ← Surrender vs A
≥18:  S   S   S   S   S   S   S   S   S   S
```
- D = Double (or Hit if can't double)
- Rh = Surrender (or Hit if can't surrender)
- Rs = Surrender (or Stand if can't surrender)

### Soft Totals (dealer upcard: 2, 3, 4, 5, 6, 7, 8, 9, 10, A)
```
A,2:  H   H   H   D   D   H   H   H   H   H
A,3:  H   H   H   D   D   H   H   H   H   H
A,4:  H   H   D   D   D   H   H   H   H   H
A,5:  H   H   D   D   D   H   H   H   H   H
A,6:  H   D   D   D   D   H   H   H   H   H
A,7:  Ds  Ds  Ds  Ds  Ds  S   S   H   H   H  ← Double vs 2-6; Stand vs 7-8; Hit vs 9+
A,8:  S   S   S   S   Ds  S   S   S   S   S  ← Double vs 6 only
A,9:  S   S   S   S   S   S   S   S   S   S
```
- D  = Double (or Hit if can't double)
- Ds = Double (or Stand if can't double)

### Pair Splitting (dealer upcard: 2, 3, 4, 5, 6, 7, 8, 9, 10, A)
```
A,A:  P   P   P   P   P   P   P   P   P   P   Always split
T,T:  S   S   S   S   S   S   S   S   S   S   Never split
9,9:  P   P   P   P   P   S   P   P   S   S
8,8:  P   P   P   P   P   P   P   P   P  Sur  ← Surrender vs A
7,7:  P   P   P   P   P   P   H   H   H   H
6,6:  P   P   P   P   P   H   H   H   H   H   (DAS: also split vs 2)
5,5:  D   D   D   D   D   D   D   D   H   H   Never split; play as Hard 10
4,4:  H   H   H   P   P   H   H   H   H   H   (DAS: split vs 5-6)
3,3:  P   P   P   P   P   P   H   H   H   H   (DAS: also split vs 2-3)
2,2:  P   P   P   P   P   P   H   H   H   H   (DAS: also split vs 2-3)
```
- Sur = Surrender if available, otherwise Split (only 8,8 vs A)
- DAS = Double After Split assumed offered (standard 6-deck casino rule)

### Key Rules: Insurance & Even Money
**Never take.** Always displayed as a reminder in the UI.

---

## Key Technical Details

### Action Code System (strategy.js)
Raw actions from the table are normalised before comparing to the player's choice:
- `D` or `Ds` + canDouble=true → `'D'` (player just clicks "Double")
- `Rh`, `Rs`, `Sur` + canSurrender=true → `'Surrender'` (player clicks "Surrender")
- Fallbacks: `D` → `'H'`, `Ds` → `'S'`, `Rh` → `'H'`, `Rs` → `'S'`, `Sur` → `'P'`

### Strategy Lookup Priority (getOptimalAction)
1. Pair check first (A,A is a pair before it's a soft hand)
2. Soft hand check (Ace counting as 11 keeps total ≤21)
3. Hard total fallback

### Hand Queue Algorithm (handQueue.js)
- Master list of ~330 combos generated once, never mutated
- Working queue = shuffled copy; refilled from master when empty
- Mistake buffer: up to 20 entries, keyed by combo signature, tracks error count
- Every 4 hands: random mistake injected 1–3 positions ahead in queue
- Cap: evicts lowest-error-count entry when buffer exceeds 20

### CSS Theme Tokens
```
--felt:       #1b5e20   (main background)
--gold:       #d4a843   (borders, accents, headings)
--card-bg:    #f8f4e8   (card face)
--card-red:   #c0392b   (hearts/diamonds)
--correct:    #27ae60   (correct flash / continue button)
--wrong:      #c0392b   (wrong overlay border)
```

### Script Load Order in game pages
```html
<script src="js/strategy.js"></script>   <!-- no deps -->
<script src="js/handQueue.js"></script>  <!-- no deps -->
<script src="js/game1.js"></script>      <!-- depends on both above -->
```

All functions are plain globals (no modules) — works without any server.

---

## Reusable Assets for Future Games

- **`strategy.js`** — `getOptimalAction()`, `describeHand()`, `computeHandTotal()`, `isPair()` are all reusable for Games 2 & 3
- **`style.css`** — all home page and shared styles; Game 2/3 pages should `<link>` to the same file
- **`index.html`** — just enable the relevant button and add a `href` when the game is ready
