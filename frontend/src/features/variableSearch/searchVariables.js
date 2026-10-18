export function searchVariables(variables, keyword) {
  const query = keyword.trim().toLowerCase();

  return variables.filter(variable => (
    variable.identifier.toLowerCase().includes(query) ||
    variable.location.toLowerCase().includes(query)
  ));
}
