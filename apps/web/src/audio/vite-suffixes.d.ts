// Vite-specific import suffixes used in the audio module.

declare module '*?url' {
  const url: string;
  export default url;
}