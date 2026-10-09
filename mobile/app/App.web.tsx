// Web entry: the app, or with `?preview=page-turn` the page-turn preview. Both load CanvasKit, its
// wasm served locally by Metro (offline-first, no CDN), before Skia is imported (the Book's page
// curl, PageTurn.tsx).
import { lazy, Suspense } from 'react';
// @ts-expect-error a wasm asset is its URL
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm';

const skia = async () => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
};
const App = lazy(() => skia().then(() => import('./web-app.ts')));
const Preview = lazy(() => skia().then(() => import('./page-turn-preview.tsx')));

export default function WebApp() {
  const preview = new URLSearchParams(location.search).has('preview', 'page-turn');
  return <Suspense fallback={null}>{preview ? <Preview /> : <App />}</Suspense>;
}
