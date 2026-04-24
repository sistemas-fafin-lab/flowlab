/// <reference types="vite/client" />

// Allow side-effect CSS imports (e.g. from react-grid-layout, react-resizable)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
