// Web entry: the app, or with `?preview=page-turn` the page-turn preview. Only the preview loads
// CanvasKit, its wasm served locally by Metro (offline-first, no CDN), before Skia is imported.
import { lazy, Suspense } from 'react';
import App from './App.tsx';
// @ts-expect-error a wasm asset is its URL
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm';

const Preview = lazy(async () => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  return import('./page-turn-preview.tsx');
});

export default function WebApp() {
  if (!new URLSearchParams(location.search).has('preview', 'page-turn')) return <App />;
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
