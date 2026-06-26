import { useState } from 'react';
import EditModal from './EditModal.jsx';
import highlight from '../highlight.jsx';

// Best-effort label until every record carries an explicit `type`.
function sourceType(source) {
  if (source.type) return source.type;
  if (source.sourceUrl) return 'web';
  if (/\.pdf$/i.test(source.fileName || '')) return 'pdf';
  return 'source';
}

export default function SourceCard({ source, query, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const title = (source.title || source.fileName || 'Untitled').replace(/\.pdf$/i, '');
  const link = source.url || source.sourceUrl;

  return (
    <article className="card">
      <div className="card-main">
        <div className="card-type"><span className="badge">{sourceType(source)}</span></div>
        <h3 className="card-title">
          {link
            ? <a href={link} target="_blank" rel="noreferrer">{highlight(title, query)}</a>
            : highlight(title, query)}
        </h3>
        <div className="card-meta">
          {source.authors && <span className="authors">{highlight(source.authors, query)}</span>}
          {source.published && <span className="year">{source.published}</span>}
          {source.fileName && <span className="file">{source.fileName}</span>}
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="ghost" onClick={() => setEditing(true)}>Edit</button>
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
