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
    if (e.target.className === 'source') {
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

  removeLink(e) {
    e.preventDefault();
    e.stopPropagation();
    const { source } = this.state;
    const { fileName } = source;
    $.ajax({
      url: '/file',
      type: 'DELETE',
      data: { fileName },
      success: () => {
        this.setState({
          loaded: false,
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
        <div>
          {loaded ? (
            <div className="result">
              <a href={source.fileName} rel="noreferrer" target="_blank">
                <h4 className="sourceTitle">
                  {source.title ? source.title.replace('.pdf', '') : source.fileName.replace('.pdf', '')}
                </h4>
              </a>
              <button type="button" className="x" onClick={this.removeLink.bind(this)}>X</button>
            </div>
          ) : (
            <a onClick={this.loadDriveLink.bind(this)} href="#" rel="noreferrer" target="_blank">
              <h4 className="sourceTitle notLoaded">
                {source.title ? source.title.replace('.pdf', '') : source.fileName.replace('.pdf', '')}
              </h4>
            </a>
          )}
          <p className="sourceAuthor">
            {source.authors}
          </p>
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
      </li>
    );
  }
}

export default Source;
