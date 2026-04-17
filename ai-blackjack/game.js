'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUITS  = ['♠', '♥', '♦', '♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

const STARTING_BALANCE = 1000;
const BET_STEP = 5;
const BET_MIN  = 5;
const BET_MAX  = 500;

// ── Shoe Configuration ─────────────────────────────────────────────────────────

let numDecks = 6;

// Hi-Lo counting values: low cards (2-6) = +1, neutral (7-9) = 0, high cards (10-A) = -1
const HI_LO = {
  '2':1,'3':1,'4':1,'5':1,'6':1,
  '7':0,'8':0,'9':0,
  '10':-1,'J':-1,'Q':-1,'K':-1,'A':-1,
};

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

// ── Deck / Shoe ────────────────────────────────────────────────────────────────

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

function buildShoe(decks) {
  const shoe = [];
  for (let d = 0; d < decks; d++) shoe.push(...buildDeck());
  return shuffleDeck(shoe);
}

// ── Game State ─────────────────────────────────────────────────────────────────

const game = {
  phase:          'idle',  // idle | playing | dealer | done
  balance:        STARTING_BALANCE,
  bet:            25,
  deck:           [],
  shoeTotalCards: 0,
  runningCount:   0,
  shuffledRecently: false,  // flag for UI to flash shuffle notice
  dealerCards:    [],
  playerHands:    [[]],
  activeHand:     0,
  handBets:       [],
  insuranceBet:   0,
  lastResults:    null,
  sideBetActive:  false,
  sideBetResult:  null,
};

// Build a fresh shoe and reset the running count.
function initShoe() {
  game.deck           = buildShoe(numDecks);
  game.shoeTotalCards = game.deck.length;
  game.runningCount   = 0;
  game.shuffledRecently = true;
}

function setNumDecks(n) {
  numDecks = n;
  initShoe();
}

// Initialise on load.
initShoe();
game.shuffledRecently = false; // suppress flash on first load

// ── Drawing ────────────────────────────────────────────────────────────────────

// Draw the next card from the shoe; reshuffle when below 25% penetration.
function drawCard(faceDown = false) {
  const reshuffleAt = Math.ceil(game.shoeTotalCards * 0.25);
  if (game.deck.length <= reshuffleAt) {
    initShoe();
    // shuffledRecently is now true → ui.js will show a flash notice
  }
  const card = { ...game.deck.pop(), faceDown };
  if (!faceDown) game.runningCount += HI_LO[card.rank] ?? 0;
  return card;
}

// Call this when a face-down card is turned face-up (hole card reveal).
function countRevealedCard(card) {
  game.runningCount += HI_LO[card.rank] ?? 0;
}

// ── Probability Helpers ────────────────────────────────────────────────────────

// Decks remaining in the shoe (used for true count).
function getDecksRemaining() {
  return Math.max(0.5, game.deck.length / 52);
}

// True count = running count ÷ decks remaining.
function trueCount() {
  return game.runningCount / getDecksRemaining();
}

// Probability (0–1) that the next card will bust the active hand.
// Returns null when not in playing phase.
function bustProbability() {
  if (game.phase !== 'playing') return null;
  const hand = getActiveHand();
  const remaining = game.deck;
  if (remaining.length === 0) return null;

  let bustCount = 0;
  for (const card of remaining) {
    if (handValue([...hand, { rank: card.rank, suit: card.suit }]) > 21) bustCount++;
  }
  return bustCount / remaining.length;
}

// ── Basic Strategy ─────────────────────────────────────────────────────────────
// Returns 'H' (hit), 'S' (stand), 'D' (double), 'P' (split), 'R' (surrender).
function basicStrategy(playerCards, dealerUpRank, canDouble, canSplit, canSurrender) {
  const total = handValue(playerCards);
  const soft  = isSoft(playerCards);
  const du    = dealerUpRank === 'A' ? 11 : rankValue(dealerUpRank);

  // ── Surrender ────────────────────────────────────────────────────────────────
  if (canSurrender && playerCards.length === 2) {
    if (total === 16 && [9,10,11].includes(du)) return 'R';
    if (total === 15 && du === 10)              return 'R';
  }

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

// ── Action Probability Simulation ─────────────────────────────────────────────

// Sample a random card from the remaining shoe (with replacement).
function _sampleCard() {
  return game.deck[Math.floor(Math.random() * game.deck.length)];
}

// Simulate the dealer playing out their hand (using known hole card + sampled draws).
// Returns the dealer's final total.
function _simulateDealerTotal() {
  const dc = game.dealerCards.map(c => ({ rank: c.rank }));
  while (handValue(dc) < 17) dc.push({ rank: _sampleCard().rank });
  return handValue(dc);
}

// Simulate a player action nSims times and return outcome percentages.
// Returns { win, push, lose, bust } as integers 0–100, or null if unavailable.
// Surrender is deterministic — always returns { win:0, push:0, lose:50, bust:0 }.
function simulateActionProbs(action, nSims = 3000) {
  if (action === 'surrender') return { win: 0, push: 0, lose: 50, bust: 0 };
  if (!game.deck.length)      return null;

  const playerHand = getActiveHand();
  let wins = 0, pushes = 0, losses = 0, busts = 0;

  for (let i = 0; i < nSims; i++) {
    let playerTotal;
    let busted = false;

    if (action === 'stand') {
      playerTotal = handValue(playerHand);
    } else {
      // hit or double: draw one card
      const c       = _sampleCard();
      const newHand = [...playerHand, { rank: c.rank }];
      playerTotal   = handValue(newHand);
      if (playerTotal > 21) { busts++; losses++; busted = true; }
    }

    if (!busted) {
      const dTotal = _simulateDealerTotal();
      if (dTotal > 21 || playerTotal > dTotal) wins++;
      else if (playerTotal === dTotal)         pushes++;
      else                                     losses++;
    }
  }

  const loseNoB = losses - busts;
  return {
    win:  Math.round(wins   / nSims * 100),
    push: Math.round(pushes / nSims * 100),
    lose: Math.round(loseNoB / nSims * 100),
    bust: Math.round(busts  / nSims * 100),
  };
}

// ── Even Money ─────────────────────────────────────────────────────────────────
// Player has Blackjack + dealer shows Ace → accept guaranteed 1:1 payout.
function doEvenMoney() {
  const bet = game.handBets[0];
  game.balance += bet * 2; // return bet + 1:1 win (bet was already deducted)
  game.phase = 'done';
  const results = [{ outcome: 'even-money', net: bet, bet, hand: game.playerHands[0] }];
  results.insuranceDelta = 0;
  game.lastResults = results;
  return results;
}

// ── 21+3 Side Bet ──────────────────────────────────────────────────────────────
const SIDE_BET_AMOUNT = 10;

// Evaluate player's first 2 cards + dealer up card.
// Returns { name, payout } on win, or null on loss.
function evaluate21Plus3(c1, c2, dealerC) {
  const cards  = [c1, c2, dealerC];
  const suits  = cards.map(c => c.suit);
  const ranks  = cards.map(c => c.rank);

  const rv = r => {
    if (r === 'A') return 1;
    if (r === 'J') return 11;
    if (r === 'Q') return 12;
    if (r === 'K') return 13;
    return parseInt(r, 10);
  };

  const vals    = ranks.map(rv).sort((a, b) => a - b);
  const allSuit = suits.every(s => s === suits[0]);
  const allRank = ranks.every(r => r === ranks[0]);
  const consec  = vals[2] - vals[0] === 2 && vals[1] - vals[0] === 1;
  const aceHigh = vals[0] === 1 && vals[1] === 12 && vals[2] === 13; // Q-K-A
  const str8    = consec || aceHigh;

  if (allSuit && allRank) return { name: 'Suited Trips',    payout: 100 };
  if (allSuit && str8)    return { name: 'Straight Flush',  payout: 40  };
  if (allRank)            return { name: 'Three of a Kind', payout: 30  };
  if (str8)               return { name: 'Straight',        payout: 10  };
  if (allSuit)            return { name: 'Flush',            payout: 5   };
  return null;
}

// Resolve the side bet immediately after the deal. Credits winnings to balance.
function resolveSideBet() {
  if (!game.sideBetActive) return null;
  const hit = evaluate21Plus3(
    game.playerHands[0][0], game.playerHands[0][1], game.dealerCards[0]
  );
  if (hit) {
    game.balance += SIDE_BET_AMOUNT * hit.payout + SIDE_BET_AMOUNT;
    game.sideBetResult = { ...hit, net: SIDE_BET_AMOUNT * hit.payout };
  } else {
    game.sideBetResult = { name: null, payout: 0, net: -SIDE_BET_AMOUNT };
  }
  return game.sideBetResult;
}

// Human-readable label for a strategy code.
function strategyLabel(code) {
  return { H:'Hit', S:'Stand', D:'Double Down', P:'Split', R:'Surrender' }[code] || code;
}

// ── Available Actions ──────────────────────────────────────────────────────────

function canDeal() {
  return (game.phase === 'idle' || game.phase === 'done') && game.balance >= game.bet;
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

  // Surrender: first two cards on original (non-split) hand
  if (isFirstTwo && game.playerHands.length === 1) {
    actions.push('surrender');
  }

  return actions;
}

// ── Hand Setup ─────────────────────────────────────────────────────────────────

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
  game.sideBetResult = null;
  // Deduct 21+3 side bet ($10) if active and affordable
  if (game.sideBetActive && game.balance >= 10) game.balance -= 10;
  game.phase        = 'playing';
  return true;
}

function getActiveHand() {
  return game.playerHands[game.activeHand];
}

// ── Player Actions ─────────────────────────────────────────────────────────────

function doHit() {
  const hand = getActiveHand();
  hand.push(drawCard());
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
}

// Late surrender: return half the bet, end the hand immediately (no dealer reveal).
function doSurrender() {
  const bet    = game.handBets[game.activeHand];
  const refund = Math.floor(bet / 2);
  game.balance += refund;
  game.phase    = 'done';
  const results = [{ outcome: 'surrender', net: -(bet - refund), bet, hand: getActiveHand() }];
  results.insuranceDelta = 0;
  game.lastResults = results;
  return results;
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
  countRevealedCard(game.dealerCards[1]);  // add hole card to running count

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
    const ins = game.insuranceBet * 3;
    game.balance  += ins;
    insuranceDelta = game.insuranceBet * 2;
  }

  for (let i = 0; i < game.playerHands.length; i++) {
    const hand  = game.playerHands[i];
    const bet   = game.handBets[i];
    const total = handValue(hand);
    const bust  = isBust(hand);
    const bjack = isBlackjack(hand) && game.playerHands.length === 1;

    let outcome, payout, net;

    if (bust) {
      outcome = 'bust';      payout = 0;                          net = -bet;
    } else if (bjack && dBJ) {
      outcome = 'push';      payout = bet;                        net = 0;
      game.balance += payout;
    } else if (bjack) {
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
