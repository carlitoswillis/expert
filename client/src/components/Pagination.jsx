export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;

  // Show a compact window of page numbers around the current page.
  const window = 2;
  const start = Math.max(0, page - window);
  const end = Math.min(pageCount - 1, page + window);
  const pages = [];
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        ← Prev
      </button>
      {start > 0 && <span className="dots">…</span>}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={p === page ? 'active' : ''}
          onClick={() => onChange(p)}
        >
          {p + 1}
        </button>
      ))}
      {end < pageCount - 1 && <span className="dots">…</span>}
      <button type="button" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
