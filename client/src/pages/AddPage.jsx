import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadSources, captureUrl, captureText } from '../api.js';

// Three ways in — a file, a link, or text you paste. Each writes the same kind
// of record, so the library doesn't care which door a source came through.
const TABS = [
  { key: 'file', label: 'File', blurb: 'PDFs, or web pages you saved to disk. Text is extracted automatically; scanned pages are read with OCR in the background.' },
  { key: 'link', label: 'Link', blurb: 'An article or web page. We fetch it and keep the readable text, not the clutter.' },
  { key: 'paste', label: 'Paste', blurb: 'A note, a quote, a passage — anything you want to be able to find again.' },
];

export default function AddPage() {
  const [tab, setTab] = useState('file');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const fileRef = useRef(null);
  const [meta, setMeta] = useState({ title: '', authors: '', url: '', published: '', course: '' });
  const [link, setLink] = useState('');
  const [note, setNote] = useState({ title: '', authors: '', url: '', text: '' });

  const changeMeta = (key) => (e) => setMeta({ ...meta, [key]: e.target.value });
  const changeNote = (key) => (e) => setNote({ ...note, [key]: e.target.value });

  const switchTab = (key) => { setTab(key); setStatus(null); };

  // Every submit path shares the same busy/status handling.
  const run = async (work) => {
    setBusy(true);
    try {
      setStatus({ type: 'ok', text: await work() });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submitFile = (e) => {
    e.preventDefault();
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setStatus({ type: 'error', text: 'Choose at least one file.' });
      return;
    }
    setStatus({ type: 'info', text: 'Uploading and extracting text…' });
    run(async () => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('myFile', file, file.name));
      Object.entries(meta).forEach(([k, v]) => v && formData.append(k, v));
      const res = await uploadSources(formData);
      if (fileRef.current) fileRef.current.value = '';
      setMeta({ title: '', authors: '', url: '', published: '', course: '' });
      const note2 = res.processing
        ? ` ${res.processing} still being read in the background — they'll become searchable shortly.`
        : '';
      return `Added ${res.count} source${res.count === 1 ? '' : 's'}.${note2}`;
    });
  };

  const submitLink = (e) => {
    e.preventDefault();
    if (!link.trim()) {
      setStatus({ type: 'error', text: 'Paste a link first.' });
      return;
    }
    setStatus({ type: 'info', text: 'Fetching and reading the page…' });
    run(async () => {
      const res = await captureUrl(link.trim());
      setLink('');
      return `Captured “${res.record.title}”.`;
    });
  };

  const submitNote = (e) => {
    e.preventDefault();
    setStatus({ type: 'info', text: 'Saving…' });
    run(async () => {
      const res = await captureText(note);
      setNote({ title: '', authors: '', url: '', text: '' });
      return `Saved “${res.record.title}”.`;
    });
  };

  const active = TABS.find((t) => t.key === tab);

  return (
    <div className="upload">
      <p className="eyebrow">grow your library</p>
      <h1>Add a source</h1>

      <div className="tabs" role="tablist" aria-label="How to add a source">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="tagline">{active.blurb}</p>

      {tab === 'file' && (
        <form onSubmit={submitFile} className="upload-form">
          <label className="file">
            <input ref={fileRef} type="file" accept="application/pdf,.pdf,text/html,.html,.htm" multiple />
          </label>
          <div className="grid">
            <label>Title<input value={meta.title} onChange={changeMeta('title')} placeholder="(defaults to filename)" /></label>
            <label>Author(s)<input value={meta.authors} onChange={changeMeta('authors')} /></label>
            <label>Year published<input value={meta.published} onChange={changeMeta('published')} /></label>
            <label>URL<input value={meta.url} onChange={changeMeta('url')} /></label>
            <label>Course / collection<input value={meta.course} onChange={changeMeta('course')} /></label>
          </div>
          <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
        </form>
      )}

      {tab === 'link' && (
        <form onSubmit={submitLink} className="upload-form">
          <label>
            Article URL
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Reading…' : 'Capture'}</button>
        </form>
      )}

      {tab === 'paste' && (
        <form onSubmit={submitNote} className="upload-form">
          <label className="text">
            Text
            <textarea
              value={note.text}
              onChange={changeNote('text')}
              rows={12}
              placeholder="Paste or write anything…"
            />
          </label>
          <div className="grid">
            <label>Title<input value={note.title} onChange={changeNote('title')} placeholder="(defaults to the opening words)" /></label>
            <label>Author(s)<input value={note.authors} onChange={changeNote('authors')} /></label>
            <label>Source URL<input value={note.url} onChange={changeNote('url')} /></label>
          </div>
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
        </form>
      )}

      {status && (
        <p className={`status ${status.type}`}>
          {status.text}
          {status.type === 'ok' && <> <Link to="/library">See it in your library →</Link></>}
        </p>
      )}
    </div>
  );
}
