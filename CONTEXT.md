# Caddy Dashboard — Domain Glossary

Terms used across the Caddy Dashboard product. This file defines domain language only, not implementation details.

## API Key

A machine-to-machine credential issued by an administrator. Each key has a name, a visible prefix, one or more scopes, and a list of discovery groups it may act on (`allowed_discovery_config_ids`). The full secret is shown only once at creation.

## Discovery group

The set of Caddy proxy nodes associated with a single autodiscovery rule. API keys and propagate operations refer to discovery groups by their discovery config identifier.

## Scope `register_upstream`

An API key scope that authorizes `POST /api/v1/discovery/:id/register-upstream` on discovery groups listed in the key. Today this is the only scope with a real effect on the API.

## Session JWT

A short-lived access token (and refresh token) obtained by a human user through dashboard login. Used for browser sessions and admin UI operations such as managing users, audit logs, and API keys.

## API Playground

An admin-only UI for testing machine-to-machine API calls by pasting an API key secret. Distinct from API key management (`/admin/api-keys`): the playground executes requests (today: `register_upstream`), while the keys page creates and revokes credentials.
