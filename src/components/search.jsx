import React from 'react';
import ReactPaginate from 'react-paginate';
import Sources from './sources';

const $ = require('jquery');

class Search extends React.Component {
  constructor(props) {
    super(props);
    const searchParams = {};
    const s = new URLSearchParams(window.location.search);
    s.forEach((value, key) => {
      searchParams[key] = value;
    });

    this.state = {
      url: '/sources',
      sources: [],
      page: searchParams.page || 0,
      perPage: searchParams.limit || 10,
      searchParams,
    };
  }

  componentDidMount() {
    this.loadDataFromServer();
  }

  loadDataFromServer() {
    window.scrollTo(0, 0);
    const {
      url, page, query, perPage, searchParams,
    } = this.state;
    const searchString = Object.keys(searchParams).filter((x) => !['page', 'limit'].includes(x))
      .map((key) => `${key}=${searchParams[key]}`).join('&');

    $.ajax({
      url: `${url}?page=${page}&limit=${perPage}`.concat(query ? `&q=${query}` : `&${searchString}`),
      type: 'GET',
      success: (data) => {
        this.setState({
          sources: [...data.results],
          pageCount: Math.ceil(data.count / perPage),
        });
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

  removeSource(id) {
    const {
      url, page, query, perPage,
    } = this.state;
    $.ajax({
      url: `${url}?page=${page}&limit=${perPage}`.concat(`${query ? `&q=${query}` : ''}`),
      type: 'DELETE',
      data: { id },
      success: (data) => {
        this.setState({
          sources: [...data.results],
        });
      },
      error: (xhr, status, err) => {
        console.error(this.props.url, status, err.toString());
      },
    });
  }

  updateSource(updatedSource) {
    const {
      url, page, query, perPage,
    } = this.state;
    $.ajax({
      url: `${url}?page=${page}&limit=${perPage}`.concat(`${query ? `&q=${query}` : ''}`),
      type: 'PUT',
      data: updatedSource,
      success: (data) => {
        this.setState({
          sources: [...data.results],
        });
      },
      error: (xhr, status, err) => {
        console.error(err.toString());
      },
    });
  }

  render() {
    const {
      sources, pageCount, query, searchParams,
    } = this.state;
    return (
      <div className="search">
        <div className="sources">
          {window.location.href !== 'http://localhost:3000/library'
            ? (
              <>
                <input className="query" id="query" onChange={this.handleChange.bind(this)} placeholder="search for something" />
                <a
                  href={`${window.location.origin}/search${query ? `?q=${query}` : ''}`}
                >
                  <button
              // onClick={this.handleSubmit.bind(this)}
                    className="submitButton"
                    type="submit"
                  >
                    Search
                  </button>
                </a>
              </>
            )
            : <></>}
          {window.location.href === 'http://localhost:3000/library' || Object.keys(searchParams).length
            ? (
              <>
                <ul className="sourceList">
                  <Sources
                    sources={[...sources]}
                    removeSource={this.removeSource.bind(this)}
                    updateSource={this.updateSource.bind(this)}
                  />
                </ul>
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
              </>
            )
            : (<></>)}
        </div>
      </div>
    );
  }
}

export default Search;
