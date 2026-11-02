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

// Sacramento Valley water year types, in CalSim's 1–5 order.
export const WATER_YEAR_TYPES = ['Wet', 'Above Normal', 'Below Normal', 'Dry', 'Critical'];

// A water year runs October through September and is named for the year it ends in.
// Accepts 'YYYY-MM' or 'YYYY-MM-DD'.
export function waterYearOf(date) {
  const [year, month] = date.split('-').map(Number);
  return month >= 10 ? year + 1 : year;
}

// SCRUM-160: the water years of one type that fall inside a variable's date range.
export function matchingWaterYears(variable, waterYearTypes, type) {
  const first = waterYearOf(variable.startMonth);
  const last = waterYearOf(variable.endMonth);
  return Object.entries(waterYearTypes)
    .map(([year, yearType]) => [Number(year), yearType])
    .filter(([year, yearType]) => yearType === type && year >= first && year <= last)
    .map(([year]) => year);
}

// SCRUM-161: rows-per-page choices; the pager appears once results pass the first size.
export const PAGE_SIZES = [25, 50, 100];

// SCRUM-161: one page of results. page is 1-based and clamped to the last
// page, so a shrinking result set never lands on an empty page.
export function paginate(items, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount };
}
