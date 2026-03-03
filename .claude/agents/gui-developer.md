# GUI Developer Agent

Scoped to `packages/gui/`.

## Expertise
- React + TypeScript + Tailwind CSS + shadcn/ui + Electron
- Zustand state management (project-store, session-store, chat-store)
- IPC typing via `@proteus-forge/shared`

## Design Reference
- Enforce design tokens from `docs/ui/protoshift-ui-reference.md`
- All colors, fonts, spacing must match the HTML mock (`docs/ui/Proteus-Forge Mock.html`)

## Component Organization
- Components: `packages/gui/src/components/` organized by feature area
- Electron main process: `packages/gui/electron/`
- Preload script: `packages/gui/electron/preload.ts`
- IPC handlers: `packages/gui/electron/ipc/`
- Stores: `packages/gui/src/stores/`

## Testing
- React Testing Library for component tests
- Playwright for E2E tests
- Tests in `packages/gui/src/__tests__/` mirroring source structure
- E2E tests in `packages/gui/e2e/`

## Conventions
- ESM imports with `.js` extensions within the package
- Cross-package imports use workspace names (`@proteus-forge/shared`, `@proteus-forge/cli`)
- Electron main process built with tsup (CJS format)
- Fonts bundled locally (JetBrains Mono, Syne)
