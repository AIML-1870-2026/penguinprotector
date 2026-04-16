'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUITS  = ['♠', '♥', '♦', '♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

const STARTING_BALANCE = 1000;
const BET_STEP = 5;
const BET_MIN  = 5;
const BET_MAX  = 500;

// ── Card Utilities ─────────────────────────────────────────────────────────────

function rankValue(rank) {
  if (rank === 'A') return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

// Returns the point total for an array of card objects.
// Handles soft aces: counts Ace as 1 when 11 would bust.
function handValue(cards) {
  const visible = cards.filter(c => !c.faceDown);
  let total = visible.reduce((s, c) => s + rankValue(c.rank), 0);
  let aces  = visible.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// Returns true if at least one ace in the hand is still counting as 11.
function isSoft(cards) {
  const visible = cards.filter(c => !c.faceDown);
  let total = visible.reduce((s, c) => s + rankValue(c.rank), 0);
  let aces  = visible.filter(c => c.rank === 'A').length;
  let soft  = aces;
  while (total > 21 && soft > 0) { total -= 10; soft--; }
  return soft > 0;
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

function isBust(cards) {
  return handValue(cards) > 21;
}

// ── Deck ───────────────────────────────────────────────────────────────────────

function buildDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })));
}

// Fisher-Yates shuffle (in-place on a copy).
function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Basic Strategy ─────────────────────────────────────────────────────────────
// Returns 'H' (hit), 'S' (stand), 'D' (double), 'P' (split).
// canDouble / canSplit control which options are available.
function basicStrategy(playerCards, dealerUpRank, canDouble, canSplit) {
  const total = handValue(playerCards);
  const soft  = isSoft(playerCards);
  // Treat dealer Ace as 11 for strategy indexing
  const du    = dealerUpRank === 'A' ? 11 : rankValue(dealerUpRank);

  // ── Pairs ────────────────────────────────────────────────────────────────────
  if (canSplit && playerCards.length === 2) {
    const v0 = rankValue(playerCards[0].rank);
    const v1 = rankValue(playerCards[1].rank);
    if (v0 === v1) {
      const r = playerCards[0].rank;
      if (r === 'A')                                  return 'P';
      if (r === '8')                                  return 'P';
      if (v0 === 9 && ![7, 10, 11].includes(du))      return 'P';
      if (v0 === 7 && du <= 7)                        return 'P';
      if (v0 === 6 && du <= 6)                        return 'P';
      if (v0 === 4 && (du === 5 || du === 6))         return 'P';
      if ((v0 === 2 || v0 === 3) && du <= 7)          return 'P';
    }
  }

  // ── Soft totals ──────────────────────────────────────────────────────────────
  if (soft) {
    if (total >= 20)  return 'S';
    if (total === 19) return (du === 6 && canDouble) ? 'D' : 'S';
    if (total === 18) {
      if (canDouble && [2,3,4,5,6].includes(du)) return 'D';
      return [7,8].includes(du) ? 'S' : 'H';
    }
    if (total === 17) return (canDouble && [3,4,5,6].includes(du)) ? 'D' : 'H';
    if (total >= 15)  return (canDouble && [4,5,6].includes(du))   ? 'D' : 'H';
    if (total >= 13)  return (canDouble && [5,6].includes(du))     ? 'D' : 'H';
    return 'H';
  }

  // ── Hard totals ──────────────────────────────────────────────────────────────
  if (total >= 17)                               return 'S';
  if (total >= 13 && du <= 6)                    return 'S';
  if (total === 12 && [4,5,6].includes(du))      return 'S';
  if (total === 11)                              return canDouble ? 'D' : 'H';
  if (total === 10 && du <= 9 && canDouble)      return 'D';
  if (total === 9  && [3,4,5,6].includes(du) && canDouble) return 'D';
  return 'H';
}

// Human-readable label for a strategy code.
function strategyLabel(code) {
  return { H:'Hit', S:'Stand', D:'Double Down', P:'Split' }[code] || code;
}

// ── Game State ─────────────────────────────────────────────────────────────────

const game = {
  phase:        'idle',  // idle | playing | dealer | done
  balance:      STARTING_BALANCE,
  bet:          25,
  deck:         shuffleDeck(buildDeck()),
  dealerCards:  [],
  playerHands:  [[]],   // supports split (up to 2 hands)
  activeHand:   0,
  handBets:     [],
  insuranceBet: 0,
  lastResults:  null,   // resolved after each round
};

// Draw the next card from the shoe; reshuffle if nearly empty.
function drawCard(faceDown = false) {
  if (game.deck.length < 15) game.deck = shuffleDeck(buildDeck());
  return { ...game.deck.pop(), faceDown };
}

function canDeal() {
  return (game.phase === 'idle' || game.phase === 'done') && game.balance >= game.bet;
}

// Begin a new hand: deduct bet, deal initial cards.
function startHand() {
  if (!canDeal()) return false;
  game.balance     -= game.bet;
  game.dealerCards  = [drawCard(false), drawCard(true)];
  game.playerHands  = [[drawCard(false), drawCard(false)]];
  game.handBets     = [game.bet];
  game.activeHand   = 0;
  game.insuranceBet = 0;
  game.lastResults  = null;
  game.phase        = 'playing';
  return true;
}

function getActiveHand() {
  return game.playerHands[game.activeHand];
}

// Returns the list of valid actions for the current state.
function getAvailableActions() {
  if (game.phase !== 'playing') return [];
  const hand       = getActiveHand();
  const isFirstTwo = hand.length === 2;
  const actions    = ['hit', 'stand'];

  // Double down: first two cards and enough balance
  if (isFirstTwo && game.balance >= game.handBets[game.activeHand]) {
    actions.push('double');
  }

  // Split: matching pair, only on the original unsplit hand, enough balance
  if (isFirstTwo && game.playerHands.length === 1 &&
      rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
      game.balance >= game.bet) {
    actions.push('split');
  }

  // Insurance: dealer shows Ace, first two cards, no prior insurance
  if (isFirstTwo && game.activeHand === 0 &&
      game.dealerCards[0].rank === 'A' && game.insuranceBet === 0 &&
      game.balance >= Math.floor(game.bet / 2)) {
    actions.push('insurance');
  }

  return actions;
}

// ── Player Actions ─────────────────────────────────────────────────────────────

function doHit() {
  const hand = getActiveHand();
  hand.push(drawCard());
  // Auto-advance if bust or 21
  if (isBust(hand) || handValue(hand) === 21) _advanceHand();
}

function doStand() {
  _advanceHand();
}

function doDouble() {
  const extra = game.handBets[game.activeHand];
  game.balance -= extra;
  game.handBets[game.activeHand] *= 2;
  getActiveHand().push(drawCard());
  _advanceHand();
}

function doSplit() {
  const hand = getActiveHand();
  game.balance -= game.bet;
  game.playerHands = [
    [{ ...hand[0] }, drawCard()],
    [{ ...hand[1] }, drawCard()],
  ];
  game.handBets  = [game.bet, game.bet];
  game.activeHand = 0;
  // Remain in playing phase; player now acts on hand 0
}

// Take insurance side bet (half of original bet).
function doInsurance() {
  const amount = Math.floor(game.bet / 2);
  game.balance     -= amount;
  game.insuranceBet = amount;
}

// Move to the next hand, or transition to dealer phase.
function _advanceHand() {
  game.activeHand++;
  if (game.activeHand >= game.playerHands.length) {
    game.phase = 'dealer';
  }
}

// ── Dealer Turn ────────────────────────────────────────────────────────────────

// Reveals the hole card and draws until 17+. Returns resolved results.
function runDealer() {
  game.dealerCards[1].faceDown = false;

  // Dealer stands on hard 17+; hits on 16 and below (including soft 16)
  while (handValue(game.dealerCards) < 17) {
    game.dealerCards.push(drawCard());
  }

  game.phase = 'done';
  return _resolveHands();
}

// ── Resolution ─────────────────────────────────────────────────────────────────

function _resolveHands() {
  const dTotal  = handValue(game.dealerCards);
  const dBJ     = isBlackjack(game.dealerCards);
  const dBust   = isBust(game.dealerCards);
  const results = [];

  // Insurance payout: 2:1 if dealer has blackjack
  let insuranceDelta = 0;
  if (game.insuranceBet > 0 && dBJ) {
    const ins = game.insuranceBet * 3; // 2:1 + original side bet returned
    game.balance  += ins;
    insuranceDelta = game.insuranceBet * 2;
  }

  for (let i = 0; i < game.playerHands.length; i++) {
    const hand  = game.playerHands[i];
    const bet   = game.handBets[i];
    const total = handValue(hand);
    const bust  = isBust(hand);
    // Blackjack only counts on the original single hand (not after split)
    const bjack = isBlackjack(hand) && game.playerHands.length === 1;

    let outcome, payout, net;

    if (bust) {
      outcome = 'bust';      payout = 0;                          net = -bet;
    } else if (bjack && dBJ) {
      outcome = 'push';      payout = bet;                        net = 0;
      game.balance += payout;
    } else if (bjack) {
      // Blackjack pays 3:2
      outcome = 'blackjack'; payout = bet + Math.floor(bet * 1.5); net = Math.floor(bet * 1.5);
      game.balance += payout;
    } else if (dBJ) {
      outcome = 'lose';      payout = 0;                          net = -bet;
    } else if (dBust || total > dTotal) {
      outcome = 'win';       payout = bet * 2;                    net = bet;
      game.balance += payout;
    } else if (total === dTotal) {
      outcome = 'push';      payout = bet;                        net = 0;
      game.balance += payout;
    } else {
      outcome = 'lose';      payout = 0;                          net = -bet;
    }

    results.push({ outcome, net, bet, hand });
  }

  results.insuranceDelta = insuranceDelta;
  game.lastResults = results;
  return results;
}
