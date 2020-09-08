import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import React from 'react';

import Nav from './nav';
import Search from './search';
import Add from './add';

const App = () => (
  <>
    <Router>
      <Nav />
      <div className="home">
        <Switch>
          <Route path="/search" component={Search} />
          <Route path="/upload" component={Add} />
          <Route path="/library" component={Search} />
          <Route path="/" component={Search} />
        </Switch>
      </div>
    </Router>
  </>
);

export default App;
