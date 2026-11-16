import { formatMonth } from '../variableSearch/formatMonth.js';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function supportedVariableOptions(variables) {
  const supported = variables.filter(variable => {
    const component = variable.componentType?.toUpperCase();
    const units = variable.units?.toUpperCase();
    const convention = variable.dataType?.toUpperCase();
    const recognizedStorage = component === 'STORAGE' && ['TAF', 'AF'].includes(units)
      && ['PER-AVER', 'INST-VAL'].includes(convention);
    const recognizedFlow = (component === 'CHANNEL' || /^FLOW(?:-|$)/.test(component))
      && units === 'CFS' && convention === 'PER-AVER';

    return /^1MON(?:TH)?$/i.test(variable.interval)
      && (recognizedStorage || recognizedFlow)
      && monthPattern.test(variable.startMonth) && monthPattern.test(variable.endMonth)
      && variable.startMonth <= variable.endMonth;
  });

  const counts = new Map();
  for (const { identifier } of supported) counts.set(identifier, (counts.get(identifier) ?? 0) + 1);

  return supported.map(variable => {
    const { a, b, c, e, f } = variable.dssPath ?? {};
    return {
      variable,
      key: variable.dssPath ? JSON.stringify([a, b, c, e, f]) : variable.identifier,
      label: counts.get(variable.identifier) > 1
        ? `${variable.identifier} (${a}/${c}/${e}/${f})`
        : variable.identifier,
    };
  });
}

function startOfTrailingRange(endMonth, months) {
  const [year, month] = endMonth.split('-').map(Number);
  const date = new Date(`${endMonth}-01T00:00:00Z`);
  date.setUTCFullYear(year, month - months, 1);
  return date.toISOString().slice(0, 7);
}

export function includesDateRange(variable, range) {
  return Boolean(variable && range
    && variable.startMonth <= range.startMonth && range.endMonth <= variable.endMonth);
}

export function dateRangeKey({ startMonth, endMonth }) {
  return `${startMonth}/${endMonth}`;
}

export function dateRangeOptions(variable, selectedRange) {
  if (!variable) return [];

  const { startMonth, endMonth } = variable;
  const ranges = [{ startMonth, endMonth }];
  for (const months of [120, 60, 12]) {
    const start = startOfTrailingRange(endMonth, months);
    if (start > startMonth) ranges.push({ startMonth: start, endMonth });
  }
  if (includesDateRange(variable, selectedRange)
    && !ranges.some(range => dateRangeKey(range) === dateRangeKey(selectedRange))) {
    ranges.push(selectedRange);
  }
  return ranges.map(range => ({
    ...range,
    key: dateRangeKey(range),
    label: range.startMonth === range.endMonth
      ? formatMonth(range.startMonth)
      : `${formatMonth(range.startMonth)} – ${formatMonth(range.endMonth)}`,
  }));
}
