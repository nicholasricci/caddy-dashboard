# AGENTS.md

Guidance for AI/code agents and contributors working on this repository.

License: see the [MIT License](LICENSE) in the repository root.

## Project Context

- Stack: Angular 20, standalone components, zoneless change detection, Tailwind + DaisyUI.
- Domain: dashboard for Caddy nodes, discovery flows, user/admin management, config sync/edit operations.
- API base URL is environment-driven (`src/environments`).

## Working Agreement

- Prefer small, incremental changes over broad rewrites.
- Keep UI logic in pages/components thin where practical; move HTTP/domain orchestration into services/facades.
- Preserve existing UX and style system unless change is explicitly requested.
- Do not modify generated plan files under `.cursor/plans/` unless explicitly asked.

## Architecture Conventions

- Use standalone components and lazy route loading.
- Prefer functional guards (`CanActivateFn`) returning `UrlTree` for redirects.
- Favor signal-first state in components, especially with zoneless mode.
- Use typed API boundaries and explicit mapping when page view models differ from DTOs.
- Keep API calls in scoped services under `src/app/services/api/` when adding new endpoints.

## Security Conventions

- Never hardcode secrets.
- Token/session handling must remain centralized in auth services/interceptors.
- Treat decoded JWT data as UI hints only; authorization is backend-enforced.

## Quality Gates

Before considering work complete, run:

```bash
npm run lint
npm run test:ci
npm run build
```

CI workflow for this baseline lives in `.github/workflows/frontend-ci.yml`.

## Testing Expectations

- Add or update unit tests for changes in:
  - auth flow (service/interceptor/guards),
  - route access behavior,
  - API service behavior for new endpoints.
- Keep tests zoneless-compatible where needed (`provideZonelessChangeDetection` in TestBed).

## Accessibility Baseline

- Associate form labels with controls (`for`/`id`).
- Modal dialogs should include:
  - `role="dialog"`, `aria-modal`,
  - keyboard dismissal (`Escape`) and sensible overlay behavior,
  - propagation handling so dialog content does not trigger backdrop close.
