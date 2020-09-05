/* eslint-disable react/prop-types */
import React from 'react';
import SourceModal from './sourcemodal';

const $ = require('jquery');

class Source extends React.Component {
  constructor(props) {
    super(props);
    const { source } = props;
    const { removeSource, updateSource } = props;
    this.state = { source, shown: false };
  }

  show(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.className.includes('source')) {
      this.setState({ shown: true });
    }
  }

  unShow(e) {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ shown: false });
  }

  showNewSourceData(updatedSource) {
    const { source } = this.state;
    this.setState({ source: { ...source, ...updatedSource }, shown: false });
  }

  render() {
    const { source, shown } = this.state;
    const { updateSource, removeSource } = this.props;
    return (
      <li onClick={this.show.bind(this)} className="source" key={source.id}>
        <br></br>
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
            ? (
              <SourceModal
                key={source.id}
                source={source}
                removeSource={removeSource}
                unShow={this.unShow.bind(this)}
                updateSource={(x) => { updateSource(x); this.showNewSourceData(x); }}
              />
            )
            : <></>}
        </div>
        _____________________________________________
      </li>
    );
  }
}

export default Source;
