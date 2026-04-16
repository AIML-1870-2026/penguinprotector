# AI Blackjack

A fully playable Blackjack game powered by an LLM AI agent (Claude). After each deal the agent
analyzes the current game state and recommends the optimal action, returning structured JSON so
the recommendation is unambiguous.

## Setup

1. Open `index.html` directly in Chrome or Firefox (no server required).
2. Click **Upload .env** and select a file containing your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Select a model from the **Model** dropdown (default: Claude Sonnet 4.6).
4. Set your bet using `−` / `+` and press **PLAY**.

The key is parsed in memory only and cleared when you close the tab.

## How to Play

| Button | When available | Description |
|--------|---------------|-------------|
| **HIT** | Always | Draw another card |
| **STAND** | Always | End your turn |
| **DOUBLE** | First 2 cards + sufficient balance | Double bet, draw exactly one card |
| **SPLIT** | Matching pair, original hand only | Split into two separate hands |
| **INSURANCE** | Dealer shows Ace, first action | Side bet (half your wager) that dealer has blackjack |

After each deal the AI panel (right sidebar) shows:
- **AI Recommends** — the recommended action word, color-coded
- **Confidence meter** — fills green → amber → red as confidence decreases
- **Analysis text** — full strategic reasoning
- **Execute Recommendation** — applies the AI's action automatically

## AI Integration

The agent is prompted to return **only** a JSON object:

```json
{
  "action": "stand",
  "confidence": 0.92,
  "brief_reason": "Hard 18 vs dealer 6 — dealer bust probability is high.",
  "full_analysis": "Your hard 18 is a strong hand. The dealer showing 6...",
  "basic_strategy_action": "stand"
}
```

No keyword search is used. `response.action` is parsed directly.

Every hand logs the full request/response cycle to the browser console (`F12 → Console`):

```
[BJ Agent] --- New Hand ---
[BJ Agent] Player hand: [A♠, 7♦] → Soft 18
[BJ Agent] Dealer up card: 9♣
[BJ Agent] Available actions: hit, stand, double
[BJ Agent] Sending request to Anthropic API...
[BJ Agent] Raw API response: { ... }
[BJ Agent] Parsed action: "stand"  confidence: 0.87
[BJ Agent] Executing action: STAND
```

## Payouts

| Outcome | Payout |
|---------|--------|
| Win | 1:1 (double your bet) |
| Blackjack (natural 21) | 3:2 |
| Insurance (dealer has BJ) | 2:1 |
| Push | Bet returned |
| Loss | Bet forfeited |

## Stretch Features

### Stretch 1 — Basic Strategy Matrix
The matrix at the bottom of the page color-codes every cell by the optimal action:

| Color | Action |
|-------|--------|
| Red | Hit |
| Green | Stand |
| Gold | Double |
| Purple | Split |

After each AI recommendation the matrix highlights the cell matching your current hand and
dealer up card with a pulsing gold glow. A badge below the matrix shows whether the AI
matched or deviated from pure basic strategy.

### Stretch 2 — Session Analytics
The collapsible analytics panel tracks:

- Hands played, wins, losses, pushes
- Win rate (pushes count as 0.5 wins)
- Bankroll sparkline (SVG, drawn in vanilla JS)
- Action breakdown bar chart
- AI vs Basic Strategy agreement percentage

## Testing Notes

Edge cases verified during development:

- **Split aces** — each ace gets one additional card; split hands cannot score as natural blackjack
- **Soft doubles** — e.g. A+6 vs dealer 3 → Double correctly offered
- **Insurance payout** — side bet returned 3× on dealer blackjack (2:1 net)
- **Dealer soft 16** — dealer correctly hits on soft 16 and below (e.g. A+5)
- **Double down** — second bet deducted from balance, one card drawn, hand auto-advances
- **Balance protection** — Double and Split buttons disabled when insufficient balance
- **AI fallback** — if the recommended action is unavailable, ui.js corrects it and warns in console

## File Structure

```
ai-blackjack/
├── index.html          ← markup
├── style.css           ← full design system
├── game.js             ← Blackjack engine (deck, deal, score, payouts, basicStrategy)
├── agent.js            ← LLM integration (.env parsing, fetch, JSON extraction)
├── ui.js               ← orchestrator (DOM, animations, strategy matrix, analytics)
├── CLAUDE.md           ← assignment context
├── README.md           ← this file
└── temp/
    └── reference.html  ← reference implementation (NOT in final submission)
```
