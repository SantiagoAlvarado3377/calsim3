const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const messages = {
  invalidRequest: 'Choose a baseline run, alternative run, and variable.',
  sameRun: 'Baseline and alternative runs must be different.',
  invalidDateRange: 'Choose a valid date range with the start month on or before the end month.',
  baselineRunNotFound: 'The selected baseline run is unavailable.',
  alternativeRunNotFound: 'The selected alternative run is unavailable.',
  baselineVariableNotFound: 'The selected variable is unavailable in the baseline run.',
  alternativeVariableNotFound: 'The selected variable is unavailable in the alternative run.',
  noDateOverlap: 'The selected date range is outside the runs’ shared calendar coverage.',
  incompatibleUnits: 'The selected variable uses incompatible units in the two runs.',
  unsupportedFrequency: 'Comparison requires monthly observations in both runs.',
  noComparableMonths: 'No months in the selected range have usable observations for both runs.',
  dataSource: 'Comparison data could not be loaded. Please try again.',
};

function failure(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function isValidMonth(month) {
  const match = typeof month === 'string' ? MONTH_PATTERN.exec(month) : null;
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

function isValidRange(range) {
  return Boolean(
    range &&
      isValidMonth(range.start) &&
      isValidMonth(range.end) &&
      range.start <= range.end,
  );
}

function providerFailure(response, role) {
  if (response?.status === 'run-not-found') {
    return failure(
      'run-not-found',
      role === 'baseline' ? messages.baselineRunNotFound : messages.alternativeRunNotFound,
    );
  }

  if (response?.status === 'variable-not-found') {
    return failure(
      'variable-not-found',
      role === 'baseline' ? messages.baselineVariableNotFound : messages.alternativeVariableNotFound,
    );
  }

  return null;
}

function isExpectedSeries(series, runId, variableId) {
  return Boolean(
    series &&
      series.runId === runId &&
      series.variableId === variableId &&
      isValidMonth(series.startMonth) &&
      isValidMonth(series.endMonth) &&
      series.startMonth <= series.endMonth &&
      isValidSource(series.source),
  );
}

function isValidSource(source) {
  return Boolean(
    source &&
      typeof source.kind === 'string' &&
      source.kind.trim() &&
      typeof source.label === 'string' &&
      source.label.trim(),
  );
}

function combineSources(baselineSource, alternativeSource) {
  const baseline = {
    kind: baselineSource.kind.trim(),
    label: baselineSource.label.trim(),
  };
  const alternative = {
    kind: alternativeSource.kind.trim(),
    label: alternativeSource.label.trim(),
  };

  if (baseline.kind === alternative.kind && baseline.label === alternative.label) {
    return baseline;
  }

  return {
    kind: 'mixed',
    label: `Baseline: ${baseline.label}; Alternative: ${alternative.label}`,
  };
}

function normalizedUnits(units) {
  return typeof units === 'string' ? units.trim().toUpperCase() : '';
}

function observationStatus(value) {
  if (value === null || value === undefined) return { status: 'missing' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { status: 'invalid' };
  return { status: 'available', value };
}

function observationsByMonth(observations) {
  const byMonth = new Map();
  if (!Array.isArray(observations)) return byMonth;

  for (const observation of observations) {
    if (isValidMonth(observation?.month)) {
      // Provider order is authoritative: a later duplicate replaces an earlier value.
      byMonth.set(observation.month, observationStatus(observation.value));
    }
  }
  return byMonth;
}

function monthsInRange({ start, end }) {
  const months = [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  let current = startYear * 12 + startMonth - 1;
  const final = endYear * 12 + endMonth - 1;

  while (current <= final) {
    const year = Math.floor(current / 12);
    const month = current % 12 + 1;
    months.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
    current += 1;
  }

  return months;
}

export async function compareMonthlyRuns(request, provider) {
  const { baselineRunId, alternativeRunId, variableId, range } = request ?? {};

  if (!baselineRunId || !alternativeRunId || !variableId) {
    return failure('invalid-request', messages.invalidRequest);
  }
  if (baselineRunId === alternativeRunId) {
    return failure('same-run', messages.sameRun);
  }
  if (!isValidRange(range)) {
    return failure('invalid-date-range', messages.invalidDateRange);
  }

  let baselineResponse;
  let alternativeResponse;
  try {
    [baselineResponse, alternativeResponse] = await Promise.all([
      provider.getMonthlySeries({ runId: baselineRunId, variableId }),
      provider.getMonthlySeries({ runId: alternativeRunId, variableId }),
    ]);
  } catch {
    return failure('data-source-error', messages.dataSource);
  }

  const baselineFailure = providerFailure(baselineResponse, 'baseline');
  if (baselineFailure) return baselineFailure;
  const alternativeFailure = providerFailure(alternativeResponse, 'alternative');
  if (alternativeFailure) return alternativeFailure;

  const baselineSeries = baselineResponse?.series;
  const alternativeSeries = alternativeResponse?.series;
  if (
    baselineResponse?.status !== 'ok' ||
    alternativeResponse?.status !== 'ok' ||
    !isExpectedSeries(baselineSeries, baselineRunId, variableId) ||
    !isExpectedSeries(alternativeSeries, alternativeRunId, variableId)
  ) {
    return failure('data-source-error', messages.dataSource);
  }

  const overlap = {
    start: baselineSeries.startMonth > alternativeSeries.startMonth
      ? baselineSeries.startMonth
      : alternativeSeries.startMonth,
    end: baselineSeries.endMonth < alternativeSeries.endMonth
      ? baselineSeries.endMonth
      : alternativeSeries.endMonth,
  };
  if (overlap.start > overlap.end || range.start < overlap.start || range.end > overlap.end) {
    return failure('date-range-no-overlap', messages.noDateOverlap);
  }

  const baselineUnits = normalizedUnits(baselineSeries.units);
  const alternativeUnits = normalizedUnits(alternativeSeries.units);
  if (!baselineUnits || !alternativeUnits || baselineUnits !== alternativeUnits) {
    return failure('incompatible-units', messages.incompatibleUnits);
  }
  if (baselineSeries.frequency !== 'monthly' || alternativeSeries.frequency !== 'monthly') {
    return failure('unsupported-frequency', messages.unsupportedFrequency);
  }

  const baselineByMonth = observationsByMonth(baselineSeries.observations);
  const alternativeByMonth = observationsByMonth(alternativeSeries.observations);
  const pairs = [];
  const excludedMonths = [];

  for (const month of monthsInRange(range)) {
    const baseline = baselineByMonth.get(month) ?? { status: 'missing' };
    const alternative = alternativeByMonth.get(month) ?? { status: 'missing' };

    if (baseline.status === 'available' && alternative.status === 'available') {
      pairs.push({
        month,
        baselineValue: baseline.value,
        alternativeValue: alternative.value,
      });
    } else {
      excludedMonths.push({
        month,
        baselineStatus: baseline.status,
        alternativeStatus: alternative.status,
      });
    }
  }

  if (pairs.length === 0) {
    return failure('no-comparable-months', messages.noComparableMonths, {
      appliedRange: { ...range },
      comparableMonths: 0,
    });
  }

  return {
    ok: true,
    result: {
      baselineRunId,
      alternativeRunId,
      variableId,
      appliedRange: { ...range },
      units: baselineSeries.units.trim(),
      frequency: 'monthly',
      pairs,
      excludedMonths,
      comparableMonths: pairs.length,
      source: combineSources(baselineSeries.source, alternativeSeries.source),
    },
  };
}
