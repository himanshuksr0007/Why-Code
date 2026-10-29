import type { Chat } from "@/lib/chat/store";

/**
 * Fast, typo-tolerant chat search.
 *
 * A chat matches when every word of the query matches the chat's
 * title or its message text, where a "match" accepts:
 *  - an exact substring hit,
 *  - a word-prefix hit,
 *  - a Levenshtein distance within the typo budget (1 wrong letter
 *    for short words, 2 for words of 5+ letters), or
 *  - a subsequence hit (letters in order, e.g. "rtrs" → "retries").
 *
 * Title matches outrank message-content matches, exact beats fuzzy,
 * and newer chats win ties. Per-chat word indexes are cached by
 * `updated_at`, so filtering on each keystroke stays cheap.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsOf(text: string): string[] {
  const normalized = normalize(text);
  return normalized === "" ? [] : normalized.split(" ");
}

/** Typo budget for a query word of this length. */
function allowance(wordLength: number): number {
  if (wordLength <= 3) return 1;
  if (wordLength === 4) return 1;
  return 2;
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const char of haystack) {
    if (char === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

/**
 * Score one query word against a word list. Returns null when the
 * word matches nothing within its typo budget.
 */
function wordScore(queryWord: string, targetWords: readonly string[]): number | null {
  let best: number | null = null;
  const budget = allowance(queryWord.length);
  for (const target of targetWords) {
    if (target === queryWord) return 100;
    if (target.startsWith(queryWord)) {
      best = Math.max(best ?? 0, 80);
      continue;
    }
    if (target.includes(queryWord)) {
      best = Math.max(best ?? 0, 70);
      continue;
    }
    const distance = levenshtein(queryWord, target, budget);
    if (distance <= budget) {
      best = Math.max(best ?? 0, 60 - distance * 12);
      continue;
    }
    if (queryWord.length >= 3 && isSubsequence(queryWord, target)) {
      best = Math.max(best ?? 0, 40);
    }
  }
  return best;
}

interface ChatIndex {
  updatedAt: string;
  titleText: string;
  titleWords: string[];
  contentWords: string[];
}

const indexCache = new Map<string, ChatIndex>();

function indexFor(chat: Chat): ChatIndex {
  const cached = indexCache.get(chat.id);
  if (cached && cached.updatedAt === chat.updated_at) return cached;
  const titleText = normalize(chat.title);
  const contentParts: string[] = [];
  for (const turn of chat.turns) {
    contentParts.push(turn.question);
    if (turn.response) contentParts.push(turn.response.answer);
  }
  const index: ChatIndex = {
    updatedAt: chat.updated_at,
    titleText,
    titleWords: wordsOf(chat.title),
    // Content words are only ever compared word-by-word, so a set of
    // unique words keeps the index small and matching fast.
    contentWords: [...new Set(wordsOf(contentParts.join(" ")))],
  };
  indexCache.set(chat.id, index);
  return index;
}

/**
 * The chats matching `query`, best first. An empty query returns the
 * chats untouched (the panel shows its normal ordering then).
 */
export function searchChats(chats: readonly Chat[], query: string): Chat[] {
  const queryWords = wordsOf(query);
  if (queryWords.length === 0) return [...chats];
  const phrase = normalize(query);

  const scored: { chat: Chat; score: number }[] = [];
  for (const chat of chats) {
    const index = indexFor(chat);
    let score = 0;
    let matched = true;
    for (const queryWord of queryWords) {
      const inTitle = wordScore(queryWord, index.titleWords);
      if (inTitle !== null) {
        score += inTitle * 2;
        continue;
      }
      const inContent = wordScore(queryWord, index.contentWords);
      if (inContent !== null) {
        score += inContent;
        continue;
      }
      matched = false;
      break;
    }
    if (!matched) continue;
    // Whole-phrase hits in the title are the strongest signal of all.
    if (phrase.length >= 3 && index.titleText.includes(phrase)) score += 150;
    scored.push({ chat, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.chat.updated_at.localeCompare(a.chat.updated_at);
  });
  return scored.map((entry) => entry.chat);
}
