export function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const lastParagraph = trimmed.split("\n").filter(l => l.trim().length > 0).pop() ?? "";
  if (/\?\s*$/.test(lastParagraph)) return true;
  return false;
}

export function extractSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const trimmed = text.trim();

  const allLines = trimmed.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const lastLine = allLines[allLines.length - 1] ?? "";

  const orMatch = lastLine.match(/(.+?)\s*\?\s*$/);
  if (orMatch) {
    const beforeQuestion = orMatch[1];
    const orSplit = beforeQuestion.split(/\s+or\s+/i);
    if (orSplit.length >= 2) {
      const lastPart = orSplit[orSplit.length - 1].trim();
      const beforeOr = orSplit[orSplit.length - 2];
      const commaParts = beforeOr.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0);
      const items = commaParts.length >= 2
        ? [...commaParts.map(p => p.split(/\s+/).pop()!), lastPart]
        : [commaParts[0]?.split(/\s+/).pop()!, lastPart].filter(Boolean);
      for (const part of items) {
        const cleaned = part.replace(/^["']|["']$/g, "").trim();
        if (cleaned.length > 0 && cleaned.length <= 60) {
          suggestions.push(cleaned);
        }
      }
    }
  }

  if (suggestions.length === 0) {
    const numbered = trimmed.match(/(\d+\.\s+[^\n]+)/g);
    if (numbered && numbered.length >= 2) {
      for (const line of numbered) {
        const cleaned = line.replace(/^\d+\.\s+/, "").trim();
        if (cleaned.length > 0) suggestions.push(cleaned);
      }
    }
  }

  if (suggestions.length === 0 && /\b(should i|do you want|would you|can i|shall i)\b/i.test(lastLine)) {
    suggestions.push("Yes", "No");
  }

  suggestions.push("Write your own answer");
  return [...new Set(suggestions)];
}
