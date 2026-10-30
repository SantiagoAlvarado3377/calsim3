import { useContext, useId } from 'react';
import { ActiveRunContext } from './ActiveRunContext.js';
import './PageHeader.css';

function PageHeader({ title, id }) {
  const { runs, activeRunId, onActiveRunChange } = useContext(ActiveRunContext);
  const selectId = useId();

  return (
    <header className="page-header">
      <h1 id={id} title={title}>{title}</h1>
      <label className="page-header-active-run" htmlFor={selectId}>
        <span>Active run:</span>
        <select
          id={selectId}
          value={activeRunId}
          title={runs.find(run => run.id === activeRunId)?.name ?? 'No imported runs'}
          disabled={runs.length === 0}
          onChange={event => onActiveRunChange(event.target.value)}
        >
          {runs.length === 0
            ? <option value="">No imported runs</option>
            : runs.map(run => <option key={run.id} value={run.id}>{run.name}</option>)}
        </select>
      </label>
    </header>
  );
}

export default PageHeader;
