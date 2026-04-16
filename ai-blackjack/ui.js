'use strict';

// ── DOM References ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const el = {
  // Header
  keyIndicator:  $('key-indicator'),
  keyDot:        $('key-dot'),
  keyText:       $('key-text'),
  envFile:       $('env-file'),
  keyInput:      $('key-input'),
  keyEyeBtn:     $('key-eye-btn'),
  aboutBtn:      $('about-btn'),
  aboutModal:    $('about-modal'),
  aboutClose:    $('about-close'),
  // Control bar
  familySelect:  $('family-select'),
  modelSelect:   $('model-select'),
  refreshModels: $('refresh-models'),
  betMinus:      $('bet-minus'),
  betPlus:       $('bet-plus'),
  betDisplay:    $('bet-display'),
  balanceVal:    $('balance-val'),
  playBtn:       $('play-btn'),
  // Game table
  dealerCards:   $('dealer-cards'),
  dealerScore:   $('dealer-score'),
  playerArea:    $('player-area'),
  statusBar:     $('status-bar'),
  insuranceBar:  $('insurance-bar'),
  insYesBtn:     $('ins-yes-btn'),
  insNoBtn:      $('ins-no-btn'),
  resultBanner:  $('result-banner'),
  // Action buttons
  hitBtn:        $('hit-btn'),
  standBtn:      $('stand-btn'),
  doubleBtn:     $('double-btn'),
  splitBtn:      $('split-btn'),
  insuranceBtn:  $('insurance-btn'),
  // AI panel
  aiActionWord:  $('ai-action-word'),
  confidenceFill:$('confidence-fill'),
  confidencePct: $('confidence-pct'),
  aiAnalysis:    $('ai-analysis'),
  aiBriefReason: $('ai-brief-reason'),
  executeBtn:    $('execute-btn'),
  // Strategy matrix
  strategyMatrix:$('strategy-matrix'),
  strategyBadge: $('strategy-badge'),
  // Analytics
  statHands:     $('stat-hands'),
  statWinrate:   $('stat-winrate'),
  statWins:      $('stat-wins'),
  statLosses:    $('stat-losses'),
  statPushes:    $('stat-pushes'),
  statAiAgree:   $('stat-ai-agree'),
  bankrollSvg:   $('bankroll-svg'),
  actionSvg:     $('action-svg'),
  wlpBar:        $('wlp-bar'),
  // Collapsible toggles
  matrixToggle:  $('matrix-toggle'),
  matrixBody:    $('matrix-body'),
  matrixChevron: $('matrix-chevron'),
  analyticsToggle: $('analytics-toggle'),
  analyticsBody:   $('analytics-body'),
  analyticsChevron:$('analytics-chevron'),
};

// ── Session Analytics State ────────────────────────────────────────────────────
const stats = {
  hands:        0,
  wins:         0,
  losses:       0,
  pushes:       0,
  blackjacks:   0,
  bankroll:     [STARTING_BALANCE],
  actions:      { hit:0, stand:0, double:0, split:0, insurance:0 },
  aiAgreements: 0,
  aiTotal:      0,
};

// Pending AI recommendation for the current hand
let pendingRec      = null;
let aiWorking       = false;
let currentModel    = 'claude-sonnet-4-6';
let currentProvider = 'anthropic';

// Available models, keyed by provider
const MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Recommended)' },
    { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o',                    label: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo',               label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo',             label: 'GPT-3.5 Turbo' },
  ],
};

// ── Initialise ─────────────────────────────────────────────────────────────────

function init() {
  populateModels();
  buildStrategyMatrix();
  wireEvents();
  setActionButtons([]);
  el.playBtn.disabled = true;
  setStatus('Upload your .env file to begin');
}

function populateModels() {
  const list = MODELS[currentProvider] || MODELS.anthropic;
  el.modelSelect.innerHTML = list.map(m =>
    `<option value="${m.id}">${m.label}</option>`
  ).join('');
  currentModel = list[0].id;
}

// ── Event Wiring ───────────────────────────────────────────────────────────────

function wireEvents() {
  // Direct key paste input
  el.keyInput.addEventListener('input', () => {
    const val = el.keyInput.value.trim();
    const looksValid = (val.startsWith('sk-ant-') || val.startsWith('sk-')) && val.length > 20;
    el.keyInput.classList.toggle('valid', looksValid);
  });

  el.keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyKeyInput();
  });

  el.keyInput.addEventListener('blur', () => {
    if (el.keyInput.value.trim().length > 20) applyKeyInput();
  });

  // Show/hide key toggle
  el.keyEyeBtn.addEventListener('click', () => {
    const isHidden = el.keyInput.type === 'password';
    el.keyInput.type = isHidden ? 'text' : 'password';
    el.keyEyeBtn.textContent = isHidden ? '🙈' : '👁';
  });

  // .env upload
  el.envFile.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const masked = await loadKeyFromFile(file);
      markKeyLoaded(masked);
    } catch (err) {
      setStatus('Error: ' + err.message, 'lose');
    }
    e.target.value = '';
  });

  // Family (provider) selection
  el.familySelect.addEventListener('change', e => {
    currentProvider = e.target.value;
    populateModels();
    el.playBtn.disabled = !canDeal();
  });

  // Model selection
  el.modelSelect.addEventListener('change', e => {
    currentModel = e.target.value;
  });

  el.refreshModels.addEventListener('click', populateModels);

  // Bet controls
  el.betMinus.addEventListener('click', () => {
    game.bet = Math.max(BET_MIN, game.bet - BET_STEP);
    el.betDisplay.textContent = '$' + game.bet;
    el.playBtn.disabled = !canDeal();
  });
  el.betPlus.addEventListener('click', () => {
    game.bet = Math.min(BET_MAX, Math.min(game.balance, game.bet + BET_STEP));
    el.betDisplay.textContent = '$' + game.bet;
    el.playBtn.disabled = !canDeal();
  });

  // PLAY
  el.playBtn.addEventListener('click', startRound);

  // Action buttons
  el.hitBtn.addEventListener('click',       () => handleAction('hit'));
  el.standBtn.addEventListener('click',     () => handleAction('stand'));
  el.doubleBtn.addEventListener('click',    () => handleAction('double'));
  el.splitBtn.addEventListener('click',     () => handleAction('split'));
  el.insuranceBtn.addEventListener('click', () => handleAction('insurance'));

  // Insurance bar
  el.insYesBtn.addEventListener('click',    () => resolveInsuranceChoice(true));
  el.insNoBtn.addEventListener('click',     () => resolveInsuranceChoice(false));

  // Execute Recommendation
  el.executeBtn.addEventListener('click', executeRecommendation);

  // About modal
  el.aboutBtn.addEventListener('click',   () => el.aboutModal.classList.remove('hidden'));
  el.aboutClose.addEventListener('click', () => el.aboutModal.classList.add('hidden'));
  el.aboutModal.addEventListener('click', e => {
    if (e.target === el.aboutModal) el.aboutModal.classList.add('hidden');
  });

  // Collapsible sections
  el.matrixToggle.addEventListener('click', () => {
    const open = el.matrixBody.classList.toggle('open');
    el.matrixChevron.classList.toggle('open', open);
  });
  el.analyticsToggle.addEventListener('click', () => {
    const open = el.analyticsBody.classList.toggle('open');
    el.analyticsChevron.classList.toggle('open', open);
  });
}

// ── Game Flow ──────────────────────────────────────────────────────────────────

async function startRound() {
  if (!canDeal()) return;

  pendingRec = null;
  el.resultBanner.classList.add('hidden');
  el.insuranceBar.classList.add('hidden');
  el.playBtn.disabled = true;
  resetAIPanel();

  startHand();          // game.js — deducts bet, deals cards

  updateBalanceDisplay();
  renderTable(true);    // animate = true
  setStatus('Dealing…');

  // Small pause so dealing animation plays before we continue
  await delay(600);

  // Check for player blackjack
  const playerHand  = game.playerHands[0];
  const dealerUpRank = game.dealerCards[0].rank;

  if (isBlackjack(playerHand)) {
    el.dealerScore.textContent = '';  // hide dealer score while hole card is hidden
    if (dealerUpRank === 'A') {
      // Must resolve insurance first before peeking
      await showInsuranceOffer();
    }
    // Peek at hole card
    await revealHoleCard();
    const results = runDealer();
    renderDealerCards();
    showResults(results);
    return;
  }

  // Dealer shows Ace — offer insurance before player acts
  if (dealerUpRank === 'A') {
    await showInsuranceOffer();
    // After insurance decision, check if dealer has BJ (peek)
    if (isBlackjack(game.dealerCards)) {
      await revealHoleCard();
      const results = runDealer();
      renderDealerCards();
      showResults(results);
      return;
    }
  }

  await playerTurn();
}

// Offer insurance and wait for user's choice.
// Returns a Promise that resolves when the user clicks Yes or No.
function showInsuranceOffer() {
  return new Promise(resolve => {
    el.insuranceBar.classList.remove('hidden');
    el._insResolve = resolve;
    setStatus('Dealer shows Ace — Take insurance?', 'thinking');
    setActionButtons([]);  // disable regular actions during insurance prompt
  });
}

function resolveInsuranceChoice(takesInsurance) {
  el.insuranceBar.classList.add('hidden');
  if (takesInsurance) {
    doInsurance();
    updateBalanceDisplay();
    setStatus(`Insurance placed: $${game.insuranceBet}`);
  } else {
    setStatus('Insurance declined.');
  }
  if (el._insResolve) { el._insResolve(); el._insResolve = null; }
}

async function playerTurn() {
  const actions = getAvailableActions();
  if (actions.length === 0 || game.phase !== 'playing') {
    await dealerPhase();
    return;
  }

  setActionButtons(actions);
  setStatus('AI is thinking…', 'thinking');
  aiWorking = true;
  el.executeBtn.disabled = true;

  try {
    const gs  = buildGameState();
    const rec = await askAgent(gs, currentModel, currentProvider);
    pendingRec = rec;
    updateAIPanel(rec, gs);
    setStatus(`Your turn — AI recommends ${rec.action.toUpperCase()}`);
    el.executeBtn.disabled = false;
  } catch (err) {
    showAIError(err.message);
    setStatus('AI unavailable — play manually');
  }

  aiWorking = false;
}

async function handleAction(type) {
  if (game.phase !== 'playing') return;
  const actions = getAvailableActions();
  if (!actions.includes(type)) return;

  // Record action for analytics
  if (type !== 'insurance') stats.actions[type]++;

  setActionButtons([]);    // disable buttons while processing
  el.executeBtn.disabled = true;

  switch (type) {
    case 'hit':       doHit();       break;
    case 'stand':     doStand();     break;
    case 'double':    doDouble();    break;
    case 'split':     doSplit();     break;
    case 'insurance':
      // Insurance is handled via the insurance bar flow, not buttons normally
      // (but keep as fallback)
      doInsurance();
      updateBalanceDisplay();
      break;
  }

  renderTable();
  updateBalanceDisplay();

  if (game.phase === 'dealer') {
    await dealerPhase();
  } else if (game.phase === 'playing') {
    await playerTurn();
  }
}

function executeRecommendation() {
  if (!pendingRec || game.phase !== 'playing') return;
  const action = pendingRec.action;
  const actions = getAvailableActions();
  if (!actions.includes(action)) return;

  // Brief visual pulse on the corresponding button
  const btnMap = {
    hit: el.hitBtn, stand: el.standBtn, double: el.doubleBtn,
    split: el.splitBtn, insurance: el.insuranceBtn,
  };
  const btn = btnMap[action];
  if (btn) {
    btn.classList.add('btn-pulsing');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-pulsing'), { once: true });
  }

  setTimeout(() => handleAction(action), 350);
}

async function dealerPhase() {
  setActionButtons([]);
  setStatus('Dealer reveals hole card…');
  await revealHoleCard();
  await delay(400);

  // Draw dealer cards one by one with animation
  const beforeLen = game.dealerCards.length;
  const results   = runDealer();   // synchronous — draws all cards, resolves
  const afterLen  = game.dealerCards.length;

  // Animate each newly drawn dealer card
  for (let i = beforeLen; i < afterLen; i++) {
    renderDealerCards(i);
    setStatus(`Dealer draws: ${game.dealerCards[i].rank}${game.dealerCards[i].suit}`);
    await delay(550);
  }

  renderDealerCards();
  showResults(results);
}

async function revealHoleCard() {
  // Flip the hole card with animation
  game.dealerCards[1].faceDown = false;
  const holeEl = el.dealerCards.children[1];
  if (holeEl) {
    holeEl.classList.remove('face-down');
    await delay(600);  // wait for CSS flip
  }
  updateDealerScore();
}

function showResults(results) {
  // Aggregate outcome for display
  const allBust  = results.every(r => r.outcome === 'bust');
  const anyBJ    = results.some(r => r.outcome === 'blackjack');
  const anyWin   = results.some(r => r.outcome === 'win' || r.outcome === 'blackjack');
  const anyLose  = results.some(r => r.outcome === 'lose' || r.outcome === 'bust');
  const anyPush  = results.some(r => r.outcome === 'push');
  const totalNet = results.reduce((s, r) => s + r.net, 0)
                 + (results.insuranceDelta || 0);

  let msg, cls;
  if (anyBJ) {
    msg = `BLACKJACK! +$${Math.abs(totalNet)} 🎰`;
    cls = 'result-blackjack';
  } else if (results.length > 1) {
    // Split results
    const parts = results.map(r => r.outcome.toUpperCase()).join(' / ');
    msg = `${parts}  Net: ${totalNet >= 0 ? '+' : ''}$${totalNet}`;
    cls = totalNet > 0 ? 'result-win' : totalNet < 0 ? 'result-lose' : 'result-push';
  } else {
    const r = results[0];
    if (r.outcome === 'win')   { msg = `YOU WIN  +$${r.net}`;  cls = 'result-win';  }
    else if (r.outcome === 'lose' || r.outcome === 'bust') {
      msg = r.outcome === 'bust' ? `BUST  -$${Math.abs(r.net)}` : `DEALER WINS  -$${Math.abs(r.net)}`;
      cls = 'result-lose';
    } else {
      msg = `PUSH — Bet returned`;
      cls = 'result-push';
    }
  }

  el.resultBanner.textContent = msg;
  el.resultBanner.className   = `result-banner ${cls}`;
  el.resultBanner.classList.remove('hidden');

  updateBalanceDisplay(totalNet);
  updateAnalytics(results, totalNet);

  setStatus('');
  el.playBtn.disabled = !canDeal();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// Full table re-render. animate=true adds deal-in CSS class to new cards.
function renderTable(animate = false) {
  renderDealerCards();
  renderPlayerArea(animate);
  updateDealerScore();
  updatePlayerScores();
}

function renderDealerCards(highlightIdx = -1) {
  // Only re-render cards we haven't drawn yet, to avoid disturbing flip state
  const existing = el.dealerCards.children.length;
  for (let i = existing; i < game.dealerCards.length; i++) {
    const cardEl = makeCardEl(game.dealerCards[i], i === highlightIdx);
    el.dealerCards.appendChild(cardEl);
  }
  updateDealerScore();
}

function renderPlayerArea(animate = false) {
  el.playerArea.innerHTML = '';

  if (game.playerHands.length === 1) {
    // Single hand
    const container = document.createElement('div');
    container.className = 'area-section';

    const label  = makeLabel('You', game.playerHands[0], false);
    const row    = makeCardRow(game.playerHands[0], animate);
    const chips  = makeChipStack(game.handBets[0]);
    container.append(label, row, chips);
    el.playerArea.appendChild(container);
  } else {
    // Split hands
    const wrap = document.createElement('div');
    wrap.className = 'split-hands';

    game.playerHands.forEach((hand, i) => {
      const sec   = document.createElement('div');
      sec.className = 'hand-section' + (i === game.activeHand ? ' active-hand' : '');

      const label = makeLabel(`Hand ${i + 1}`, hand, false);
      const row   = makeCardRow(hand, animate && i >= 1);
      const chips = makeChipStack(game.handBets[i]);
      sec.append(label, row, chips);
      wrap.appendChild(sec);
    });
    el.playerArea.appendChild(wrap);
  }

  updatePlayerScores();
}

function makeLabel(title, cards, hidden) {
  const div = document.createElement('div');
  div.className = 'area-label';

  const span = document.createElement('span');
  span.textContent = title;

  const score = document.createElement('span');
  score.className = 'hand-score';
  if (!hidden && cards.length) {
    const v = handValue(cards);
    const s = isSoft(cards) ? 'Soft ' : '';
    score.textContent = s + v;
    if (v > 21) score.classList.add('bust');
    if (v === 21 && cards.length === 2) score.classList.add('bj');
  }

  div.append(span, score);
  return div;
}

function makeCardRow(cards, animate = false) {
  const row = document.createElement('div');
  row.className = 'card-row';
  cards.forEach((card, i) => {
    const w = document.createElement('div');
    w.className = 'card-wrapper';
    const c = makeCardEl(card, animate && i >= 0);
    w.appendChild(c);
    row.appendChild(w);
  });
  return row;
}

function makeCardEl(card, animate = false) {
  const div = document.createElement('div');
  const isRed = ['♥','♦'].includes(card.suit);
  div.className = 'card' + (isRed ? ' red' : '') + (card.faceDown ? ' face-down' : '');
  if (animate) div.classList.add('dealing');

  // Front face
  const front = document.createElement('div');
  front.className = 'card-front';

  const rankTL = document.createElement('span');
  rankTL.className = 'card-rank';
  rankTL.textContent = card.rank;

  const suitC = document.createElement('span');
  suitC.className = 'card-suit-center';
  suitC.textContent = card.suit;

  const rankBR = document.createElement('span');
  rankBR.className = 'card-rank bottom-right';
  rankBR.textContent = card.rank;

  front.append(rankTL, suitC, rankBR);

  // Back face
  const back = document.createElement('div');
  back.className = 'card-back';

  div.append(front, back);
  return div;
}

function makeChipStack(bet) {
  const wrap = document.createElement('div');
  wrap.className = 'chip-stack';
  wrap.style.marginTop = '10px';

  // Represent the bet as chips
  const denominations = [100, 50, 25, 10, 5];
  const colors        = ['chip-black','chip-green','chip-red','chip-blue','chip-green'];
  let remaining       = bet;

  denominations.forEach((d, i) => {
    let count = Math.floor(remaining / d);
    remaining %= d;
    while (count-- > 0) {
      const chip = document.createElement('div');
      chip.className = `chip ${colors[i]}`;
      chip.textContent = `$${d}`;
      wrap.appendChild(chip);
    }
  });

  return wrap;
}

function updateDealerScore() {
  const visible = game.dealerCards.filter(c => !c.faceDown);
  if (!visible.length) { el.dealerScore.textContent = ''; return; }
  const v  = handValue(visible);
  const s  = isSoft(visible) && visible.length === game.dealerCards.filter(c => !c.faceDown).length ? 'Soft ' : '';
  el.dealerScore.textContent = s + v;
  el.dealerScore.className = 'hand-score' + (v > 21 ? ' bust' : '');
}

function updatePlayerScores() {
  // Scores are embedded in the label inside renderPlayerArea
  // No separate update needed since we call renderPlayerArea on changes
}

function updateBalanceDisplay(delta = 0) {
  el.balanceVal.textContent = '$' + game.balance.toLocaleString();
  if (delta > 0) {
    el.balanceVal.classList.remove('balance-lose');
    void el.balanceVal.offsetWidth; // reflow to restart animation
    el.balanceVal.classList.add('balance-win');
  } else if (delta < 0) {
    el.balanceVal.classList.remove('balance-win');
    void el.balanceVal.offsetWidth;
    el.balanceVal.classList.add('balance-lose');
  }
  // Sync bet display cap
  el.betDisplay.textContent = '$' + game.bet;
}

function setStatus(msg, type = '') {
  el.statusBar.textContent  = msg;
  el.statusBar.className    = 'status-bar' + (type ? ` ${type}` : '');
}

// ── Action Button Control ─────────────────────────────────────────────────────

function setActionButtons(actions) {
  el.hitBtn.disabled       = !actions.includes('hit');
  el.standBtn.disabled     = !actions.includes('stand');
  el.doubleBtn.disabled    = !actions.includes('double');
  el.splitBtn.disabled     = !actions.includes('split');
  el.insuranceBtn.disabled = !actions.includes('insurance');
}

// ── AI Panel ──────────────────────────────────────────────────────────────────

function resetAIPanel() {
  el.aiActionWord.textContent = '—';
  el.aiActionWord.className   = 'ai-action-word';
  el.confidenceFill.style.width = '0%';
  el.confidencePct.textContent  = '—';
  el.aiAnalysis.textContent     = 'Waiting for deal…';
  el.aiBriefReason.textContent  = '';
  el.executeBtn.disabled        = true;
  el.strategyBadge.className    = 'strategy-badge';
  el.strategyBadge.textContent  = '';
}

function updateAIPanel(rec, gs) {
  // Action word + color class
  const action = rec.action || '—';
  el.aiActionWord.textContent = action.toUpperCase();
  el.aiActionWord.className   = `ai-action-word action-${action}`;

  // Confidence meter
  const conf  = Math.max(0, Math.min(1, rec.confidence || 0));
  const level = conf >= 0.75 ? 'high' : conf >= 0.5 ? 'mid' : 'low';
  el.confidenceFill.style.width = `${Math.round(conf * 100)}%`;
  el.confidenceFill.setAttribute('data-level', level);
  el.confidencePct.textContent  = `${Math.round(conf * 100)}%`;

  // Analysis text
  el.aiAnalysis.textContent    = rec.full_analysis || rec.brief_reason || '—';
  el.aiBriefReason.textContent = rec.brief_reason || '';

  // Highlight strategy matrix cell
  if (gs) {
    highlightMatrixCell(gs.playerCards, gs.dealerUpCard);

    // AI vs Basic Strategy badge
    const bsAction = rec.basic_strategy_action || basicStrategy(
      gs.playerCards, gs.dealerUpCard.rank, true, true
    );
    const bsLabel  = strategyLabel(bsAction);
    if (rec.action === rec.basic_strategy_action) {
      el.strategyBadge.className   = 'strategy-badge match';
      el.strategyBadge.textContent = `AI matches basic strategy ✓  (${bsLabel})`;
    } else {
      el.strategyBadge.className   = 'strategy-badge deviate';
      el.strategyBadge.textContent = `AI deviates from basic strategy — basic says ${bsLabel}. Reason: ${rec.brief_reason}`;
    }

    // Track AI vs basic strategy agreement
    const pureBS = basicStrategy(gs.playerCards, gs.dealerUpCard.rank,
                                 gs.availableActions.includes('double'),
                                 gs.availableActions.includes('split'));
    stats.aiTotal++;
    if (rec.action === pureBS.toLowerCase() || rec.action === { H:'hit',S:'stand',D:'double',P:'split' }[pureBS]) {
      stats.aiAgreements++;
    }
    updateAnalyticsDisplay();
  }
}

function showAIError(msg) {
  el.aiAnalysis.innerHTML = `<span class="ai-error">AI error: ${msg}</span>`;
  el.aiActionWord.textContent = '—';
  el.aiActionWord.className   = 'ai-action-word';
}

// Build the game state object passed to agent.js
function buildGameState() {
  const hand = getActiveHand();
  return {
    playerCards:      hand,
    playerTotal:      handValue(hand),
    isSoft:           isSoft(hand),
    dealerUpCard:     game.dealerCards[0],
    availableActions: getAvailableActions(),
    bet:              game.handBets[game.activeHand],
    balance:          game.balance,
    isAfterSplit:     game.playerHands.length > 1,
  };
}

// ── Strategy Matrix (Stretch 1) ───────────────────────────────────────────────

const DEALER_COLS = ['2','3','4','5','6','7','8','9','10','A'];

// Pre-build the full basic strategy table.
function buildStrategyMatrix() {
  const table = document.createElement('table');
  table.className = 'strategy-matrix';

  // Header row
  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  hrow.innerHTML = '<th>Hand</th>' +
    DEALER_COLS.map(d => `<th>${d}</th>`).join('');
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // ── Hard totals ────────────────────────────────────────────────────────────
  const hardSepRow = document.createElement('tr');
  hardSepRow.className = 'section-sep';
  hardSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Hard Totals</td>`;
  tbody.appendChild(hardSepRow);

  for (let total = 8; total <= 21; total++) {
    const tr = document.createElement('tr');
    tr.dataset.rowKey = `H${total}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `Hard ${total}`;
    tr.appendChild(labelTd);

    // Synthetic hard hand: two non-ace cards summing to total
    const c1r = total >= 12 ? String(Math.min(total - 2, 10)) : '4';
    const c2r = total >= 12 ? '2' : String(total - 4);
    const synthCards = [{ rank: c1r, suit: '♠' }, { rank: c2r === '10' ? '10' : c2r, suit: '♥' }];
    // Override value by using a 3-card hard hand to avoid accidental pairs/soft
    const hardCards = makeHardCards(total);

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(hardCards, d, true, false);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // ── Soft totals ────────────────────────────────────────────────────────────
  const softSepRow = document.createElement('tr');
  softSepRow.className = 'section-sep';
  softSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Soft Totals</td>`;
  tbody.appendChild(softSepRow);

  for (let other = 2; other <= 9; other++) {
    const total = 11 + other; // Ace + other
    const tr  = document.createElement('tr');
    tr.dataset.rowKey = `S${total}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `A + ${other}`;
    tr.appendChild(labelTd);

    const softCards = [{ rank: 'A', suit: '♠' }, { rank: String(other), suit: '♥' }];

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(softCards, d, true, false);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // ── Pairs ──────────────────────────────────────────────────────────────────
  const pairSepRow = document.createElement('tr');
  pairSepRow.className = 'section-sep';
  pairSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Pairs</td>`;
  tbody.appendChild(pairSepRow);

  const pairRanks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  pairRanks.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.rowKey = `P-${r}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `${r} - ${r}`;
    tr.appendChild(labelTd);

    const pairCards = [{ rank: r, suit: '♠' }, { rank: r, suit: '♥' }];

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(pairCards, d, true, true);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.strategyMatrix.innerHTML = '';
  el.strategyMatrix.appendChild(table);
}

// Create synthetic hard cards for a given total (avoids accidental pairs or soft hands).
function makeHardCards(total) {
  if (total >= 21) return [{ rank:'K',suit:'♠'},{rank:'K',suit:'♥'},{rank:String(total-20),suit:'♦'}];
  if (total >= 12) return [{ rank:'10',suit:'♠'},{rank:String(total-10),suit:'♥'}];
  // 8-11: use two non-ace cards
  const r1 = Math.floor(total / 2);
  const r2 = total - r1;
  return [{ rank:String(r1),suit:'♠'},{rank:String(r2),suit:'♥'}];
}

// Highlight the matrix cell corresponding to the current hand + dealer card.
function highlightMatrixCell(playerCards, dealerUpCard) {
  // Clear previous highlight
  el.strategyMatrix.querySelectorAll('.current-cell').forEach(c => c.classList.remove('current-cell'));

  const rowKey = getMatrixRowKey(playerCards);
  const colKey = getMatrixColKey(dealerUpCard.rank);

  const rowEl = el.strategyMatrix.querySelector(`tr[data-row-key="${rowKey}"]`);
  if (!rowEl) return;

  const cellEl = Array.from(rowEl.querySelectorAll('td[data-col]'))
    .find(td => td.dataset.col === colKey);
  if (cellEl) cellEl.classList.add('current-cell');
}

function getMatrixRowKey(playerCards) {
  if (playerCards.length === 2) {
    const v0 = rankValue(playerCards[0].rank);
    const v1 = rankValue(playerCards[1].rank);
    if (v0 === v1) return `P-${playerCards[0].rank}`;
  }
  if (isSoft(playerCards)) return `S${handValue(playerCards)}`;
  return `H${Math.max(8, Math.min(21, handValue(playerCards)))}`;
}

function getMatrixColKey(dealerRank) {
  return ['J','Q','K'].includes(dealerRank) ? '10' : dealerRank;
}

// ── Analytics (Stretch 2) ─────────────────────────────────────────────────────

function updateAnalytics(results, totalNet) {
  stats.hands++;
  stats.bankroll.push(game.balance);

  const outcome = results.some(r => r.outcome === 'blackjack') ? 'blackjack'
                : results.some(r => r.outcome === 'win')       ? 'win'
                : results.some(r => r.outcome === 'push')      ? 'push'
                : 'lose';

  if (outcome === 'win' || outcome === 'blackjack') stats.wins++;
  else if (outcome === 'push') stats.pushes++;
  else stats.losses++;

  if (outcome === 'blackjack') stats.blackjacks++;

  updateAnalyticsDisplay();
}

function updateAnalyticsDisplay() {
  el.statHands.textContent  = stats.hands;
  el.statWins.textContent   = stats.wins;
  el.statLosses.textContent = stats.losses;
  el.statPushes.textContent = stats.pushes;

  const total = stats.wins + stats.losses + stats.pushes;
  if (total > 0) {
    const wr = ((stats.wins + stats.pushes * 0.5) / total * 100).toFixed(1);
    el.statWinrate.textContent = wr + '%';
  }

  if (stats.aiTotal > 0) {
    el.statAiAgree.textContent = Math.round(stats.aiAgreements / stats.aiTotal * 100) + '%';
  }

  renderBankrollChart();
  renderActionChart();
  renderWLPBar();
}

// SVG sparkline for bankroll over time
function renderBankrollChart() {
  const svg    = el.bankrollSvg;
  const data   = stats.bankroll;
  if (data.length < 2) return;

  const W = svg.clientWidth  || 280;
  const H = svg.clientHeight || 80;
  const min = Math.min(...data) - 20;
  const max = Math.max(...data) + 20;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastVal = data[data.length - 1];
  const color   = lastVal >= STARTING_BALANCE ? '#22c55e' : '#ef4444';

  svg.innerHTML = `
    <polyline points="${pts}"
      fill="none" stroke="${color}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="0" y1="${(H - ((STARTING_BALANCE - min) / (max - min)) * H).toFixed(1)}"
          x2="${W}" y2="${(H - ((STARTING_BALANCE - min) / (max - min)) * H).toFixed(1)}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,4"/>
  `;
}

// SVG bar chart for action breakdown
function renderActionChart() {
  const svg = el.actionSvg;
  const acts = ['hit','stand','double','split'];
  const vals = acts.map(a => stats.actions[a]);
  const maxVal = Math.max(1, ...vals);

  const W  = svg.clientWidth  || 280;
  const H  = svg.clientHeight || 80;
  const bw = Math.floor(W / acts.length) - 8;
  const colors = { hit:'#22c55e', stand:'#ef4444', double:'#d4af37', split:'#8b5cf6' };

  svg.innerHTML = acts.map((a, i) => {
    const bh   = Math.max(2, (vals[i] / maxVal) * (H - 20));
    const x    = i * (bw + 8) + 4;
    const y    = H - bh - 16;
    return `
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3"
            fill="${colors[a]}" opacity="0.8"/>
      <text x="${x + bw/2}" y="${H - 2}" text-anchor="middle"
            fill="#94a3b8" font-size="9" font-family="Inter,sans-serif">${a}</text>
      <text x="${x + bw/2}" y="${y - 2}" text-anchor="middle"
            fill="#e2e8f0" font-size="9" font-family="JetBrains Mono,monospace">${vals[i]}</text>
    `;
  }).join('');
}

// Win/loss/push segmented bar
function renderWLPBar() {
  const total = stats.wins + stats.losses + stats.pushes;
  if (!total) return;
  const wPct = (stats.wins   / total * 100).toFixed(1);
  const lPct = (stats.losses / total * 100).toFixed(1);
  const pPct = (stats.pushes / total * 100).toFixed(1);

  const winSeg  = el.wlpBar.querySelector('.seg-win');
  const lossSeg = el.wlpBar.querySelector('.seg-loss');
  const pushSeg = el.wlpBar.querySelector('.seg-push');
  if (winSeg)  winSeg.style.width  = wPct + '%';
  if (lossSeg) lossSeg.style.width = lPct + '%';
  if (pushSeg) pushSeg.style.width = pPct + '%';
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function canDeal() {
  return hasApiKey(currentProvider) && game.balance >= game.bet && game.phase !== 'playing';
}

function markKeyLoaded(summary) {
  el.keyDot.classList.add('loaded');
  el.keyText.textContent = `Key loaded ✓ (${summary})`;
  el.keyIndicator.classList.add('loaded');
  el.playBtn.disabled = !canDeal();
  setStatus('API key loaded. Set your bet and press PLAY.');
}

function applyKeyInput() {
  const raw = el.keyInput.value;
  if (!raw.trim()) return;
  try {
    const provider = setKeyDirectly(raw);
    const key = raw.trim().replace(/\s+/g, '');
    const masked = key.slice(0, 7) + '••••' + key.slice(-4);
    markKeyLoaded(`${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} (${masked})`);
    // Switch family select to match detected provider
    if (el.familySelect.value !== provider) {
      el.familySelect.value = provider;
      currentProvider = provider;
      populateModels();
    }
    el.keyInput.classList.add('valid');
  } catch (err) {
    setStatus('Key error: ' + err.message, 'lose');
    el.keyInput.classList.remove('valid');
  }
}

function strategyLabel(code) {
  return { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' }[code] || code;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
