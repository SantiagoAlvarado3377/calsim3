export function searchVariables(variables, keyword, filters = {}) {
  const query = keyword.trim().toLowerCase();
  // Each filter key names a variable field and '' means any value, so new
  // filters (SCRUM-160) only need a field on each variable and a dropdown.
  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  return variables.filter(variable => {
    const matchesKeyword = variable.identifier.toLowerCase().includes(query) ||
      variable.location.toLowerCase().includes(query);

    return matchesKeyword && activeFilters.every(([key, value]) => variable[key] === value);
  });
}

// SCRUM-161: one page of results. page is 1-based and clamped to the last
// page, so a shrinking result set never lands on an empty page.
export function paginate(items, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount };
}
