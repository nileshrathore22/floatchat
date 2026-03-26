const POSITIVE = ["good", "great", "awesome", "love", "nice", "amazing", "happy", "excellent"];
const NEGATIVE = ["bad", "worst", "hate", "angry", "sad", "poor", "terrible", "problem", "issue"];

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function analyzeText(text: string) {
  const tokens = tokenize(text);

  // Sentiment (simple lexicon)
  let score = 0;
  for (const t of tokens) {
    if (POSITIVE.includes(t)) score++;
    if (NEGATIVE.includes(t)) score--;
  }
  const sentiment = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";

  // Intent (simple rules)
  const hasQuestion = text.includes("?") || ["what", "why", "how", "when", "where"].some(w => tokens.includes(w));
  const intent =
    tokens.includes("hello") || tokens.includes("hi") ? "greeting" :
    hasQuestion ? "question" :
    tokens.includes("help") || tokens.includes("support") ? "support" :
    tokens.includes("complaint") || tokens.includes("problem") || tokens.includes("issue") ? "complaint" :
    "other";

  // Keywords (top unique tokens excluding stopwords)
  const stop = new Set([
    "i","me","my","we","you","your","he","she","they","is","am","are","was","were",
    "a","an","the","to","of","in","on","for","and","or","sbut","with","at","from",
    "this","that","it","as","be","by","do","does","did","not","so","if"
  ]);

  const freq: Record<string, number> = {};
  for (const t of tokens) {
    if (stop.has(t) || t.length <= 2) continue;
    freq[t] = (freq[t] ?? 0) + 1;
  }

  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k)
    .join(", ");

  return { sentiment, intent, keywords };
}
