/**
 * Lenient Jeopardy-style answer judging.
 *
 * Archive answers encode acceptable variants with conventions this matcher
 * understands:
 *   "the Jordan"            — leading articles are optional
 *   "(Joseph) Stalin"       — parenthesized parts are optional
 *   "a lyre (or a harp)"    — "(or ...)" marks an alternate answer
 *   "Bombay/Mumbai"         — slashes separate alternates
 * Typos are tolerated with an edit-distance budget that scales with answer
 * length; very short answers must match exactly.
 */

const ARTICLES = new Set(["the", "a", "an"]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArticles(value: string): string {
  const tokens = value.split(" ");
  while (tokens.length > 1 && ARTICLES.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

const canonical = (value: string) => stripArticles(normalize(value));

/** All normalized forms a correct response may take. */
export function answerCandidates(answer: string): string[] {
  const out = new Set<string>();
  const push = (value: string) => {
    // Keep both article-stripped and as-written forms so a typo'd article
    // in the guess ("teh jordan") can still edit-match "the jordan".
    const normalized = normalize(value);
    if (normalized) out.add(normalized);
    const cleaned = stripArticles(normalized);
    if (cleaned) out.add(cleaned);
  };

  const raw = answer.trim();
  const withoutParens = raw.replace(/\([^)]*\)/g, " ");
  const parentheticals = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);

  push(raw.replace(/[()]/g, " "));
  push(withoutParens);
  for (const inner of parentheticals) {
    // Only "(or ...)" marks a standalone alternate. Other parentheticals,
    // like the first name in "(Joseph) Stalin", are optional context — the
    // part outside the parens stays required.
    if (/^or\s/i.test(inner.trim())) {
      push(inner.trim().replace(/^or\s+/i, ""));
    }
  }
  for (const part of withoutParens.split("/")) {
    push(part);
  }

  return [...out];
}

function editBudget(length: number): number {
  if (length < 5) return 0;
  if (length < 8) return 1;
  if (length < 12) return 2;
  return 3;
}

/**
 * Damerau-Levenshtein (optimal string alignment): counts an adjacent
 * transposition ("imohtep" → "imhotep") as one edit, since swapped letters
 * are the most common real typo.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let twoBack: number[] | null = null;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      if (
        twoBack &&
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        value = Math.min(value, twoBack[j - 2] + 1);
      }
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    twoBack = previous;
    previous = current;
  }
  return previous[b.length];
}

export type AnswerVerdict = "correct" | "incorrect";

export function judgeAnswer(guess: string, answer: string): AnswerVerdict {
  const cleanedGuess = canonical(guess);
  if (!cleanedGuess) return "incorrect";

  for (const candidate of answerCandidates(answer)) {
    if (cleanedGuess === candidate) return "correct";
    const budget = editBudget(Math.max(cleanedGuess.length, candidate.length));
    if (budget > 0 && editDistance(cleanedGuess, candidate, budget) <= budget) {
      return "correct";
    }
  }
  return "incorrect";
}
