/* eslint-disable react/prop-types */
import React from 'react';
import Source from './source';

const Sources = ({ sources }) => (
  <>
    {sources.map((source) => (
      <Source key={source.id} source={source} />
    ))}
  </>
);

export default Sources;
