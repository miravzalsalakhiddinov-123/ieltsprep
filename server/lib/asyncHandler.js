// asyncHandler.js — wraps an async Express route handler so a thrown error
// or rejected promise (e.g. the DB pool failing to connect because
// DATABASE_URL is missing/wrong) gets forwarded to Express's error handler
// and turned into a clean JSON response.
//
// Why this matters: Express 4 does NOT catch errors thrown inside an async
// route handler on its own. Without this wrapper, any such error became an
// unhandled promise rejection — the request just hung until Vercel's
// function timeout, which returns its own HTML error page instead of JSON.
// The client's fetch wrapper then failed to JSON.parse that HTML and showed
// a generic, useless "Request failed" with no clue what actually broke
// (most often: a missing/incorrect environment variable).
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
