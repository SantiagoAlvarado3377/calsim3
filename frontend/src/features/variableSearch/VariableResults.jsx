import { formatMonth } from './formatMonth.js';

function VariableResults({ variables }) {
  return (
    <div className="variable-search-table-scroll" role="region" aria-label="Variable results table" tabIndex={0}>
      <table>
        <caption>Variable search results</caption>
        <thead>
          <tr>
            <th scope="col">Identifier</th>
            <th scope="col">Location</th>
            <th scope="col">Category</th>
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
              <td>{variable.location}</td>
              <td>{variable.category}</td>
              <td>{variable.units}</td>
              <td>{variable.interval}</td>
              <td className="variable-search-date-range">{formatMonth(variable.startMonth)} – {formatMonth(variable.endMonth)}</td>
              <td>
                <button type="button" aria-label={`View Chart for ${variable.identifier} in ${variable.runName}`} disabled>
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

export default VariableResults;
