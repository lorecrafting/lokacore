// The web app behind CanvasKit (App.web.tsx): its own split bundle, since a lazy './App.tsx' would be
// fetched as /App.bundle, which Metro resolves to App.web.tsx.
export { default } from './App.tsx';
