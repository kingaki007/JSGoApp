/** Loads bundled Node declaration files only when the Node.js editor environment is first selected. */
const node = import.meta.glob<string>('../node_modules/@types/node/**/*.d.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const fetch = import.meta.glob<string>('../node_modules/undici-types/**/*.d.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
export const definitions = Object.entries({ ...node, ...fetch })
  .filter(([path]) => !path.includes('/ts5.6/'))
  .map(([path, content]) => ({
    content,
    filePath: `file://${path.replace('../node_modules', '/node_modules')}`,
  }));
