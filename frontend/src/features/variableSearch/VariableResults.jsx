import { formatMonth } from './formatMonth.js';
import { PAGE_SIZES } from './searchVariables.js';

// With a water year type chosen, the date column counts the years of that type instead.
function dateColumn(variable, waterYearType, years) {
  if (!waterYearType) return `${formatMonth(variable.startMonth)} – ${formatMonth(variable.endMonth)}`;
  return `${years.length} ${waterYearType} water ${years.length === 1 ? 'year' : 'years'}`;
}

const columns = [
  { field: 'identifier', label: 'Identifier' },
  { field: 'location', label: 'Location' },
  { field: 'componentType', label: 'Component Type' },
  { field: 'units', label: 'Units' },
  { field: 'interval', label: 'Interval' },
  { field: 'dateRange', label: 'Date range' },
];

function VariableResults({ variables, sort, onSort, waterYearType, yearsById, onViewChart }) {
  return (
    <div className="variable-search-table-scroll" role="region" aria-label="Variable results table" tabIndex={0}>
      <table>
        <caption>
          Variable search results
          {waterYearType && <span className="variable-search-sort-note" id="variable-date-sort-note">Date range sorting uses full date coverage, even when water year counts are shown.</span>}
        </caption>
        <thead>
          <tr>
            {columns.map(({ field, label }) => {
              const active = sort.field === field;
              const nextDirection = active && sort.direction === 'ascending' ? 'descending' : 'ascending';
              return (
                <th key={field} scope="col" aria-sort={active ? sort.direction : undefined}>
                  <button
                    type="button"
                    className="variable-search-sort-button"
                    aria-label={`${label}: sort ${nextDirection}`}
                    aria-describedby={field === 'dateRange' && waterYearType ? 'variable-date-sort-note' : undefined}
                    onClick={() => onSort(field)}
                  >
                    {label}
                    <span className="variable-search-sort-arrow" aria-hidden="true">
                      {active ? (sort.direction === 'ascending' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
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
