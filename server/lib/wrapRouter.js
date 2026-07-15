const asyncHandler = require('./asyncHandler');

// wrapRouter(router) — patches .get/.post/.put/.delete so every handler
// (route handler AND any middleware passed alongside it, e.g. requireAuth,
// requireRole('admin'), multer's upload.single(...)) is automatically
// wrapped in asyncHandler. This means every route file gets crash-safe
// error handling for free just by creating its router through this
// function, instead of having to remember to wrap each handler by hand.
function wrapRouter(router) {
  ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => {
      const wrapped = handlers.map(h => (typeof h === 'function' ? asyncHandler(h) : h));
      return original(path, ...wrapped);
    };
  });
  return router;
}

module.exports = wrapRouter;
