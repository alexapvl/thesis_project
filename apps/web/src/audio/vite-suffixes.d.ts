// Vite-specific import suffixes used in the audio module.

/// <reference types="vite/client" />

declare module '*?url' {
  const url: string;
  export default url;
}