/** Declares the build-time module that supplies the bundled execution-page runner as text. */
declare module 'virtual:frame-runner' {
  /** Self-contained script built from `src/frame.ts` by the Vite configuration. */
  const runner: string;
  export default runner;
}
