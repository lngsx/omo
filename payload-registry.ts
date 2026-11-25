// The files we inject into the page, read once at startup and kept in memory.
// The server imports the text from here instead of doing the reads itself.
// Restart the proxy to pick up edits.

const [appCss, appJs] = await Promise.all([
  Bun.file(new URL("./payload/app.css", import.meta.url)).text(),
  Bun.file(new URL("./payload/app.js", import.meta.url)).text(),
]);

export { appCss, appJs };
