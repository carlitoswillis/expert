import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as pdfjs from 'pdfjs-dist';
import { getSource, sourceFileUrl } from '../api.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Remember how the user left each document turned — old scans arrive sideways,
// and nobody wants to fix that again on every visit.
const rotationKey = (id) => `expert:rotation:${id}`;

function PdfPage({ doc, num, rotation, width }) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  // Only rasterize pages near the viewport; a 200-page scan would otherwise
  // render everything up front. The first spread is eager so there's no blank
  // flash on open.
  const [near, setNear] = useState(num <= 2);
  // Natural page size at scale 1 (already rotated) — sizes the placeholder so
  // the scrollbar doesn't jump as pages render in.
  const [size, setSize] = useState(null);

  useEffect(() => {
    let gone = false;
    doc.getPage(num).then((page) => {
      if (gone) return;
      const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
      setSize({ w: vp.width, h: vp.height });
    });
    return () => { gone = true; };
  }, [doc, num, rotation]);

  useEffect(() => {
    const el = holderRef.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setNear(true); },
      { rootMargin: '900px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || !width) return undefined;
    let task = null;
    let gone = false;
    doc.getPage(num).then((page) => {
      const canvas = canvasRef.current;
      if (gone || !canvas) return;
      const rot = (page.rotate + rotation) % 360;
      const base = page.getViewport({ scale: 1, rotation: rot });
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (width / base.width) * dpr, rotation: rot });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      // A render cancelled by re-rotation/resize rejects; that's expected.
      task.promise.catch(() => {});
    });
    return () => { gone = true; if (task) task.cancel(); };
  }, [doc, num, rotation, width, near]);

  const height = size && width ? (width * size.h) / size.w : undefined;
  return (
    <div className="page" ref={holderRef} style={{ width, height }}>
      {near && <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />}
    </div>
  );
}

export default function ReaderPage() {
  const { id } = useParams();
  const [source, setSource] = useState(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [rotation, setRotation] = useState(() => Number(localStorage.getItem(rotationKey(id))) || 0);
  const [width, setWidth] = useState(0);
  const pagesRef = useRef(null);

  useEffect(() => {
    getSource(id).then(setSource).catch(() => {});
  }, [id]);

  useEffect(() => {
    let gone = false;
    const task = pdfjs.getDocument(sourceFileUrl(id));
    task.promise
      .then((d) => { if (!gone) setDoc(d); })
      .catch((e) => {
        if (gone) return;
        setError(/404|UnexpectedResponse|Missing PDF/i.test(`${e.name} ${e.message}`)
          ? 'No file is stored for this source.'
          : e.message);
      });
    return () => { gone = true; task.destroy(); };
  }, [id]);

  // Fit pages to the column, re-measured on resize.
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rotate = (delta) => {
    const next = (((rotation + delta) % 360) + 360) % 360;
    setRotation(next);
    try { localStorage.setItem(rotationKey(id), String(next)); } catch { /* private mode */ }
  };

  const title = source
    ? (source.title || source.fileName || 'Untitled').replace(/\.pdf$/i, '')
    : '';

  return (
    <div className="reader">
      <div className="reader-bar">
        <Link to="/library" className="reader-back">← Library</Link>
        <h1 className="reader-title" title={title}>{title}</h1>
        <div className="reader-tools">
          {doc && <span className="reader-pagecount">{doc.numPages} pp.</span>}
          <button type="button" className="ghost turn" onClick={() => rotate(-90)} aria-label="Rotate counter-clockwise" title="Rotate left">⟲</button>
          <button type="button" className="ghost turn" onClick={() => rotate(90)} aria-label="Rotate clockwise" title="Rotate right">⟳</button>
          <a className="ghost" href={sourceFileUrl(id)} target="_blank" rel="noreferrer">file ↗</a>
        </div>
      </div>
      {error && <p className="status error">Error: {error}</p>}
      {!error && !doc && <p className="status">Opening…</p>}
      <div className="reader-pages" ref={pagesRef}>
        {doc && width > 0 && Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i + 1} doc={doc} num={i + 1} rotation={rotation} width={width} />
        ))}
      </div>
    </div>
  );
}
