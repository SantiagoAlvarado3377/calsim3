// SCRUM-194: sort the complete matching catalog before pagination. Keep the
// source array and row objects intact so filtering and chart return still work.
const alphabet = new Intl.Collator('en', { sensitivity: 'base' });

function compareExact(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}

export function sortVariables(variables, { field = 'identifier', direction = 'ascending' } = {}) {
  const fields = field === 'dateRange' ? ['startMonth', 'endMonth'] : [field];
  const multiplier = direction === 'descending' ? -1 : 1;
  const hasValue = variable => fields.every(key => variable[key] != null && variable[key] !== '');

  return [...variables].sort((first, second) => {
    const firstPresent = hasValue(first);
    const secondPresent = hasValue(second);
    // Missing text or incomplete date ranges stay last in either direction.
    if (firstPresent !== secondPresent) return firstPresent ? -1 : 1;

    if (firstPresent) {
      for (const key of fields) {
        // ISO dates sort chronologically; formatted month names do not.
        const order = field === 'dateRange'
          ? compareExact(first[key], second[key])
          : alphabet.compare(first[key], second[key]);
        if (order) return order * multiplier;
      }
    }

    // Equal primary values keep a deterministic order, even across pages and
    // direction changes. A DSS variable's id includes its run and full path.
    return alphabet.compare(first.identifier ?? '', second.identifier ?? '')
      || alphabet.compare(first.runId ?? '', second.runId ?? '')
      || compareExact(first.id ?? '', second.id ?? '');
  });
}
