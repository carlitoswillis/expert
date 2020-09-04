import React from 'react';
import { Link } from 'react-router-dom';

const Nav = () => (
  <nav>
    <div className="navDiv">
      <ul className="nav-link">
        <Link to="/search">
          <li>
            Search
          </li>
        </Link>
        <Link to="/library">
          <li>
            Library
          </li>
        </Link>
        <Link to="/add">
          <li>
            Add Sources
          </li>
        </Link>
      </ul>
    </div>
  </nav>
);

export default Nav;
