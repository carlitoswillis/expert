import { useState } from 'react';
import EditModal from './EditModal.jsx';

export default function SourceCard({ source, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const title = (source.title || source.fileName || 'Untitled').replace(/\.pdf$/i, '');

  return (
    <article className="card">
      <div className="card-main">
        <h3 className="card-title">
          {source.url
            ? <a href={source.url} target="_blank" rel="noreferrer">{title}</a>
            : title}
        </h3>
        <div className="card-meta">
          {source.authors && <span className="authors">{source.authors}</span>}
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
