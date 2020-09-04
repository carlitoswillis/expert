/* eslint-disable react/jsx-key */
const React = require('react');

const { useState } = React;

// const axios = require('axios');

const SourceModal = ({ source, unShow }) => {
  const [editedInfo, updateInfo] = useState(source);
  const handleSubmit = () => {
    axios.put('/source', editedInfo);
  };
  const keys = ['authors', 'title', 'content', 'created', 'url', 'fileID', 'driveLink', 'fileName'];
  const handleInput = (e) => {
  //   updateInfo((oldInfo) => {
  //     const updatedInfo = { ...oldInfo };
  //     updatedInfo[e.target.name] = e.target.value;
  //     return updatedInfo;
  //   });
  };
  return (
    <div>
      <form id="sourceInfo" onSubmit={handleSubmit}>
        <label>
          Update Info
        </label>
        {keys.map((key) => (<input onChange={handleInput} key={key} id={key} name={key} type="text" placeholder={editedInfo[key] || key} />))}
        <button type="submit">Update</button>
      </form>
      <button className="closeButton" onClick={unShow} type="button">Close</button>
    </div>
  );
};

export default SourceModal;
