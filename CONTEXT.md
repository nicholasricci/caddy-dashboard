# Caddy Dashboard — Domain Glossary

Terms used across the Caddy Dashboard product. This file defines domain language only, not implementation details.

## API Key

A machine-to-machine credential issued by an administrator. Each key has a name, a visible prefix, one or more scopes, a list of discovery groups it may act on (`allowed_discovery_config_ids`), and optionally a list of upstream profiles it may use (`allowed_upstream_profile_ids`). The full secret is shown only once at creation.

## Discovery group

The set of Caddy proxy nodes associated with a single autodiscovery rule. API keys and propagate operations refer to discovery groups by their discovery config identifier.

## Upstream profile

A named set of Caddy route bindings (`config_id` and optional `port`) attached to one discovery group. Machine-to-machine register via profile adds upstream dials for every binding from a single `private_ip` on the group.

## Scope `register_upstream`

An API key scope that authorizes machine-to-machine register calls: `POST /api/v1/discovery/:id/register-upstream` on allowed discovery groups, and `POST /api/v1/upstream-profiles/:id/register` on allowed upstream profiles. Today this is the only scope with a real effect on the API.

## Session JWT

A short-lived access token (and refresh token) obtained by a human user through dashboard login. Used for browser sessions and admin UI operations such as managing users, audit logs, API keys, and upstream profiles.

## API Playground

An admin-only UI for testing machine-to-machine API calls by pasting an API key secret. Distinct from API key management (`/admin/api-keys`): the playground executes requests (`register_upstream` on a discovery group, or register via an upstream profile), while the keys page creates and revokes credentials. Each operation exposes only the parameters its API endpoint expects (e.g. profile register: profile ID and `private_ip`; register upstream: discovery group, `config_id`, and dial or `private_ip`+port).
