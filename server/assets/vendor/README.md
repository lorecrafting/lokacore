# Vendor Dependencies

Pre-bundled third-party libraries. These are committed directly instead of pulled from npm.

| File | Library | Version | Source |
|------|---------|---------|--------|
| `daisyui.js` | daisyUI | 4.x | `curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui.js` |
| `daisyui-theme.js` | daisyUI themes | 4.x | `curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui-theme.js` |
| `heroicons.js` | Heroicons Tailwind plugin | 2.2.0 | Managed by mix.exs `heroicons` dependency |
| `topbar.js` | Topbar progress | 3.0.0 | https://github.com/buunguyen/topbar |

## Updating

To update daisyUI, run:
```bash
cd server/assets/vendor
curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui.js
curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui-theme.js
```

Check the [daisyUI changelog](https://daisyui.com/docs/changelog/) before updating.
