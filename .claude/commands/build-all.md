Build all workspace packages in dependency order: shared → cli → gui.

Run:
```bash
npm run build -w @proteus-forge/shared && npm run build -w @proteus-forge/cli && npm run build -w @proteus-forge/gui
```

Verify all gates pass (lint, typecheck, test, bundle).
