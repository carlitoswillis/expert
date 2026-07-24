import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchSources, updateSource, deleteSource } from '../api.js';
import SourceCard from '../components/SourceCard.jsx';
import Pagination from '../components/Pagination.jsx';
import highlight from '../highlight.jsx';

const PER_PAGE = 10;

// Narrow the library by how a source was captured. Kept short on purpose —
// these are buckets, not a taxonomy.
const TYPES = [
  { key: '', label: 'Everything' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'web', label: 'Web' },
  { key: 'note', label: 'Notes' },
];

// `library` mode shows everything (empty query) and lands directly on results.
export default function SearchPage({ library = false }) {
  const [params, setParams] = useSearchParams();
  const queryParam = params.get('q') || '';
  const pageParam = Number(params.get('page')) || 0;
  const typeParam = params.get('type') || '';

  const [input, setInput] = useState(queryParam);
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasResults = library || params.has('q') || params.has('page') || params.has('type');

  // `quiet` refreshes in place without flashing the "Searching…" state — used
  // by the background poll below so cards update without the list blinking.
  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    return searchSources({
      q: queryParam, page: pageParam, limit: PER_PAGE, type: typeParam,
    })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => { if (!quiet) setLoading(false); });
  }, [queryParam, pageParam, typeParam]);

  useEffect(() => {
    if (hasResults) load();
  }, [hasResults, load]);

  // While any source is still being OCR'd, poll so it "lights up" when ready.
  useEffect(() => {
    if (!data.results.some((s) => s.status === 'processing')) return undefined;
    const timer = setInterval(() => load(true), 3000);
    return () => clearInterval(timer);
  }, [data, load]);

  useEffect(() => { setInput(queryParam); }, [queryParam]);

  // A new query or filter resets paging; everything else is carried along.
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (input.trim()) next.q = input.trim();
    if (typeParam) next.type = typeParam;
    setParams(next);
  };

  const goToPage = (page) => {
    const next = { page };
    if (queryParam) next.q = queryParam;
    if (typeParam) next.type = typeParam;
    setParams(next);
  };

  const filterByType = (type) => {
    const next = {};
    if (queryParam) next.q = queryParam;
    if (type) next.type = type;
    setParams(next);
  };

  const handleUpdate = async (id, patch) => {
    await updateSource(id, patch);
    load();
  };

  const handleDelete = async (id) => {
    await deleteSource(id);
    load();
  };

  const pageCount = Math.ceil(data.count / PER_PAGE);

  return (
    <div className={`search ${hasResults ? 'has-results' : 'landing'}`}>
      {!hasResults && (
        <div className="hero">
          <p className="eyebrow">your library, read closely</p>
          <h1>What do you want to <mark>understand</mark>?</h1>
          <p className="tagline">
            Search the full text of everything you&rsquo;ve read — built to
            narrow, not to flood.
          </p>
        </div>
      )}

      {!library && (
        <form className="searchbar" onSubmit={submit}>
          <input
            autoFocus={!hasResults}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search titles, authors, and full text…"
            aria-label="Search"
          />
          <button type="submit" aria-label="Search">Search</button>
        </form>
      )}

      {hasResults && (
        <div className="results">
          <div className="filters" role="group" aria-label="Filter by source type">
            {TYPES.map((t) => (
              <button
                key={t.key || 'all'}
                type="button"
                className={`chip${typeParam === t.key ? ' active' : ''}`}
                aria-pressed={typeParam === t.key}
                onClick={() => filterByType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {loading && <p className="status">Searching…</p>}
          {error && <p className="status error">Error: {error}</p>}
          {!loading && !error && (
            <>
              <p className="count">
                {data.count} {data.count === 1 ? 'result' : 'results'}
                {queryParam && <> for “{queryParam}”</>}
              </p>
              {data.results.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  query={queryParam}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
              {data.count === 0 && (
                <p className="status">
                  Nothing matches yet. Try a broader term, or add a source.
                </p>
              )}
              <Pagination page={pageParam} pageCount={pageCount} onChange={goToPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
