/**
 * "CATEGORY · $800 · 1998" context line for a Jeopardy clue. Any field may
 * be missing (curated decks have none) — absent fields simply drop out.
 */
export function clueMetaLabel(clue: {
  category?: string;
  value?: number;
  round?: number;
  airDate?: string;
}): string {
  const parts: string[] = [];
  if (clue.category) parts.push(clue.category);
  if (clue.round === 3) parts.push("Final Jeopardy!");
  else if (clue.value && clue.value > 0) parts.push(`$${clue.value}`);
  const year = /^(\d{4})/.exec(clue.airDate ?? "")?.[1];
  if (year) parts.push(year);
  return parts.join(" · ");
}
