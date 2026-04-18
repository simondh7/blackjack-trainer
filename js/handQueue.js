// handQueue.js — Generates all ~330 strategic starting hand combinations,
// manages a shuffled queue, and reinforces hands the player gets wrong.

// Canonical two-card representations for hard totals (non-pair, non-soft)
// Hard 4 = only 2+2 (pair) — excluded. Hard 20 = only T+T (pair) — excluded.
const HARD_COMBOS = {
  5:  [2, 3],
  6:  [2, 4],
  7:  [2, 5],
  8:  [2, 6],
  9:  [2, 7],
  10: [2, 8],
  11: [2, 9],
  12: [2, 10],
  13: [3, 10],
  14: [4, 10],
  15: [5, 10],
  16: [6, 10],
  17: [7, 10],
  18: [8, 10],
  19: [9, 10],
};

const DEALER_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'A'];

// Ten-value face cards for visual variety when displaying a "10-value" card
const TEN_VALUE_FACES = ['10', 'J', 'Q', 'K'];

// Pick a random ten-value face for display purposes
function randomTenFace() {
  return TEN_VALUE_FACES[Math.floor(Math.random() * TEN_VALUE_FACES.length)];
}

// Pair ranks: the canonical rank used as key into PAIR_TABLE
const PAIR_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Generate all ~330 strategic combinations
function generateAllCombos() {
  const combos = [];

  // --- PAIRS (100 combos) ---
  for (const rank of PAIR_RANKS) {
    for (const dealer of DEALER_UPCARDS) {
      combos.push({
        type: 'pair',
        card1: rank === '10' ? '10' : rank,  // display card (10-faces randomized at render time)
        card2: rank === '10' ? '10' : rank,
        dealer,
        pairRank: rank,
      });
    }
  }

  // --- SOFT HANDS (80 combos): A,2 through A,9 ---
  for (let kicker = 2; kicker <= 9; kicker++) {
    for (const dealer of DEALER_UPCARDS) {
      combos.push({
        type: 'soft',
        card1: 'A',
        card2: kicker,
        dealer,
      });
    }
  }

  // --- HARD HANDS (150 combos): Hard 5 through Hard 19 ---
  for (const [total, [c1, c2]] of Object.entries(HARD_COMBOS)) {
    for (const dealer of DEALER_UPCARDS) {
      combos.push({
        type: 'hard',
        card1: c1,
        card2: c2,
        dealer,
        hardTotal: parseInt(total, 10),
      });
    }
  }

  return combos;
}

// Fisher-Yates shuffle (in-place, returns array)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a stable string key for a combo (for deduplication in mistake buffer)
function comboKey(combo) {
  return `${combo.type}|${combo.card1}|${combo.card2}|${combo.dealer}`;
}

class HandQueue {
  constructor() {
    this.masterList = generateAllCombos();   // ~330 fixed items
    this.queue = [];                          // current working queue
    this.mistakeBuffer = [];                  // [{ combo, key, errorCount }]
    this.handsSinceInject = 0;
    this.REINFORCE_EVERY = 4;
  }

  // Return the next combo to drill
  nextHand() {
    // Refill queue when empty (reshuffle master list)
    if (this.queue.length === 0) {
      this.queue = shuffle([...this.masterList]);
    }

    this.handsSinceInject++;

    // Inject a mistake hand every REINFORCE_EVERY hands
    if (this.handsSinceInject >= this.REINFORCE_EVERY && this.mistakeBuffer.length > 0) {
      const pick = this.mistakeBuffer[Math.floor(Math.random() * this.mistakeBuffer.length)];
      // Insert 1–3 positions ahead (not immediately next, to avoid obvious pattern)
      const insertPos = Math.min(
        1 + Math.floor(Math.random() * 3),
        this.queue.length
      );
      this.queue.splice(insertPos, 0, { ...pick.combo, isReinforcement: true });
      this.handsSinceInject = 0;
    }

    return this.queue.shift();
  }

  // Record a mistake for the given combo
  recordMistake(combo) {
    const key = comboKey(combo);
    const existing = this.mistakeBuffer.find(m => m.key === key);
    if (existing) {
      existing.errorCount++;
    } else {
      this.mistakeBuffer.push({ combo: { ...combo }, key, errorCount: 1 });
    }

    // Cap buffer at 20 entries; evict the least-repeated mistake
    if (this.mistakeBuffer.length > 20) {
      this.mistakeBuffer.sort((a, b) => a.errorCount - b.errorCount);
      this.mistakeBuffer.shift();
    }
  }

  // Get mistake buffer sorted by frequency (most errors first) for display
  getMistakes() {
    return [...this.mistakeBuffer].sort((a, b) => b.errorCount - a.errorCount);
  }
}

// Expose globals
window.HandQueue = HandQueue;
window.randomTenFace = randomTenFace;
window.generateAllCombos = generateAllCombos;
window.shuffle = shuffle;
