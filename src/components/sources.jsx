/* eslint-disable react/prop-types */
import React from 'react';
import Source from './source';

const Sources = ({ sources, removeSource, updateSource }) => (
  <>
    {sources.map((source) => (
      <Source
        key={source.id}
        removeSource={removeSource}
        updateSource={updateSource}
        source={source}
      />
    ))}
  </>
);

export default Sources;
