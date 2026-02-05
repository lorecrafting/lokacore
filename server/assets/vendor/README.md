# Vendor Dependencies

Pre-bundled third-party libraries. These are committed directly instead of pulled from npm.

See `versions.json` for exact version numbers and last update dates.

| File | Library | Source |
|------|---------|--------|
| `daisyui.js` | daisyUI | GitHub releases |
| `daisyui-theme.js` | daisyUI theme builder | GitHub releases |
| `heroicons.js` | Heroicons Tailwind plugin | Managed by mix.exs |
| `topbar.js` | Topbar progress bar | GitHub |

## Updating

To update daisyUI:

```bash
cd server/assets/vendor

# Download latest versions
curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui.js
curl -sLO https://github.com/saadeghi/daisyui/releases/latest/download/daisyui-theme.js

# Update versions.json with new version number and date
# Check release notes: https://github.com/saadeghi/daisyui/releases
```

**IMPORTANT:** After updating, also update `versions.json` with:
- New version number (check the release page)
- Today's date in `updated` field

Check the [daisyUI changelog](https://daisyui.com/docs/changelog/) before updating for breaking changes.
