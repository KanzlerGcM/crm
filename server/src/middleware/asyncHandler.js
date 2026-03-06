/**
 * Wraps an async route handler to catch rejections and forward to Express error handler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Sanitize error message — avoid leaking internal details to the client.
 * Returns a generic message for unexpected errors, or the original for known/operational errors.
 */
export const safeErrorMessage = (err, fallback = 'Erro interno do servidor') => {
  // If it's a known operational error with a status, keep the message
  if (err.status && err.status < 500) return err.message;
  // Otherwise return fallback
  return fallback;
};
