import { useContext, useEffect, useRef, useState } from 'react';
import { ActiveRunContext } from '../components/ActiveRunContext.js';
import PageHeader from '../components/PageHeader.jsx';
import { logSearchError, VariableSearchError } from '../features/variableSearch/loadDssVariables.js';
import {
  matchingWaterYears, PAGE_SIZES, paginate, searchVariables, WATER_YEAR_TYPES,
} from '../features/variableSearch/searchVariables.js';
import { useVariableCatalog } from '../features/variableSearch/useVariableCatalog.js';
import { EmptyState, ErrorState, LoadingState, NoImportState } from '../features/variableSearch/SearchStates.jsx';
import VariableResults, { ResultsPager } from '../features/variableSearch/VariableResults.jsx';
import VariableDetails from '../features/variableSearch/VariableDetails.jsx';
import './VariableSearch.css';

const defaultFilters = { runId: '', componentType: '', nodeCategory: '', units: '', interval: '' };

// SCRUM-160: dropdowns whose options come from the loaded variables, so they always match the file.
const fieldFilters = [
  { field: 'componentType', label: 'Component Type', all: 'All component types' },
  { field: 'nodeCategory', label: 'Node Category', all: 'All node categories' },
  { field: 'units', label: 'Units', all: 'All units' },
  { field: 'interval', label: 'Interval', all: 'All intervals' },
];

function optionsFor(variables, field) {
  return [...new Set(variables.map(variable => variable[field]))].filter(Boolean).sort();
}

// SCRUM-160: the water years of the chosen type for each variable. Variables
// with the same date range share one answer, which keeps large files fast.
function waterYearsById(variables, waterYearTypes, type) {
  const byRange = new Map();
  const byId = new Map();
  if (!type) return byId;

  for (const variable of variables) {
    const range = `${variable.startMonth}|${variable.endMonth}`;
    if (!byRange.has(range)) byRange.set(range, matchingWaterYears(variable, waterYearTypes, type));
    byId.set(variable.id, byRange.get(range));
  }
  return byId;
}

function VariableSearch({ onNavigate }) {
  const { runs, activeRunId, onRunFileChange } = useContext(ActiveRunContext);
  const activeRun = runs.find(run => run.id === activeRunId);
  const [showSample, setShowSample] = useState(false);
  // SCRUM-146 / SCRUM-163: the active run's imported DSS file, or the samples on request.
  const catalog = useVariableCatalog(activeRun, showSample);
  const [keyword, setKeyword] = useState('');
  // Typing does not change the results until the form is submitted.
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [waterYearType, setWaterYearType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedVariable, setSelectedVariable] = useState(null);
  const chartButtonRef = useRef(null);
  const keywordRef = useRef(null);

  useEffect(() => {
    if (!selectedVariable) chartButtonRef.current?.focus();
  }, [selectedVariable]);

  // SCRUM-147 / SCRUM-158 / SCRUM-163: nothing to search until the data is ready.
  if (catalog.status !== 'ready') {
    const openImport = () => onNavigate('import-data');
    return (
      <main className="variable-search-page" aria-labelledby="variable-search-title">
        <PageHeader id="variable-search-title" title="Variable and Location Search" />
        <div className="variable-search-content">
          {catalog.status === 'loading' && <LoadingState fileName={activeRun.file.name} />}
          {catalog.status === 'error' && (
            <ErrorState
              error={catalog.error}
              onRetry={catalog.retry}
              onReimport={file => onRunFileChange(activeRun.id, file)}
            />
          )}
          {catalog.status === 'no-import' && (
            <NoImportState onImport={openImport} onUseSample={() => setShowSample(true)} />
          )}
        </div>
      </main>
    );
  }

  const { data } = catalog;
  // Switching the active run loads new variables; details for the old run's variable close.
  const shownVariable = selectedVariable && data.variables.includes(selectedVariable) ? selectedVariable : null;
  const hasWaterYears = Object.keys(data.waterYearTypes).length > 0;
  let results = [];
  let searchError = null;
  try {
    results = searchVariables(data.variables, submittedKeyword, filters);
  } catch (error) {
    // SCRUM-149: a failed search shows a plain message; the details go to the log.
    logSearchError(error);
    searchError = new VariableSearchError('searchFailed', error);
  }
  const yearsById = waterYearsById(results, data.waterYearTypes, waterYearType);
  if (waterYearType) results = results.filter(variable => yearsById.get(variable.id).length > 0);
  const shown = paginate(results, page, pageSize);

  function openDetails(variable, button) {
    chartButtonRef.current = button;
    setSelectedVariable(variable);
  }

  // Any change to what matches starts again on the first page.
  function updateFilter(name, value) {
    setFilters({ ...filters, [name]: value });
    setPage(1);
  }

  function updateWaterYearType(value) {
    setWaterYearType(value);
    setPage(1);
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setWaterYearType('');
    setPage(1);
  }

  // SCRUM-148 / SCRUM-150: start over from the empty or failed state.
  function resetSearch() {
    setKeyword('');
    setSubmittedKeyword('');
    clearFilters();
    keywordRef.current.focus();
  }

  function handleSearch(event) {
    event.preventDefault();
    setSubmittedKeyword(keyword);
    setPage(1);
  }

  return (
    <main className="variable-search-page" aria-labelledby="variable-search-title">
      <PageHeader id="variable-search-title" title="Variable and Location Search" />

      {shownVariable && (
        <VariableDetails
          variable={shownVariable}
          file={activeRun?.file}
          waterYearType={waterYearType}
          waterYears={yearsById.get(shownVariable.id)}
          onBack={() => setSelectedVariable(null)}
        />
      )}

      {/* Keep the search mounted so returning also preserves the controls and row focus. */}
      <div className="variable-search-content" hidden={Boolean(shownVariable)}>
        <p className="variable-search-subtitle">
          Find CalSim 3 variables by identifier or mapped location.
          {catalog.sample && ' Showing sample data; import a DSS file to search a real run.'}
        </p>

        <section className="variable-search-controls" aria-label="Search and filters">
          <form className="variable-search-form" role="search" aria-label="Variable search" onSubmit={handleSearch}>
            <label htmlFor="variable-keyword">Keyword</label>
            <div className="variable-search-input-row">
              <input
                id="variable-keyword"
                ref={keywordRef}
                type="search"
                placeholder="Search identifier or location, e.g. storage"
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
              />
              <button type="submit" className="variable-search-primary">Search</button>
            </div>
          </form>

          <div className="variable-search-filter-row">
            <label htmlFor="variable-run">Run
              <select id="variable-run" value={filters.runId} onChange={event => updateFilter('runId', event.target.value)}>
                <option value="">All runs</option>
                {data.runs.map(run => <option key={run.id} value={run.id}>{run.name}</option>)}
              </select>
            </label>
            {fieldFilters.map(({ field, label, all }) => (
              <label key={field} htmlFor={`variable-${field}`}>{label}
                <select id={`variable-${field}`} value={filters[field]} onChange={event => updateFilter(field, event.target.value)}>
                  <option value="">{all}</option>
                  {optionsFor(data.variables, field).map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
            <label htmlFor="variable-water-year-type">Water Year Type
              <select
                id="variable-water-year-type"
                value={waterYearType}
                disabled={!hasWaterYears}
                onChange={event => updateWaterYearType(event.target.value)}
              >
                <option value="">{hasWaterYears ? 'All water years' : 'Not in this file'}</option>
                {hasWaterYears && WATER_YEAR_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters}>Clear Filters</button>
          </div>
        </section>

        <section className="variable-search-results" aria-labelledby="variable-results-title">
          <div className="variable-search-results-heading">
            <h2 id="variable-results-title">Search results</h2>
            <p role="status">{results.length.toLocaleString('en-US')} matching {results.length === 1 ? 'variable' : 'variables'}</p>
          </div>
          {searchError && <ErrorState error={searchError} onRetry={resetSearch} />}
          {!searchError && results.length === 0 && <EmptyState onReset={resetSearch} />}
          {results.length > 0 && (
            <>
              <VariableResults
                variables={shown.items}
                waterYearType={waterYearType}
                yearsById={yearsById}
                onViewChart={openDetails}
              />
              {results.length > PAGE_SIZES[0] && (
                <ResultsPager
                  page={shown.page}
                  pageCount={shown.pageCount}
                  pageSize={pageSize}
                  total={results.length}
                  onPageChange={setPage}
                  onPageSizeChange={size => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </section>

        <div className="variable-search-actions">
          <button type="button" onClick={() => onNavigate('compare-runs')}>Compare Runs</button>
          <button type="button" onClick={() => onNavigate('anomaly-detection')}>Analyze Anomalies</button>
        </div>
      </div>
    </main>
  );
}

export default VariableSearch;
