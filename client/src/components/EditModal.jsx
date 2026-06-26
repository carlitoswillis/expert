import { useState } from 'react';

const FIELDS = [
  ['title', 'Title'],
  ['authors', 'Author(s)'],
  ['published', 'Year published'],
  ['url', 'URL'],
];

export default function EditModal({ source, onClose, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(
    FIELDS.map(([key]) => [key, source[key] || '']),
  ));
  const [saving, setSaving] = useState(false);

  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Edit source</h3>
        <form onSubmit={submit}>
          {FIELDS.map(([key, label]) => (
            <label key={key}>
              {label}
              <input value={form[key]} onChange={change(key)} />
            </label>
          ))}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
