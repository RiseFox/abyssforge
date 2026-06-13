# External Asset Intake

This folder stores third-party candidate assets that are safe to evaluate for AbyssForge.

Rules:

- Only sources with an explicit license in `manifest.json` are allowed.
- Raw external assets are not automatically runtime assets.
- Before runtime use, normalize scale, palette, silhouette, naming, and anchor points into `assets/processed/` or generated code-native textures.
- Keep source evidence and license notes in `docs/THIRD_PARTY_ASSETS.md`.
- Supported automated source modes include GitHub raw files and direct official file URLs.

Commands:

```bash
npm run assets:fetch
npm run assets:audit
```
