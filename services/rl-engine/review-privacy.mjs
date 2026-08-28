function stringLeaves(value, leaves = []) {
  if (typeof value === "string") leaves.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringLeaves(item, leaves));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => stringLeaves(item, leaves));
  return leaves;
}

function identifierAppearsInStrings(identifier, values) {
  const sensitive = String(identifier).toLowerCase();
  if (sensitive.length < 3) return false;
  const escaped = sensitive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bounded = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu");
  return values.some((value) => {
    const text = String(value).toLowerCase();
    return text === sensitive || bounded.test(text);
  });
}

/**
 * Detect source identifiers only in exported string values and at complete
 * Unicode identifier boundaries. Searching raw JSON creates false positives
 * when a short player name happens to be part of a schema key such as
 * "evaluation" or a serialized coordinate.
 */
export function containsSensitiveIdentifier(artifact, identifiers = []) {
  const values = stringLeaves(artifact);
  return [...identifiers].some((identifier) => identifierAppearsInStrings(identifier, values));
}
