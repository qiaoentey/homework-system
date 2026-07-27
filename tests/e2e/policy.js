export const EXTERNAL_MUTATION_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_THIS_MUTATES_EXTERNAL_DATA";

function externalMutationsAllowed({ externalBaseUrl, mutationOptIn }) {
  return Boolean(externalBaseUrl) &&
    mutationOptIn === EXTERNAL_MUTATION_ACKNOWLEDGEMENT;
}

export function selectE2ETestMatch(options) {
  if (options.externalBaseUrl && !externalMutationsAllowed(options)) {
    return ["**/smoke.spec.js"];
  }
  return ["**/daycare.spec.js"];
}

export function assertExternalMutationSafety(options) {
  if (options.externalBaseUrl && !externalMutationsAllowed(options)) {
    throw new Error(
      "Refusing external mutation suite. " +
      "Use the read-only smoke suite, or explicitly acknowledge external data mutations.",
    );
  }
}

export function isReadOnlyHttpMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
