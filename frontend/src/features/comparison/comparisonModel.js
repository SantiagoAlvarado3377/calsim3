const DEFAULT_BASELINE_ID = 'baseline-2025';
const DEFAULT_ALTERNATIVE_ID = 'alternative-operations-a';
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SAME_RUN_MESSAGE = 'Baseline and alternative runs must be different.';
const INVALID_RANGE_MESSAGE =
  'Choose a date range within the overlap, with the start month on or before the end month.';
const INVALID_VARIABLE_MESSAGE = 'Choose a variable available in both selected runs.';

function isValidMonth(month) {
  if (typeof month !== 'string') return false;

  const match = MONTH_PATTERN.exec(month);
  if (!match) return false;

  const monthNumber = Number(match[2]);
  return monthNumber >= 1 && monthNumber <= 12;
}

function hasValidCoverage(run) {
  return Boolean(
    run &&
      isValidMonth(run.startMonth) &&
      isValidMonth(run.endMonth) &&
      run.startMonth <= run.endMonth,
  );
}

function findRun(runs, runId) {
  return runs.find(run => run.id === runId) ?? null;
}

export function getSharedVariables(baselineRun, alternativeRun) {
  if (!baselineRun || !alternativeRun) return [];

  const alternativeVariables = new Set(alternativeRun.variables ?? []);
  return (baselineRun.variables ?? []).filter(variable => alternativeVariables.has(variable));
}

export function getOverlap(baselineRun, alternativeRun) {
  if (!hasValidCoverage(baselineRun) || !hasValidCoverage(alternativeRun)) return null;

  const start = baselineRun.startMonth > alternativeRun.startMonth
    ? baselineRun.startMonth
    : alternativeRun.startMonth;
  const end = baselineRun.endMonth < alternativeRun.endMonth
    ? baselineRun.endMonth
    : alternativeRun.endMonth;

  return start <= end ? { start, end } : null;
}

export function isDateRangeWithinOverlap(range, overlap) {
  if (
    !range ||
    !overlap ||
    !isValidMonth(range.start) ||
    !isValidMonth(range.end) ||
    !isValidMonth(overlap.start) ||
    !isValidMonth(overlap.end)
  ) {
    return false;
  }

  return (
    range.start <= range.end &&
    range.start >= overlap.start &&
    range.end <= overlap.end
  );
}

export function formatMonth(month) {
  if (!isValidMonth(month)) return '';

  const [year, monthValue] = month.split('-');
  return `${MONTH_NAMES[Number(monthValue) - 1]} ${year}`;
}

export function formatMonthRange(range) {
  if (!range || !isValidMonth(range.start) || !isValidMonth(range.end)) {
    return 'No overlapping dates';
  }

  return `${formatMonth(range.start)} – ${formatMonth(range.end)}`;
}

function reconcileSelections(state, runs) {
  const baselineRun = findRun(runs, state.baselineRunId);
  const alternativeRun = findRun(runs, state.alternativeRunId);
  const sharedVariables = getSharedVariables(baselineRun, alternativeRun);
  const overlap = getOverlap(baselineRun, alternativeRun);

  return {
    ...state,
    variable: sharedVariables.includes(state.variable)
      ? state.variable
      : (sharedVariables[0] ?? null),
    dateRange: isDateRangeWithinOverlap(state.dateRange, overlap)
      ? state.dateRange
      : (overlap ? { ...overlap } : null),
    message: null,
  };
}

export function createComparisonState(runs) {
  const baselineRun = findRun(runs, DEFAULT_BASELINE_ID) ?? runs[0] ?? null;
  const preferredAlternative = findRun(runs, DEFAULT_ALTERNATIVE_ID);
  const alternativeRun = preferredAlternative?.id !== baselineRun?.id
    ? preferredAlternative
    : (runs.find(run => run.id !== baselineRun?.id) ?? null);

  return reconcileSelections(
    {
      baselineRunId: baselineRun?.id ?? null,
      alternativeRunId: alternativeRun?.id ?? null,
      variable: null,
      dateRange: null,
      message: null,
    },
    runs,
  );
}

export function transitionComparison(state, action, runs) {
  if (action.type === 'select-run') {
    const isBaseline = action.role === 'baseline';
    const oppositeRunId = isBaseline ? state.alternativeRunId : state.baselineRunId;

    if (action.runId === oppositeRunId) {
      return { ...state, message: SAME_RUN_MESSAGE };
    }

    if (!findRun(runs, action.runId)) {
      return { ...state, message: 'The selected simulation run is unavailable.' };
    }

    return reconcileSelections(
      {
        ...state,
        [isBaseline ? 'baselineRunId' : 'alternativeRunId']: action.runId,
      },
      runs,
    );
  }

  if (action.type === 'select-variable') {
    const view = deriveComparisonView(state, runs);
    if (!view.sharedVariables.includes(action.variable)) {
      return { ...state, message: INVALID_VARIABLE_MESSAGE };
    }

    return { ...state, variable: action.variable, message: null };
  }

  if (action.type === 'select-date-range') {
    const view = deriveComparisonView(state, runs);
    if (!isDateRangeWithinOverlap(action.range, view.overlap)) {
      return { ...state, message: INVALID_RANGE_MESSAGE };
    }

    return { ...state, dateRange: { ...action.range }, message: null };
  }

  return state;
}

export function deriveComparisonView(state, runs) {
  const baselineRun = findRun(runs, state.baselineRunId);
  const alternativeRun = findRun(runs, state.alternativeRunId);
  const sharedVariables = getSharedVariables(baselineRun, alternativeRun);
  const overlap = getOverlap(baselineRun, alternativeRun);
  const messages = [];

  if (!baselineRun) {
    messages.push('The selected baseline run is unavailable.');
  }
  if (!alternativeRun) {
    messages.push('The selected alternative run is unavailable.');
  }

  if (baselineRun && alternativeRun) {
    if (state.message) messages.push(state.message);
    if (sharedVariables.length === 0) {
      messages.push('The selected runs do not share any variables.');
    }

    if (!hasValidCoverage(baselineRun) || !hasValidCoverage(alternativeRun)) {
      messages.push('One or both selected runs have invalid date coverage.');
    } else if (!overlap) {
      messages.push('The selected runs do not have overlapping dates.');
    }
  }

  const isValid = Boolean(
    baselineRun &&
      alternativeRun &&
      baselineRun.id !== alternativeRun.id &&
      state.variable &&
      sharedVariables.includes(state.variable) &&
      isDateRangeWithinOverlap(state.dateRange, overlap),
  );

  return {
    baselineRun,
    alternativeRun,
    sharedVariables,
    overlap,
    messages,
    isValid,
  };
}
