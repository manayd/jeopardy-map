/**
 * Answer-key normalization and clue-format detection for the data pipeline.
 *
 * The answer key groups spelling/phrasing variants of the same entity so
 * frequency counts and subject propagation operate on entities, not raw
 * strings: "The Jordan", "the Jordan" and "Jordan" share a key, as do
 * "(Joseph) Stalin" and "Stalin". Semantics deliberately mirror
 * lib/answer-match.ts (articles optional, parentheticals optional,
 * punctuation/diacritics ignored).
 */

const ARTICLES = new Set(["the", "a", "an"]);

export function answerKey(rawAnswer) {
  const value = String(rawAnswer ?? "")
    // Parentheticals are optional context: "(Joseph) Stalin" → "Stalin"
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = value.split(" ");
  while (tokens.length > 1 && ARTICLES.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

/**
 * Category-title patterns that mark a WORDPLAY mechanic rather than a
 * knowledge domain. Deliberately conservative: false negatives are fine
 * (the clue just keeps its category's subject), false positives would
 * wrongly strip subjects from topical categories.
 */
const WORDPLAY_TITLE_PATTERNS = [
  /"[^"]{1,4}"/, // quoted letter fragments: STARTS WITH "J", "B" MOVIES
  /\bSTARTS? WITH\b/,
  /\bENDS? (WITH|IN)\b/,
  /\bBEFORE & AFTER\b/,
  /\bBEFORE AND AFTER\b/,
  /\bRHYME\b|\bRHYMES\b|\bRHYME TIME\b/,
  /\bANAGRAM/,
  /\bSCRAMBLED\b|\bJUMBLE\b/,
  /\bHOMOPHONE/,
  /\bCROSSWORD CLUE/,
  /\bCOMMON BONDS?\b/,
  /\bADD A LETTER\b|\bDROP A LETTER\b|\bCHANGE A LETTER\b/,
  /\bSPELL(ING)? (IT|BEE)\b/,
  /\bIN OTHER WORDS\b/,
  /\bALPHABET\b/,
  /_{2,}/, // blanks in the title itself
];

const MEDIA_PROMPT_PATTERNS = [
  /seen here/i,
  /heard here/i,
  /shown here/i,
  /pictured/i,
  /this clip/i,
  /audio clue/i,
  /video clue/i,
  /\[/,
];

/**
 * Clue format along the mechanic axis: how the clue works, independent of
 * what knowledge it tests. Precedence: media > wordplay > fill-in > standard.
 */
export function detectFormat(categoryTitle, prompt) {
  if (MEDIA_PROMPT_PATTERNS.some((re) => re.test(prompt))) return "media";
  const title = String(categoryTitle ?? "").toUpperCase();
  if (WORDPLAY_TITLE_PATTERNS.some((re) => re.test(title))) return "wordplay";
  if (/_{2,}/.test(prompt)) return "fill-in";
  return "standard";
}
