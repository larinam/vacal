/**
 * Turn an error thrown by `useApi`'s `apiCall` into a message worth showing.
 *
 * `apiCall` attaches the parsed response body as `error.data`, so FastAPI's
 * `detail` arrives in one of three shapes: a validation array, a single object
 * with `msg`, or a plain string raised by `HTTPException`.
 *
 * @param {unknown} error - the rejected value from a mutation or apiCall.
 * @param {string} [fallback] - used when the response carries no usable detail.
 * @returns {string}
 */
export const getApiErrorMessage = (error, fallback = 'An error occurred. Please try again.') => {
  const detail = error?.data?.detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.msg) return detail.msg;
  if (typeof detail === 'string' && detail) return detail;
  return fallback;
};
