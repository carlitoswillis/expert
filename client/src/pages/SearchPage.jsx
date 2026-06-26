import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchSources, updateSource, deleteSource } from '../api.js';
import SourceCard from '../components/SourceCard.jsx';
import Pagination from '../components/Pagination.jsx';
import highlight from '../highlight.jsx';

const PER_PAGE = 10;

// `library` mode shows everything (empty query) and lands directly on results.
export default function SearchPage({ library = false }) {
  const [params, setParams] = useSearchParams();
  const queryParam = params.get('q') || '';
  const pageParam = Number(params.get('page')) || 0;

  const [input, setInput] = useState(queryParam);
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasResults = library || params.has('q') || params.has('page');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    searchSources({ q: queryParam, page: pageParam, limit: PER_PAGE })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [queryParam, pageParam]);

  useEffect(() => {
    if (hasResults) load();
  }, [hasResults, load]);

  useEffect(() => { setInput(queryParam); }, [queryParam]);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (input.trim()) next.q = input.trim();
    setParams(next);
  };

  const goToPage = (page) => {
    const next = { page };
    if (queryParam) next.q = queryParam;
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
