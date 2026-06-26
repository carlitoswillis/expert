// Wrap occurrences of `term` in `text` with the highlighter <mark> — the app's
// signature treatment, reused for hero keywords and matched search terms.
export default function highlight(text, term) {
  const value = String(text ?? '');
  if (!term) return value;
  const safe = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!safe) return value;
  const parts = value.split(new RegExp(`(${safe})`, 'ig'));
  return parts.map((part, i) => (
    part.toLowerCase() === term.trim().toLowerCase()
      // eslint-disable-next-line react/no-array-index-key
      ? <mark key={i}>{part}</mark>
      : part
  ));
}
