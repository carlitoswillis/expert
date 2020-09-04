import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import React from 'react';

import Nav from './nav';
import Search from './search';
import Libary from './library';
import Add from './add';

const App = () => (
  <>
    <Router>
      <div className="homeDiv">
        <div className="intro">
          <div className="menuSplit">
            <h1 className="title">
              <a href="/">
                expert app
              </a>
            </h1>
            <Nav />
          </div>
        </div>
        <Switch>
          <Route path="/search" component={Search} />
          <Route path="/add" component={Add} />
          <Route path="/library" component={Libary} />
          <Route path="/" component={Search} />
        </Switch>
      </div>
    </Router>
  </>
);

export default App;
