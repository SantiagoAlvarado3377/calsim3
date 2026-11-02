import { formatMonth } from './formatMonth.js';
import { PAGE_SIZES } from './searchVariables.js';

// With a water year type chosen, the date column counts the years of that type instead.
function dateColumn(variable, waterYearType, years) {
  if (!waterYearType) return `${formatMonth(variable.startMonth)} – ${formatMonth(variable.endMonth)}`;
  return `${years.length} ${waterYearType} water ${years.length === 1 ? 'year' : 'years'}`;
}

function VariableResults({ variables, waterYearType, yearsById, onViewChart }) {
  return (
    <div className="variable-search-table-scroll" role="region" aria-label="Variable results table" tabIndex={0}>
      <table>
        <caption>Variable search results</caption>
        <thead>
          <tr>
            <th scope="col">Identifier</th>
            <th scope="col">Location</th>
            <th scope="col">Component Type</th>
            <th scope="col">Units</th>
            <th scope="col">Interval</th>
            <th scope="col">Date range</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {variables.map(variable => (
            <tr key={variable.id}>
              <th scope="row">
                <span className="variable-search-identifier">{variable.identifier}</span>
                <span className="variable-search-run-name">{variable.runName}</span>
              </th>
              <td>{variable.location || '—'}</td>
              <td>{variable.componentType}</td>
              <td>{variable.units || '—'}</td>
              <td>{variable.interval}</td>
              <td className="variable-search-date-range">
                {dateColumn(variable, waterYearType, yearsById.get(variable.id))}
              </td>
              <td>
                <button
                  type="button"
                  aria-label={`View Chart for ${variable.identifier} in ${variable.runName}`}
                  onClick={event => onViewChart(variable, event.currentTarget)}
                >
                  View Chart
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// SCRUM-161: page through large result sets without rendering every row.
export function ResultsPager({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange }) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="variable-search-pager" aria-label="Results pages">
      <label htmlFor="variable-page-size">Rows per page
        <select id="variable-page-size" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <p>{first.toLocaleString('en-US')}–{last.toLocaleString('en-US')} of {total.toLocaleString('en-US')}</p>
      <div className="variable-search-pager-buttons">
        <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}

export default VariableResults;
