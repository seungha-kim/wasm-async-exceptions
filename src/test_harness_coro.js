(function () {
  'use strict';

  const logLines = [];
  window.__logLines = logLines;

  const _log = console.log.bind(console);
  console.log = function (...args) {
    const line = args.map(String).join(' ');
    logLines.push(line);
    return _log(...args);
  };

  window.__Controlled = {
    resolve(id) {
      return window.__Coro.resolve(id);
    },
    reject(id) {
      return window.__Coro.reject(id);
    },
  };
})();
