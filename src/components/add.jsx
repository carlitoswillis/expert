import React from 'react';

const axios = require('axios');

class FileInput extends React.Component {
  constructor(props) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    const fileInput = React.createRef();
    this.state = { fileInput };
  }

  handleSubmit(event) {
    event.preventDefault();
    const {
      fileInput, title, authors, url, published,
    } = this.state;
    const formData = new FormData(document.getElementById('fileInfo'));
    if (fileInput.current.files.length > 1) {
      Array.from(fileInput.current.files).forEach(file => {
        formData.append(
          'myFile',
          file,
          file.name,
        );
      });
      formData.append(
        'info',
        {
          title, authors, url, published,
        },
      );
      axios.post('sources', formData);
      // axios.post('sources2', formData);
    } else {
      formData.append(
        'myFile',
        fileInput.current.files[0],
        fileInput.current.files[0].name,
      );
      formData.append(
        'info',
        {
          title, authors, url, published,
        },
      );
      axios.post('sources', formData);
    }
  }

  handleInput(event) {
    const currState = { ...this.state };
    currState[event.target.name] = event.target.value;
    this.setState(currState);
  }

  render() {
    return (
      <form id="fileInfo" onSubmit={this.handleSubmit}>
        <label>
          Upload file
          <input type="file" ref={this.state.fileInput} multiple />
        </label>
        <input onChange={this.state.handleInput} id="title" name="title" type="text" placeholder="title" />
        <input onChange={this.state.handleInput} id="authors" name="authors" type="text" placeholder="author/s" />
        <input onChange={this.state.handleInput} id="url" name="url" type="text" placeholder="url" />
        <input onChange={this.state.handleInput} id="published" name="published" type="text" placeholder="date published" />
        <input onChange={this.state.handleInput} id="course" name="course" type="text" placeholder="course" />
        {/* <br /> */}
        <button type="submit">Upload</button>
      </form>
    );
  }
}

const Add = () => (
  <div>
    <p>Add</p>
    <FileInput />
  </div>
);

export default Add;
