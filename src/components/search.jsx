import React from 'react';
import ReactPaginate from 'react-paginate';
import Sources from './sources';

const $ = require('jquery');

class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      url: '/sources',
      sources: [],
      page: 0,
      perPage: 10,
    };
  }

  componentDidMount() {
    this.loadDataFromServer();
  }

  loadDataFromServer() {
    window.scrollTo(0, 0);
    const {
      url, page, query, perPage,
    } = this.state;

    $.ajax({
      url: `${url}?page=${page}&limit=${perPage}`.concat(`${query ? `&q=${query}` : ''}`),
      type: 'GET',
      success: (data) => {
        this.setState({
          sources: [...data.results],
          pageCount: Math.ceil(data.count / perPage),
          query: undefined,
        }, () => { document.getElementById('query').value = ''; });
      },
      error: (xhr, status, err) => {
        console.error(this.props.url, status, err.toString());
      },
    });
  }

  handlePageClick(data) {
    const { selected } = data;
    this.setState({ page: selected }, () => {
      this.loadDataFromServer();
    });
  }

  handleSubmit() {
    this.loadDataFromServer();
  }

  handleChange(e) {
    const query = e.target.value;
    this.setState({ query });
  }

  render() {
    const { sources, pageCount } = this.state;
    return (
      <div className="search">
        <div className="sources">
          <input className="query" id="query" onChange={this.handleChange.bind(this)} placeholder="search for something" />
          <button onClick={this.handleSubmit.bind(this)} className="submitButton" type="submit">Search</button>
          <ul className="sourceList">
            <Sources sources={sources} />
          </ul>
        </div>
        <ReactPaginate
          previousLabel="previous"
          nextLabel="next"
          breakLabel="..."
          breakClassName="break-me"
          pageCount={pageCount}
          marginPagesDisplayed={2}
          pageRangeDisplayed={5}
          onPageChange={this.handlePageClick.bind(this)}
          containerClassName="pagination"
          subContainerClassName="pagespagination"
          activeClassName="active"
        />
      </div>
    );
  }
}

export default Search;
