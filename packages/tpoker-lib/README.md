# @telegram-poker/poker-engine

No-limit Texas hold'em engine for Node.js: deck and shuffle helpers, hand evaluation, a betting state machine, and commit/reveal ("provably fair") dealing.

The engine has no runtime dependencies and does no I/O. You own the state object: store it wherever you like (the server keeps it in Redis) and pass it back in for each action.

## Install

Inside this monorepo the package is a workspace, so the root install links and builds it:

```bash
npm install            # from the repo root
npm run build:engine   # rebuild after changing the engine
npm run dev:engine     # rebuild on change
```

Requires Node.js 18 or newer. The build output is CommonJS with type declarations in `dist/`.

## Quick start

```ts
import {
  applyHoldemAction,
  createHandFairness,
  deckFromHash,
  holdemPublicSnapshot,
  startHoldemHand,
  verifyFairness,
  viewerHoleCards,
} from '@telegram-poker/poker-engine';

// 1. Commit to a deck before dealing. `nonce` ties the seeds to this hand.
const handSeq = 1;
const fairness = createHandFairness(handSeq);
const deck = deckFromHash(fairness.privateSeed, fairness.publicSeed, fairness.nonce);

// 2. Start the hand. Blinds are posted and hole cards dealt.
const state = startHoldemHand({
  seats: [
    { seatIndex: 0, userId: 'alice', stack: 1000 },
    { seatIndex: 1, userId: 'bob', stack: 1000 },
  ],
  buttonSeat: 0,
  smallBlind: 5,
  bigBlind: 10,
  handSeq,
  deck,
  fairness,
});

// 3. Apply actions for the seat in `toActSeat`. The state is mutated in place.
const result = applyHoldemAction(state, state.toActSeat!, { type: 'call' });
if (!result.ok) console.error(result.error);

// 4. Send each client the public snapshot plus only their own hole cards.
const snapshot = holdemPublicSnapshot(state);
const aliceCards = viewerHoleCards(state, 0);

// 5. Once `snapshot.phase === 'complete'`, the private seed is revealed and
//    anyone can check the deal.
if (snapshot.fairness) {
  const check = verifyFairness(snapshot.fairness, deck);
  console.log(check.valid, check.reason);
}
```

## Cards

Cards are two-character strings: rank (`2`–`9`, `T`, `J`, `Q`, `K`, `A`) then suit (`c`, `d`, `h`, `s`), for example `As` or `Td`.

| Function | Description |
|---|---|
| `fullDeck()` | The 52 cards in a fixed order. |
| `shuffle(items, rng?)` | Fisher–Yates shuffle using an `rng` that returns a float in [0, 1). Defaults to `Math.random`. |
| `shuffleWith(items, randomInt)` | Fisher–Yates shuffle using `randomInt(max)`, a uniform integer in [0, max). Deterministic for a deterministic source. |
| `rankOf(card)` | Numeric rank, 2 to 14 (ace high). |
| `suitOf(card)` | Suit character. |

## Hand evaluation

A score is a number array: the hand category first, then tie-breakers in descending order. Compare scores with `compareScores`, never by category alone.

| Category | Hand |
|---|---|
| 8 | Straight flush |
| 7 | Quads |
| 6 | Full house |
| 5 | Flush |
| 4 | Straight |
| 3 | Trips |
| 2 | Two pair |
| 1 | Pair |
| 0 | High card |

| Function | Description |
|---|---|
| `scoreFiveCards(cards)` | Score for exactly five cards. |
| `bestScoreFrom7(cards)` | Best five-card score from the cards given (hole cards plus board). |
| `compareScores(a, b)` | Positive if `a` wins, negative if `b` wins, `0` for a tie. |
| `describeScore(score)` | Readable name, for example `Full house (King full of 9)`. |

## Hold'em state machine

| Function | Description |
|---|---|
| `startHoldemHand(input)` | Creates a `HoldemState`, posts blinds and deals hole cards. Needs at least two seats, and `buttonSeat` must be occupied. Throws otherwise. |
| `applyHoldemAction(state, seatIndex, action)` | Applies one action and advances streets, showdown and payouts as needed. Returns `{ ok: true }` or `{ ok: false, error }`; on an error the state is unchanged. |
| `forceFoldPlayer(state, seatIndex)` | Folds a player regardless of turn, for example on disconnect or leaving the table. |
| `holdemPublicSnapshot(state)` | The view that is safe to broadcast: no deck, no hidden hole cards, no private seed until the hand is complete. |
| `viewerHoleCards(state, seatIndex)` | One seat's hole cards, or `null` if the seat is not in the hand. |
| `nextButtonSeat(occupiedSorted, currentButton)` | The next occupied seat clockwise, for moving the button between hands. |

`startHoldemHand` input:

| Field | Description |
|---|---|
| `seats` | `{ seatIndex, userId, stack }` for each player in the hand. |
| `buttonSeat` | Seat index of the dealer button. |
| `smallBlind`, `bigBlind` | Blind sizes in chips. |
| `handSeq` | Your hand counter. |
| `deck` | Optional pre-built 52-card deck. Cards are dealt from the end of the array. Overrides `rng`. |
| `rng` | Optional float source used to shuffle when no `deck` is given. Defaults to `Math.random`. |
| `fairness` | Optional commit/reveal data to carry on the state and expose in snapshots. |

Actions (`HoldemClientAction`):

| Action | Meaning |
|---|---|
| `{ type: 'fold' }` | Fold. |
| `{ type: 'check' }` | Check. Rejected when facing a bet. |
| `{ type: 'call' }` | Call, going all-in if the stack is short. |
| `{ type: 'bet', amount }` | Open the betting on a street. Minimum is the big blind. |
| `{ type: 'raise_to', amount }` | Raise so that the seat's total for this street equals `amount`. |

`phase` moves from `betting` to `showdown` to `complete`. When it is `complete`, `payouts` lists the chips awarded per seat, and the snapshot adds `awardedPot`, `revealedHoles` for players who did not fold, and the revealed `privateSeed`.

Side pots and the full all-in tree are only partly implemented.

## Fair dealing (`casino-core`)

The deal uses a commit/reveal scheme:

1. Before the hand, the server generates a random `privateSeed` and publishes `publicSeed = sha256(privateSeed)`.
2. The deck is derived from `(privateSeed, publicSeed, nonce)` with an HMAC-SHA256 stream. Rejection sampling keeps every position uniform.
3. After the hand, the server reveals `privateSeed`. Anyone can confirm it hashes to `publicSeed` and rebuild the same deck.

| Function | Description |
|---|---|
| `generateHash()` | A new `{ privateSeed, publicSeed }` pair. |
| `createHandFairness(nonce)` | A new seed pair plus the hand's `nonce`, ready to pass to `startHoldemHand`. |
| `deckFromHash(privateSeed, publicSeed, nonce)` | The 52-card deck for those seeds. The same inputs always give the same deck. |
| `verifyHandDeck(fairness)` | Rebuilds the deck, or returns `null` if `privateSeed` does not hash to `publicSeed`. |
| `verifyFairness(fairness, expectedDeck?)` | Full check that returns `{ valid, reason?, deck }`. Accepts a snapshot's `fairness` directly. |
| `sha256Hex(input)` | SHA-256 of a string, as hex. |

`verifyFairness` results:

| `valid` | `reason` | When |
|---|---|---|
| `true` | — | The seeds match, and the deck matches `expectedDeck` if one was given. |
| `false` | `private_seed_not_revealed` | The hand is not complete yet, so there is no `privateSeed`. |
| `false` | `seed_mismatch` | `sha256(privateSeed)` is not `publicSeed`. |
| `false` | `deck_mismatch` | The rebuilt deck differs from `expectedDeck`, for example because of a wrong `nonce`. |

`verifyFairness` checks the seeds and the deck order. It does not check that a hand's board and hole cards were dealt from that deck.

### Environment

| Variable | Description |
|---|---|
| `POKER_FAIRNESS_SALT` | Optional. Mixed into `privateSeed` generation as extra server-side entropy. Read once when the module loads. It is not part of the deck derivation, so verification never needs it and changing it does not invalidate past hands. |

These functions use `node:crypto`, so the package runs on Node.js, not in the browser.
