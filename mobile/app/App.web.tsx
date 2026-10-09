// Web entry: the app, or with `?preview=page-turn` the page-turn preview. Both load CanvasKit, its
// wasm served locally by Metro (offline-first, no CDN), before Skia is imported (the Book's page
// curl, PageTurn.tsx).
import { lazy, Suspense } from 'react';
// @ts-expect-error a wasm asset is its URL
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm';

// No CanvasKit (no WebAssembly, a failed wasm load): the app still opens and its pages change
// without a curl (BOOK-UI-COMPONENTS Page turn), never a blank page.
const skia = () =>
  import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb')
    .then(({ LoadSkiaWeb }) => LoadSkiaWeb({ locateFile: () => wasm }))
    .catch(() => {});
const App = lazy(() => skia().then(() => import('./web-app.ts')));
const Preview = lazy(() => skia().then(() => import('./page-turn-preview.tsx')));

export default function WebApp() {
  const preview = new URLSearchParams(location.search).has('preview', 'page-turn');
  return <Suspense fallback={null}>{preview ? <Preview /> : <App />}</Suspense>;
}
