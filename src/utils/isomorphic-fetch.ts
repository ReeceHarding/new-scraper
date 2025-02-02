import nodeFetch from 'node-fetch'

export const isomorphicFetch = (typeof window !== 'undefined' && window.fetch) 
  ? window.fetch.bind(window) 
  : nodeFetch 