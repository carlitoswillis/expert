import { Routes, Route, NavLink, Link } from 'react-router-dom';
import SearchPage from './pages/SearchPage.jsx';
import UploadPage from './pages/UploadPage.jsx';

function Nav() {
  return (
    <header className="topbar">
      <Link to="/" className="brand">expert<span className="dot">.</span></Link>
      <nav>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : '')}>Search</NavLink>
        <NavLink to="/library" className={({ isActive }) => (isActive ? 'active' : '')}>Library</NavLink>
        <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>Add</NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="app">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<SearchPage library />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<SearchPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>expert · find &amp; combine ideas from everything you read</span>
      </footer>
    </div>
  );
}
