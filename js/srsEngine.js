// srsEngine.js — SM-2 Spaced Repetition engine for Perfect Blackjack
// Persists card progress to localStorage under key 'bj_srs_v1'

// ================================================================
// Constants
// ================================================================

const SRS_STORAGE_KEY = 'bj_srs_v1';
const MAX_NEW_PER_DAY = 20;
const MASTERED_MIN_REPS = 3;
const MASTERED_MIN_INTERVAL = 21; // days

// ================================================================
// Date Helpers
// ================================================================

function todayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ================================================================
// LocalStorage Store
// ================================================================

function loadStore() {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { cards: {}, dailyNewCount: 0, dailyNewDate: todayStr() };
}

function saveStore(store) {
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(store));
}

function ensureCard(store, key) {
  if (!store.cards[key]) {
    store.cards[key] = {
      key,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: null,
    };
  }
  return store.cards[key];
}

// ================================================================
// Combo Key
// ================================================================

function comboToKey(combo) {
  if (combo.type === 'pair') return `pair_${combo.pairRank}_${combo.dealer}`;
  if (combo.type === 'soft') return `soft_${combo.card2}_${combo.dealer}`;
  return `hard_${combo.hardTotal}_${combo.dealer}`;
}

// ================================================================
// SM-2 Review Update
// ================================================================

// rating: 'AGAIN' | 'GOOD'
function reviewCard(key, rating) {
  const store = loadStore();
  const card = ensureCard(store, key);

  if (rating === 'AGAIN') {
    card.repetitions = 0;
    card.interval = 1;
    card.easeFactor -= 0.20;
  } else {
    // GOOD
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    card.repetitions += 1;
  }

  card.easeFactor = Math.max(card.easeFactor, 1.3);
  card.nextReviewDate = addDays(todayStr(), card.interval);
  saveStore(store);
}

// ================================================================
// Daily New Card Tracking
// ================================================================

function recordNewCardIntroduced(key) {
  const store = loadStore();
  // Reset counter if it's a new day
  const today = todayStr();
  if (store.dailyNewDate !== today) {
    store.dailyNewCount = 0;
    store.dailyNewDate = today;
  }
  store.dailyNewCount += 1;
  saveStore(store);
}

// ================================================================
// Session Queue Builder
// ================================================================

function buildSessionQueue() {
  const store = loadStore();
  const today = todayStr();

  // Reset daily new counter if it's a new day
  if (store.dailyNewDate !== today) {
    store.dailyNewCount = 0;
    store.dailyNewDate = today;
    saveStore(store);
  }

  const allCombos = window.generateAllCombos();
  const overdue = [];
  const dueToday = [];
  const newCards = [];

  for (const combo of allCombos) {
    const key = comboToKey(combo);
    const card = store.cards[key];

    if (!card || card.nextReviewDate === null) {
      newCards.push(combo);
    } else if (card.nextReviewDate < today) {
      overdue.push({ combo, date: card.nextReviewDate });
    } else if (card.nextReviewDate === today) {
      dueToday.push(combo);
    }
  }

  // Sort overdue: oldest first
  overdue.sort((a, b) => (a.date < b.date ? -1 : 1));

  // Limit new cards to daily allowance
  const newAllowed = Math.max(0, MAX_NEW_PER_DAY - store.dailyNewCount);
  const selectedNew = window.shuffle(newCards).slice(0, newAllowed);

  return [
    ...overdue.map(x => x.combo),
    ...dueToday,
    ...selectedNew,
  ];
}

// ================================================================
// Dashboard Stats
// ================================================================

function getDashboardStats() {
  const store = loadStore();
  const today = todayStr();
  const allCombos = window.generateAllCombos();

  // Reset daily new counter if it's a new day
  if (store.dailyNewDate !== today) {
    store.dailyNewCount = 0;
    store.dailyNewDate = today;
    saveStore(store);
  }

  let dueCount = 0;
  let totalNewUnseen = 0;
  let masteredCount = 0;

  for (const combo of allCombos) {
    const key = comboToKey(combo);
    const card = store.cards[key];

    if (!card || card.nextReviewDate === null) {
      totalNewUnseen++;
    } else if (card.nextReviewDate <= today) {
      dueCount++;
    } else if (card.repetitions >= MASTERED_MIN_REPS && card.interval >= MASTERED_MIN_INTERVAL) {
      masteredCount++;
    }
  }

  const newAllowed = Math.max(0, MAX_NEW_PER_DAY - store.dailyNewCount);
  const sessionNewCount = Math.min(totalNewUnseen, newAllowed);

  return {
    dueCount,
    sessionNewCount,
    masteredCount,
    totalCards: allCombos.length,
  };
}

// ================================================================
// Tomorrow Count (for Completion Screen)
// ================================================================

function getNextReviewCountForTomorrow() {
  const store = loadStore();
  const tomorrow = addDays(todayStr(), 1);
  const allCombos = window.generateAllCombos();
  let count = 0;

  for (const combo of allCombos) {
    const key = comboToKey(combo);
    const card = store.cards[key];
    if (card && card.nextReviewDate === tomorrow) {
      count++;
    }
  }

  return count;
}

// ================================================================
// Public API
// ================================================================

window.SRS = {
  buildSessionQueue,
  getDashboardStats,
  reviewCard,
  comboToKey,
  recordNewCardIntroduced,
  getNextReviewCountForTomorrow,
};
