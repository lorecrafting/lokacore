// Metro on web and Vite both give an audio import as its URL.
declare module '*.m4a' {
  const url: string;
  export default url;
}
