/* eslint-disable react/prop-types */
import React from 'react';
import SourceModal from './sourcemodal';

const $ = require('jquery');

class Source extends React.Component {
  constructor(props) {
    super(props);
    const { source } = props;
    const { removeSource, updateSource } = props;
    this.state = { source, shown: false, loaded: false };
  }

  show(e) {
    if (e.target.className.includes('source')) {
      e.preventDefault();
      e.stopPropagation();
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

  loadDriveLink(e) {
    e.preventDefault();
    e.stopPropagation();
    const { source } = this.state;
    const { fileID, fileName } = source;
    $.ajax({
      url: '/file',
      type: 'POST',
      data: { fileName, fileID },
      success: () => {
        this.setState({
          loaded: true,
        });
      },
      error: (xhr, status, err) => {
        console.error(this.props.url, status, err.toString());
      },
    });
  }

  render() {
    const { source, shown, loaded } = this.state;
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
                <a href={source.url} rel="noreferrer" target="_blank">resources</a>
              </p>
            )
            : <></>}
          {loaded
            ? (
              <p>
                <a href={source.fileName} rel="noreferrer" target="_blank">view file</a>
              </p>
            )
            : <button type="button" onClick={this.loadDriveLink.bind(this)}>loadDriveLink</button>}
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
