# CaddyDashboard

Frontend dashboard for managing Caddy nodes (overview, discovery, config operations, user/admin area).

## Requirements

- Node.js 20+
- npm

## Development

Start local dev server:

```bash
npm start
```

App URL: `http://localhost:4200/`

## Scripts

- `npm start` - Angular dev server
- `npm run build` - production build to `dist/`
- `npm test` - watch-mode unit tests
- `npm run test:ci` - headless unit tests + coverage (CI-friendly)
- `npm run lint` - ESLint checks

## Quality Gate (local)

Before opening/merging a PR, run:

```bash
npm run lint
npm run test:ci
npm run build
```

## CI

Frontend quality checks are executed in:

- `.github/workflows/frontend-ci.yml`

The workflow runs install, lint, tests, and production build.

## Notes for Contributors and Agents

- See `AGENTS.md` for implementation conventions (architecture, auth/security, testing, accessibility).

## License

This project is licensed under the [MIT License](LICENSE).

## Angular CLI

This project uses Angular CLI 20.x.

Helpful commands:

```bash
ng generate component <name>
ng generate --help
```
