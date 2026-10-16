const STOPWORDS = new Set(
  `a an and are as at be but by for from has have he her his i if in into is it its
   of on or our she so such than that the their them then there these they this to
   was we were what when which who will with would you your not no can may also been
   being both do does did had how than these those us via within between among`.split(/\s+/)
);

// Light suffix stripper. Swap in a real Porter stemmer later if you want
// to measure the difference in the evaluation.
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}
