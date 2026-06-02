import { shuffle, fullDeck } from "./cards";
import { bestScoreFrom7, compareScores, describeScore } from "./hand-eval";

export interface HeadsUpRunout {
  holes: [[string, string], [string, string]];
  board: readonly string[];
  winner: 0 | 1 | "tie";
  summary0: string;
  summary1: string;
}

/** Deal two hole hands and a full board (burns skipped). Compare best 5-card hands. */
export function headsUpRunoutAllIn(rng: () => number = Math.random): HeadsUpRunout {
  const d = [...shuffle(fullDeck(), rng)];
  const h0: [string, string] = [d.pop()!, d.pop()!];
  const h1: [string, string] = [d.pop()!, d.pop()!];
  d.pop();
  const flop: [string, string, string] = [d.pop()!, d.pop()!, d.pop()!];
  d.pop();
  const turn = d.pop()!;
  d.pop();
  const river = d.pop()!;
  const board = [...flop, turn, river] as const;
  const s0 = bestScoreFrom7([...h0, ...board]);
  const s1 = bestScoreFrom7([...h1, ...board]);
  const cmp = compareScores(s0, s1);
  const winner: 0 | 1 | "tie" = cmp === 0 ? "tie" : cmp > 0 ? 0 : 1;
  return {
    holes: [h0, h1],
    board,
    winner,
    summary0: describeScore(s0),
    summary1: describeScore(s1),
  };
}
