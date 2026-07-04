// Shim: Node v24.11.1 on Windows mishandles `node --test test/` — the runner
// spawns the directory itself as a test-file entry instead of scanning it.
// Directory module resolution then lands here, which loads the real suite.
// When the runner discovers this file directly (bare `node --test`), the entry
// is index.js itself and we load nothing, so the suite doesn't run twice.
if (!/\.js$/.test(process.argv[1] || '')) await import('./engine.test.js');
