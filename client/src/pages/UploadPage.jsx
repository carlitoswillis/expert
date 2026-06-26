import { useRef, useState } from 'react';
import { uploadSources } from '../api.js';

export default function UploadPage() {
  const fileRef = useRef(null);
  const [meta, setMeta] = useState({ title: '', authors: '', url: '', published: '', course: '' });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (key) => (e) => setMeta({ ...meta, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setStatus({ type: 'error', text: 'Choose at least one PDF.' });
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('myFile', file, file.name));
    Object.entries(meta).forEach(([k, v]) => v && formData.append(k, v));

    setBusy(true);
    setStatus({ type: 'info', text: 'Uploading and extracting text…' });
    try {
      const res = await uploadSources(formData);
      setStatus({ type: 'ok', text: `Added ${res.count} source(s).` });
      if (fileRef.current) fileRef.current.value = '';
      setMeta({ title: '', authors: '', url: '', published: '', course: '' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload">
      <p className="eyebrow">grow your library</p>
      <h1>Add a source</h1>
      <p className="tagline">
        Drop in one or more PDFs — text is extracted automatically so it becomes
        searchable. Metadata is optional; for a single file it overrides the
        defaults. (Web links, transcripts, notes &amp; more are on the way.)
      </p>
      <form onSubmit={submit} className="upload-form">
        <label className="file">
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple />
        </label>
        <div className="grid">
          <label>Title<input value={meta.title} onChange={change('title')} placeholder="(defaults to filename)" /></label>
          <label>Author(s)<input value={meta.authors} onChange={change('authors')} /></label>
          <label>Year published<input value={meta.published} onChange={change('published')} /></label>
          <label>URL<input value={meta.url} onChange={change('url')} /></label>
          <label>Course / collection<input value={meta.course} onChange={change('course')} /></label>
        </div>
        <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
      </form>
      {status && <p className={`status ${status.type}`}>{status.text}</p>}
    </div>
  );
}
