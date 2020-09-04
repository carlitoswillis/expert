/* eslint-disable react/prop-types */
import React from 'react';
import SourceModal from './sourcemodal';

class Source extends React.Component {
  constructor(props) {
    super(props);
    const { source } = props;
    this.state = { source, shown: false };
  }

  show(e) {
    if (e.target.className.includes('source')) {
      this.setState({ shown: true });
    }
  }

  unShow() {
    this.setState({ shown: false });
  }

  render() {
    const { source, shown } = this.state;
    return (
      <li onClick={this.show.bind(this)} className="source" key={source.id}>
        <div>
          <h2 className="sourceTitle">
            {source.title || source.fileName}
          </h2>
          <h3 className="sourceAuthor">
            {source.authors}
          </h3>
          {source.published
            ? (
              <p className="sourceAuthor">
                (
                {source.published}
                )
              </p>
            )
            : <></>}
          {Object.keys(source).filter((z) => !['url', 'published', 'created', 'content', 'title', 'authors', 'id', 'fileID', 'fileName'].includes(z)).map((y) => (<p key={y}>{source[y]}</p>))}
          {source.url
            ? (
              <p>
                <a href={source.url} rel="noreferrer" target="_blank">link</a>
              </p>
            )
            : <></>}
          {shown
            ? <SourceModal source={source} unShow={this.unShow.bind(this)} />
            : <></>}
        </div>
      </li>
    );
  }
}

export default Source;
