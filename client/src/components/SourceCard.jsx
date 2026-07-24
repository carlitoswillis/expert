import { useState } from 'react';
import { Link } from 'react-router-dom';
import EditModal from './EditModal.jsx';
import highlight from '../highlight.jsx';

// Best-effort label until every record carries an explicit `type`.
function sourceType(source) {
  if (source.type) return source.type;
  if (source.sourceUrl) return 'web';
  if (/\.pdf$/i.test(source.fileName || '')) return 'pdf';
  return 'source';
}

// A captured page has no filename, so show where it came from instead.
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function SourceCard({ source, query, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const title = (source.title || source.fileName || 'Untitled').replace(/\.pdf$/i, '');
  const link = source.url || source.sourceUrl;
  // A scanned PDF whose text is still being OCR'd: dim it and hold back actions
  // until its content is searchable.
  const processing = source.status === 'processing';
  const failed = source.status === 'failed';

  return (
    <article className={`card${processing ? ' processing' : ''}`} aria-busy={processing || undefined}>
      <div className="card-main">
        <div className="card-type">
          <span className="badge">{sourceType(source)}</span>
          {processing && <span className="badge ocr">reading text…</span>}
          {failed && <span className="badge ocr fail">no text found</span>}
        </div>
        <h3 className="card-title">
          {(() => {
            const text = highlight(title, query);
            // Prefer the in-app reader when the PDF itself is on disk — even
            // mid-OCR, since the pages are viewable before the text is.
            if (source.hasFile) return <Link to={`/read/${source.id}`}>{text}</Link>;
            if (link && !processing) return <a href={link} target="_blank" rel="noreferrer">{text}</a>;
            return text;
          })()}
        </h3>
        <div className="card-meta">
          {source.authors && <span className="authors">{highlight(source.authors, query)}</span>}
          {source.published && <span className="year">{source.published}</span>}
          {source.fileName && <span className="file">{source.fileName}</span>}
          {!source.fileName && source.sourceUrl && <span className="file">{hostOf(source.sourceUrl)}</span>}
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="ghost" onClick={() => setEditing(true)} disabled={processing}>Edit</button>
        <button
          type="button"
          className="ghost danger"
          onClick={() => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`Delete “${title}”?`)) onDelete(source.id);
          }}
        >
          Delete
        </button>
      </div>

      {editing && (
        <EditModal
          source={source}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            await onUpdate(source.id, patch);
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}
