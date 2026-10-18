export function searchVariables(variables, keyword, filters = {}) {
  const query = keyword.trim().toLowerCase();

  return variables.filter(variable => {
    const matchesKeyword = variable.identifier.toLowerCase().includes(query) ||
      variable.location.toLowerCase().includes(query);

    return matchesKeyword &&
      (!filters.runId || variable.runId === filters.runId) &&
      (!filters.category || variable.category === filters.category) &&
      (!filters.units || variable.units === filters.units) &&
      (!filters.interval || variable.interval === filters.interval);
  });
}
