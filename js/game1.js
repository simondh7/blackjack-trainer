// game1.js — SRS-powered state machine for Perfect Blackjack drill

// ================================================================
// State
// ================================================================

const state = {
  phase: 'DASHBOARD',  // 'DASHBOARD' | 'SESSION_ACTION' | 'SESSION_CORRECT' | 'SESSION_WRONG' | 'COMPLETE'
  sessionQueue: [],    // ordered combo array for this session
  sessionIndex: 0,     // index of current card in sessionQueue
  combo: null,         // current combo object
  displayCard1: null,
  displayCard2: null,
  displayDealer: null,
  canSplit: false,
  canSurrender: true,
  canDouble: true,
  autoTimer: null,
  isNewCard: false,    // true if this combo had no prior SRS record
  session: {
    total: 0,
    correct: 0,
  },
};

// ================================================================
// Card Rendering Helpers
// ================================================================

const SUITS = ['♠', '♣', '♥', '♦'];
const RED_SUITS = new Set(['♥', '♦']);

function randomSuit() {
  return SUITS[Math.floor(Math.random() * SUITS.length)];
}

function displayFace(rank) {
  if (rank === 10 || rank === '10') return randomTenFace();
  return String(rank);
}

function makeCard(rankDisplay, suitSymbol) {
  const isRed = RED_SUITS.has(suitSymbol);
  const card = document.createElement('div');
  card.className = `card ${isRed ? 'red' : 'black'}`;

  const rankTop = document.createElement('span');
  rankTop.className = 'card-rank-top';
  rankTop.textContent = rankDisplay;

  const suit = document.createElement('span');
  suit.className = 'card-suit';
  suit.textContent = suitSymbol;

  const rankBot = document.createElement('span');
  rankBot.className = 'card-rank-bot';
  rankBot.textContent = rankDisplay;

  card.appendChild(rankTop);
  card.appendChild(suit);
  card.appendChild(rankBot);
  return card;
}

function makeFaceDownCard() {
  const card = document.createElement('div');
  card.className = 'card face-down';
  return card;
}

// ================================================================
// DOM Helpers
// ================================================================

function el(id) { return document.getElementById(id); }

function renderDealerCards(upcardRank, upcardSuit) {
  const container = el('dealer-cards');
  container.innerHTML = '';
  container.appendChild(makeCard(upcardRank, upcardSuit));
  container.appendChild(makeFaceDownCard());
}

function renderPlayerCards(card1Rank, card1Suit, card2Rank, card2Suit) {
  const container = el('player-cards');
  container.innerHTML = '';
  container.appendChild(makeCard(card1Rank, card1Suit));
  container.appendChild(makeCard(card2Rank, card2Suit));
}

// ================================================================
// Screen Switcher
// ================================================================

function showScreen(name) {
  ['screen-dashboard', 'screen-session', 'screen-complete'].forEach(id => {
    el(id).classList.toggle('hidden', id !== `screen-${name}`);
  });
}

// ================================================================
// Dashboard
// ================================================================

function renderDashboard() {
  const stats = SRS.getDashboardStats();
  el('dash-due').textContent = stats.dueCount;
  el('dash-new').textContent = stats.sessionNewCount;
  el('dash-mastered').textContent = stats.masteredCount;

  const pct = stats.totalCards === 0 ? 0 : (stats.masteredCount / stats.totalCards) * 100;
  el('dash-progress-bar').style.width = pct.toFixed(1) + '%';
  el('dash-progress-label').textContent =
    `${stats.masteredCount} / ${stats.totalCards} mastered`;

  const hasWork = (stats.dueCount + stats.sessionNewCount) > 0;
  const btn = el('dash-start-btn');
  btn.disabled = !hasWork;
  btn.textContent = hasWork ? 'Start Session' : 'Nothing due today!';
}

function handleStartSession() {
  const queue = SRS.buildSessionQueue();
  if (queue.length === 0) return;

  state.sessionQueue = queue;
  state.sessionIndex = 0;
  state.session.total = 0;
  state.session.correct = 0;

  showScreen('session');
  startHand();
}

// ================================================================
// Session Progress
// ================================================================

function updateSessionProgress() {
  const done = state.sessionIndex;
  const total = state.sessionQueue.length;
  el('session-progress-text').textContent = `${done} / ${total}`;
  const pct = total === 0 ? 0 : (done / total) * 100;
  el('session-progress-bar').style.width = pct.toFixed(1) + '%';
}

// ================================================================
// Button State
// ================================================================

function setButtonsEnabled(enabled) {
  ['btn-hit', 'btn-stand', 'btn-double', 'btn-split', 'btn-surrender'].forEach(id => {
    el(id).disabled = !enabled;
  });
}

function updateButtons() {
  el('btn-split').disabled = !state.canSplit;
  el('btn-surrender').disabled = !state.canSurrender;
  el('btn-double').disabled = !state.canDouble;
  el('btn-hit').disabled = false;
  el('btn-stand').disabled = false;
}

// ================================================================
// Main Game Flow
// ================================================================

function startHand() {
  if (state.autoTimer) {
    clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }

  // All cards reviewed — show completion screen
  if (state.sessionIndex >= state.sessionQueue.length) {
    showCompletion();
    return;
  }

  // Hide overlays
  el('correct-flash').classList.add('hidden');
  el('feedback-overlay').classList.add('hidden');
  el('action-blocker').classList.add('hidden');

  const combo = state.sessionQueue[state.sessionIndex];
  state.combo = combo;

  // Check if this is a new card (no SRS record yet)
  const key = SRS.comboToKey(combo);
  const stored = localStorage.getItem('bj_srs_v1');
  let cardData = null;
  if (stored) {
    try { cardData = JSON.parse(stored).cards[key]; } catch(e) {}
  }
  state.isNewCard = !cardData || cardData.nextReviewDate === null;

  // Pick display faces (randomize 10-value cards for visual variety)
  state.displayCard1 = displayFace(combo.card1);
  state.displayCard2 = displayFace(combo.card2);
  state.displayDealer = displayFace(combo.dealer);

  const suit1 = randomSuit();
  const suit2 = randomSuit();
  const suitD = randomSuit();

  state.canSplit     = combo.type === 'pair';
  state.canDouble    = true;
  state.canSurrender = true;

  state.phase = 'SESSION_ACTION';

  renderDealerCards(state.displayDealer, suitD);
  renderPlayerCards(state.displayCard1, suit1, state.displayCard2, suit2);

  el('hand-description').textContent = describeHand(combo.card1, combo.card2);

  updateButtons();
  updateSessionProgress();
}

function handleAction(playerAction) {
  if (state.phase !== 'SESSION_ACTION') return;

  const combo = state.combo;
  const playerCards = [combo.card1, combo.card2];
  const dealerUpcard = combo.dealer;
  const options = {
    canDouble: state.canDouble,
    canSplit: state.canSplit,
    canSurrender: state.canSurrender,
  };

  const optimal = getOptimalAction(playerCards, dealerUpcard, options);
  const resolvedPlayer = resolveConditionals(playerAction, options);
  const isCorrect = (resolvedPlayer === optimal.resolvedAction);
  const key = SRS.comboToKey(combo);

  state.session.total++;

  if (isCorrect) {
    state.session.correct++;
    state.phase = 'SESSION_CORRECT';

    // SM-2: rate GOOD
    SRS.reviewCard(key, 'GOOD');
    if (state.isNewCard) SRS.recordNewCardIntroduced(key);

    state.sessionIndex++;
    showCorrectFeedback();
  } else {
    state.phase = 'SESSION_WRONG';

    // SM-2: rate AGAIN
    SRS.reviewCard(key, 'AGAIN');

    const handDesc = describeHand(combo.card1, combo.card2);
    const dealerStr = combo.dealer === 'A' ? 'A' : String(combo.dealer);
    showWrongFeedback(optimal, handDesc, dealerStr);
  }
}

function showCorrectFeedback() {
  setButtonsEnabled(false);
  el('action-blocker').classList.remove('hidden');

  const flash = el('correct-flash');
  flash.classList.remove('hidden');
  void flash.offsetWidth;
  flash.style.animation = 'none';
  void flash.offsetWidth;
  flash.style.animation = '';

  state.autoTimer = setTimeout(() => {
    state.autoTimer = null;
    startHand();
  }, 800);
}

function showWrongFeedback(optimal, handDesc, dealerStr) {
  setButtonsEnabled(false);

  el('feedback-hand-summary').textContent = `${handDesc} vs Dealer ${dealerStr}`;
  el('feedback-action-name').textContent = optimal.label;
  el('feedback-explanation').textContent = optimal.explanation;

  el('feedback-overlay').classList.remove('hidden');
}

function handleContinue() {
  el('feedback-overlay').classList.add('hidden');
  state.sessionIndex++;
  startHand();
}

// ================================================================
// Completion Screen
// ================================================================

function showCompletion() {
  state.phase = 'COMPLETE';
  showScreen('complete');

  const { total, correct } = state.session;
  el('complete-reviewed').textContent = total;
  el('complete-correct').textContent = correct;
  el('complete-accuracy').textContent = total === 0
    ? '—'
    : Math.round((correct / total) * 100) + '%';
  el('complete-tomorrow').textContent = SRS.getNextReviewCountForTomorrow();
}

function handleStudyMore() {
  showScreen('dashboard');
  renderDashboard();
  // Small delay so dashboard updates are visible before potentially going straight to session
  setTimeout(() => {
    const stats = SRS.getDashboardStats();
    if (stats.dueCount + stats.sessionNewCount > 0) {
      handleStartSession();
    }
  }, 300);
}

// ================================================================
// Keyboard Shortcuts
// ================================================================

document.addEventListener('keydown', (e) => {
  const phase = state.phase;

  if (phase === 'SESSION_ACTION') {
    switch (e.key.toLowerCase()) {
      case 'h': handleAction('H'); break;
      case 's': handleAction('S'); break;
      case 'd': handleAction('D'); break;
      case 'p': handleAction('P'); break;
      case 'r': handleAction('Surrender'); break;
      case 'enter':
      case ' ':
        e.preventDefault();
        handleAction('H');
        break;
    }
    return;
  }

  if (phase === 'SESSION_WRONG') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContinue();
    }
    return;
  }

  if (phase === 'DASHBOARD') {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStartSession();
    }
    return;
  }

  if (phase === 'COMPLETE') {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStudyMore();
    }
    return;
  }
});

// ================================================================
// Boot
// ================================================================

renderDashboard();
showScreen('dashboard');
