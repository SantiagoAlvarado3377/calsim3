import { createContext } from 'react';

// App owns the selection; each page header reads and updates that same value.
export const ActiveRunContext = createContext({
  runs: [],
  activeRunId: '',
  onActiveRunChange: null,
});
