/* eslint-disable react/jsx-key */
const React = require('react');

const { useState } = React;

// const axios = require('axios');

const SourceModal = ({ source, unShow, updateSource, removeSource }) => {
  // const [editedInfo, updateInfo] = useState({ id: source.id });
  const keys = ['authors', 'title', 'url', 'fileID', 'driveLink'];
  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedInfo = { ...source };
    keys.forEach((key) => {
      if (document.getElementsByName(source.id + key)[0].value) {
        updatedInfo[key] = document.getElementsByName(source.id + key)[0].value;
      } else {
        delete updatedInfo[key];
      }
    });
    updateSource(updatedInfo);
  };
  return (
    <div>
      <form id="sourceInfo">
        <label>
          Update Info
        </label>
        {keys.map((key) => (<input id={key} key={source.id + key} name={source.id + key} type="text" placeholder={source[key] || key} />))}
        <button onClick={handleSubmit} name="submit" type="submit">Update</button>
      </form>
      <button className="closeButton" onClick={unShow} type="button">Close</button>
      <button className="deleteButton" onClick={() => removeSource(source.id)} type="button">Delete</button>
    </div>
  );
};

export default SourceModal;
