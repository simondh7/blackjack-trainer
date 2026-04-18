// strategy.js — H17 Basic Strategy (6-deck, Dealer Hits Soft 17, Late Surrender, DAS)
// Source: Blackjack Apprenticeship H17 Basic Strategy Chart

// Dealer upcard column index: 2→0, 3→1, 4→2, 5→3, 6→4, 7→5, 8→6, 9→7, 10→8, A→9
const DEALER_IDX = { 2:0, 3:1, 4:2, 5:3, 6:4, 7:5, 8:6, 9:7, 10:8, 'A':9 };

// Hard totals table — dealer upcards: 2  3  4  5  6  7  8  9  10  A
const HARD_TABLE = {
  4:  ['H','H','H','H','H','H','H','H','H','H'],
  5:  ['H','H','H','H','H','H','H','H','H','H'],
  6:  ['H','H','H','H','H','H','H','H','H','H'],
  7:  ['H','H','H','H','H','H','H','H','H','H'],
  8:  ['H','H','H','H','H','H','H','H','H','H'],
  9:  ['H','D','D','D','D','H','H','H','H','H'],
  10: ['D','D','D','D','D','D','D','D','H','H'],
  11: ['D','D','D','D','D','D','D','D','D','D'],  // Double vs Ace — H17 rule
  12: ['H','H','S','S','S','H','H','H','H','H'],
  13: ['S','S','S','S','S','H','H','H','H','H'],
  14: ['S','S','S','S','S','H','H','H','H','H'],
  15: ['S','S','S','S','S','H','H','H','Rh','Rh'],  // Surrender vs 10, A
  16: ['S','S','S','S','S','H','H','Rh','Rh','Rh'], // Surrender vs 9, 10, A
  17: ['S','S','S','S','S','S','S','S','S','Rs'],   // Surrender vs A
  18: ['S','S','S','S','S','S','S','S','S','S'],
  19: ['S','S','S','S','S','S','S','S','S','S'],
  20: ['S','S','S','S','S','S','S','S','S','S'],
  21: ['S','S','S','S','S','S','S','S','S','S'],
};

// Soft totals table (Ace + kicker) — dealer upcards: 2  3  4  5  6  7  8  9  10  A
// Key = soft total (Ace counted as 11): A,2=13 through A,9=20
const SOFT_TABLE = {
  13: ['H','H','H','D','D','H','H','H','H','H'],   // A,2
  14: ['H','H','H','D','D','H','H','H','H','H'],   // A,3
  15: ['H','H','D','D','D','H','H','H','H','H'],   // A,4
  16: ['H','H','D','D','D','H','H','H','H','H'],   // A,5
  17: ['H','D','D','D','D','H','H','H','H','H'],   // A,6
  18: ['Ds','Ds','Ds','Ds','Ds','S','S','H','H','H'], // A,7 — Double vs 2-6, Stand vs 7-8, Hit vs 9+
  19: ['S','S','S','S','Ds','S','S','S','S','S'],  // A,8 — Double vs 6 only
  20: ['S','S','S','S','S','S','S','S','S','S'],   // A,9
};

// Pair splitting table — dealer upcards: 2  3  4  5  6  7  8  9  10  A
// 'Sur' = Surrender if available, otherwise Split (8,8 vs A only)
// DAS (Double After Split) assumed offered — Y/N cells treated as Y (split)
const PAIR_TABLE = {
  'A':  ['P','P','P','P','P','P','P','P','P','P'],  // Always split
  '2':  ['P','P','P','P','P','P','H','H','H','H'],  // DAS: split vs 2-7
  '3':  ['P','P','P','P','P','P','H','H','H','H'],  // DAS: split vs 2-7
  '4':  ['H','H','H','P','P','H','H','H','H','H'],  // DAS: split vs 5-6
  '5':  ['D','D','D','D','D','D','D','D','H','H'],  // Never split — play as Hard 10
  '6':  ['P','P','P','P','P','H','H','H','H','H'],  // DAS: split vs 2-6
  '7':  ['P','P','P','P','P','P','H','H','H','H'],  // Split vs 2-7
  '8':  ['P','P','P','P','P','P','P','P','P','Sur'], // Always split; Surrender vs A
  '9':  ['P','P','P','P','P','S','P','P','S','S'],  // Split vs 2-9 except 7
  '10': ['S','S','S','S','S','S','S','S','S','S'],  // Never split T,T
};

// Action codes:
//   H   = Hit
//   S   = Stand
//   D   = Double (if allowed, otherwise Hit)
//   Ds  = Double (if allowed, otherwise Stand)
//   P   = Split
//   Rh  = Surrender (if allowed, otherwise Hit)
//   Rs  = Surrender (if allowed, otherwise Stand)
//   Sur = Surrender (if allowed, otherwise Split) — 8,8 vs A only

const ACTION_LABELS = {
  'H':         'Hit',
  'S':         'Stand',
  'D':         'Double Down',
  'Ds':        'Double Down',
  'P':         'Split',
  'Rh':        'Surrender',
  'Rs':        'Surrender',
  'Sur':       'Surrender',
  'Surrender': 'Surrender',
};

// Normalize any face card / ten-value card to numeric 10
function normalizeCard(card) {
  if (card === 'J' || card === 'Q' || card === 'K') return 10;
  if (card === 'A') return 'A';
  return parseInt(card, 10);
}

// Compute hand total and whether it's soft
// Returns { total, isSoft }
function computeHandTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const v = normalizeCard(card);
    if (v === 'A') { total += 11; aces++; }
    else total += v;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, isSoft: aces > 0 };
}

// Get the strategic pair rank (used as PAIR_TABLE key)
function pairRank(card) {
  const v = normalizeCard(card);
  if (v === 'A') return 'A';
  if (v === 10) return '10';
  return String(v);
}

// Check if two cards form a pair (same strategic value)
function isPair(card1, card2) {
  return pairRank(card1) === pairRank(card2);
}

// Build a context-aware explanation for the feedback overlay
function buildExplanation(rawAction, resolvedAction, playerCards, dealerUpcard) {
  const dealerVal = normalizeCard(dealerUpcard);
  const dealerStr = dealerUpcard === 'A' ? 'Ace' : String(dealerVal);
  const inBustZone = (dealerVal !== 'A' && dealerVal >= 2 && dealerVal <= 6);
  const { total, isSoft } = computeHandTotal(playerCards);

  if (resolvedAction === 'Sur' || rawAction === 'Rh' || rawAction === 'Rs' || rawAction === 'Sur') {
    return `Hard ${total} vs dealer ${dealerStr} wins less than 25% of the time — surrendering saves half your bet.`;
  }

  if (resolvedAction === 'P') {
    const rank = pairRank(playerCards[0]);
    if (rank === 'A') return 'Always split Aces — each Ace is a strong starting card.';
    if (rank === '8') return 'Always split 8s — Hard 16 is the worst hand; two 8s each have a much better chance.';
    if (rank === '5') return 'Never split 5s — you have a powerful Hard 10. Double it instead.';
    if (rank === '10') return 'Never split 10s — a 20 is one of the best hands you can have.';
    if (inBustZone) return `Dealer's ${dealerStr} is in the bust zone — split to put more money out and let the dealer destroy themselves.`;
    return `Split here to separate a weak pair and give each hand a better chance.`;
  }

  if (resolvedAction === 'D') {
    if (total === 11) return `Hard 11 is the best doubling hand — you have a great chance of hitting 21 or close to it.`;
    if (total === 10) return `Hard 10 vs dealer ${dealerStr} — excellent doubling opportunity to maximize profit.`;
    if (total === 9 && inBustZone) return `Hard 9 vs dealer ${dealerStr} — dealer is weak, double to get more money in play.`;
    if (isSoft && inBustZone) return `Your Ace gives you protection — double to maximize profit while the dealer is weak.`;
    return `Double here — you have a strong total against a vulnerable dealer.`;
  }

  if (resolvedAction === 'S') {
    if (inBustZone) return `Dealer's ${dealerStr} is in the bust zone (2–6) — stand and let them bust. Don't risk busting yourself.`;
    return `Stand — your total is strong enough; taking more cards risks busting.`;
  }

  if (resolvedAction === 'H') {
    if (!inBustZone) return `Dealer's ${dealerStr} is strong — you need a better total before standing.`;
    if (total <= 11) return `You can't bust with one more card — always hit totals of 11 or less.`;
    return `Hit to improve your total. The risk of busting is outweighed by the need to strengthen your hand.`;
  }

  return 'Follow the basic strategy chart for the best long-term outcome.';
}

// Resolve a raw table action to a normalised comparison token.
// Both D and Ds become 'D' when doubling is allowed (player just clicks "Double").
// All surrender variants (Rh, Rs, Sur) become 'Surrender' when surrender is allowed.
// Fallbacks are applied when the action isn't available.
function resolveConditionals(rawAction, { canDouble, canSurrender }) {
  // Surrender variants
  if (rawAction === 'Rh' || rawAction === 'Rs' || rawAction === 'Sur') {
    if (canSurrender) return 'Surrender';
    if (rawAction === 'Rh')  return 'H';
    if (rawAction === 'Rs')  return 'S';
    if (rawAction === 'Sur') return 'P';  // 8,8 vs A: split if can't surrender
  }
  // Double variants (D = double or hit; Ds = double or stand)
  if (rawAction === 'D' || rawAction === 'Ds') {
    if (canDouble) return 'D';
    return rawAction === 'Ds' ? 'S' : 'H';
  }
  return rawAction;
}

// Main strategy lookup
// playerCards: array of card values e.g. ['8','8'] or ['A','7'] or ['K','6']
// dealerUpcard: single card value e.g. '7' or 'A' or 'K'
// options: { canDouble, canSplit, canSurrender } — all true for initial 2-card decision
// Returns: { rawAction, resolvedAction, label, explanation }
function getOptimalAction(playerCards, dealerUpcard, options = {}) {
  const { canDouble = true, canSplit = true, canSurrender = true } = options;

  const normDealer = normalizeCard(dealerUpcard);
  const col = DEALER_IDX[normDealer];

  let rawAction;

  // 1. Pair check (must come before soft check — A,A is a pair, not soft 12)
  if (playerCards.length === 2 && canSplit && isPair(playerCards[0], playerCards[1])) {
    const rank = pairRank(playerCards[0]);
    rawAction = PAIR_TABLE[rank][col];
  } else {
    const { total, isSoft } = computeHandTotal(playerCards);

    // 2. Soft hand check
    if (isSoft && SOFT_TABLE[total]) {
      rawAction = SOFT_TABLE[total][col];
    } else {
      // 3. Hard total fallback
      const clampedTotal = Math.min(total, 21);
      const lookupTotal = Math.max(clampedTotal, 4);
      rawAction = (HARD_TABLE[lookupTotal] || HARD_TABLE[21])[col];
    }
  }

  const resolvedAction = resolveConditionals(rawAction, { canDouble, canSurrender });
  const label = ACTION_LABELS[resolvedAction] || resolvedAction;
  const explanation = buildExplanation(rawAction, resolvedAction, playerCards, dealerUpcard);

  return { rawAction, resolvedAction, label, explanation };
}

// Describe a hand as a human-readable string
function describeHand(card1, card2) {
  if (isPair(card1, card2)) {
    const r = pairRank(card1);
    const name = r === 'A' ? 'Aces' : r === '10' ? '10s' : r + 's';
    return `Pair of ${name}`;
  }
  const { total, isSoft } = computeHandTotal([card1, card2]);
  return `${isSoft ? 'Soft' : 'Hard'} ${total}`;
}

// Expose globals (no module system — plain browser script)
window.getOptimalAction = getOptimalAction;
window.describeHand = describeHand;
window.isPair = isPair;
window.pairRank = pairRank;
window.normalizeCard = normalizeCard;
window.computeHandTotal = computeHandTotal;
window.resolveConditionals = resolveConditionals;
