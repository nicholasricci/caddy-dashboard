/** Types aligned with Caddy Dashboard Go API v1 (Swagger). */

export interface ApiErrorBody {
  error?: string;
}

/** Validated in backend `ValidateCaddyNode` (internal/models/node_transport.go). */
export type CaddyTransportV1 = 'aws_ssm' | 'ssh' | 'http_admin' | 'inventory_only';

export interface CaddyNodeV1 {
  id?: string;
  name?: string;
  private_ip?: string;
  instance_id?: string;
  discovery_config_id?: string;
  region?: string;
  /** @deprecated Prefer `transport === 'aws_ssm'`; kept for API compatibility. */
  ssm_enabled?: boolean;
  transport?: string;
  transport_config?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_seen_at?: string;
}

/** POST /api/v1/nodes */
export interface CreateNodeRequestV1 {
  name: string;
  private_ip?: string;
  instance_id?: string;
  region?: string;
  last_seen_at?: string;
  status?: string;
  transport?: CaddyTransportV1;
  transport_config?: Record<string, unknown>;
}

/** PUT /api/v1/nodes/{id} */
export interface UpdateNodeRequestV1 {
  name?: string;
  private_ip?: string;
  instance_id?: string;
  region?: string;
  last_seen_at?: string;
  status?: string;
  transport?: CaddyTransportV1;
  transport_config?: Record<string, unknown>;
}

/** POST /api/v1/snapshots/backfill */
export interface BackfillSnapshotsResponseV1 {
  duration_ms?: number;
  rows_updated?: number;
}

/** Stored snapshot row — schema varies; use helpers to read nested config. */
export type SnapshotRecordV1 = Record<string, unknown>;

/** POST /sync and similar command responses — often string map with optional nested config. */
export type SyncConfigResponseV1 = Record<string, unknown>;

/** Key/value pairs for EC2 tag-based discovery (`parameters.tags`). */
export interface DiscoveryTagPairV1 {
  key: string;
  value: string;
}

/** Optional structured fields inside `DiscoveryConfigV1.parameters`. */
export interface DiscoveryParametersV1 {
  tags?: DiscoveryTagPairV1[];
  addresses?: string[];
}

export interface DiscoveryConfigV1 {
  id?: string;
  name?: string;
  method?: string;
  enabled?: boolean;
  snapshot_scope?: SnapshotScopeV1;
  region?: string;
  tag_key?: string;
  tag_value?: string;
  parameters?: DiscoveryParametersV1;
  created_at?: string;
  updated_at?: string;
}

export type SnapshotScopeV1 = 'node' | 'group';

export interface UserV1 {
  id?: string;
  username?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogEntryV1 {
  id?: string;
  action?: string;
  actor?: string;
  resource?: string;
  resource_id?: string;
  payload?: Record<string, unknown> | string | null;
  target?: string;
  details?: Record<string, unknown> | string;
  created_at?: string;
  [key: string]: unknown;
}

export interface AuditLogListMetaV1 {
  total?: number;
  limit?: number;
  offset?: number;
}

export interface AuditLogListResponseV1 {
  items?: AuditLogEntryV1[];
  meta?: AuditLogListMetaV1;
}

export type AuditLogListResultV1 = AuditLogEntryV1[] | AuditLogListResponseV1;

export interface AuditListFilterV1 {
  action?: string;
  resource?: string;
  actor?: string;
  resource_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTypesResponseV1 {
  actions?: string[];
  resources?: string[];
}

export interface LoginRequestV1 {
  username: string;
  password: string;
}

export interface RefreshRequestV1 {
  refresh_token: string;
}

/** Server returns string map (e.g. access_token, refresh_token). */
export type TokenMapV1 = Record<string, string>;

export interface ApplyConfigRequestV1 {
  config: Record<string, unknown>;
}

export interface CaddyConfigIdInfoV1 {
  id?: string;
  has_upstreams?: boolean;
  upstream_count?: number;
  upstreams?: unknown[];
  host_count?: number;
  hosts?: string[];
}

export interface CaddyConfigIdsResponseV1 {
  items?: CaddyConfigIdInfoV1[];
}

export interface CaddyConfigUpstreamsResponseV1 {
  id?: string;
  has_upstreams?: boolean;
  upstream_count?: number;
  upstreams?: unknown[];
}

export interface CaddyConfigHostsResponseV1 {
  id?: string;
  host_count?: number;
  hosts?: string[];
}

export interface CreateUserRequestV1 {
  username: string;
  password: string;
  role?: string;
}

export interface UpdateUserRequestV1 {
  username?: string;
  password?: string;
  role?: string;
}

export interface SessionUserV1 {
  id: string | null;
  username: string;
  role: string | null;
  isAdmin: boolean;
}

/** POST /api/v1/nodes/{id}/config/mutate/domains */
export interface DnsChallengeRequestV1 {
  provider?: string;
  api_token?: string;
}

export interface DomainMutationTargetRequestV1 {
  config_id: string;
  add_domains?: string[];
  remove_domains?: string[];
  match_indexes?: number[];
}

export interface MutateDomainsRequestV1 {
  targets: DomainMutationTargetRequestV1[];
  dry_run?: boolean;
  update_tls_policies?: boolean;
  dns_challenge?: DnsChallengeRequestV1;
}

export interface DomainMutationDiffV1 {
  added?: string[];
  removed?: string[];
}

export interface DomainMutationResultV1 {
  config_id?: string;
  changed?: boolean;
  added?: string[];
  removed?: string[];
  hosts?: string[];
}

export interface MutateDomainsResponseV1 {
  changed?: boolean;
  dry_run?: boolean;
  diff?: DomainMutationDiffV1;
  preview?: Record<string, unknown>;
  results?: DomainMutationResultV1[];
}

/** POST /api/v1/nodes/{id}/config/mutate/upstreams */
export interface UpstreamMutationTargetRequestV1 {
  config_id: string;
  add_dial?: string;
  remove_dial?: string;
  probe_timeout_ms?: number;
  prune_unhealthy?: boolean;
}

export interface MutateUpstreamsRequestV1 {
  targets: UpstreamMutationTargetRequestV1[];
  dry_run?: boolean;
}

export interface UpstreamMutationDiffV1 {
  added?: string[];
  removed?: string[];
  pruned?: string[];
}

export interface UpstreamMutationResultV1 {
  config_id?: string;
  changed?: boolean;
  added?: string[];
  removed?: string[];
  pruned?: string[];
  upstreams?: string[];
}

export interface MutateUpstreamsResponseV1 {
  changed?: boolean;
  dry_run?: boolean;
  diff?: UpstreamMutationDiffV1;
  preview?: Record<string, unknown>;
  results?: UpstreamMutationResultV1[];
}

/** POST /api/v1/nodes/{id}/config/propagate */
export interface PropagateConfigResponseV1 {
  source_node_id?: string;
  applied_to?: string[];
  skipped?: string[];
}

/** M2M scopes with real effect on the API (`internal/models/api_key.go`). */
export const API_KEY_SCOPE_REGISTER_UPSTREAM = 'register_upstream' as const;
export const API_KEY_SCOPE_REGISTER_DOMAIN = 'register_domain' as const;

export const API_KEY_KNOWN_SCOPES = [
  API_KEY_SCOPE_REGISTER_UPSTREAM,
  API_KEY_SCOPE_REGISTER_DOMAIN
] as const;

export interface APIKeyV1 {
  id?: string;
  name?: string;
  key_prefix?: string;
  scopes?: string[];
  allowed_discovery_config_ids?: string[];
  allowed_upstream_profile_ids?: string[];
  allowed_domain_profile_ids?: string[];
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** GET /api/v1/api-keys */
export interface APIKeyListResponseV1 {
  items: APIKeyV1[];
}

/** POST /api/v1/api-keys */
export interface CreateAPIKeyRequestV1 {
  name: string;
  scopes: string[];
  allowed_discovery_config_ids: string[];
  allowed_upstream_profile_ids?: string[];
  allowed_domain_profile_ids?: string[];
  expires_at?: string;
}

/** POST /api/v1/api-keys — 201 */
export interface APIKeyCreateResponseV1 {
  api_key: APIKeyV1;
  secret: string;
}

/** POST /api/v1/discovery/{id}/register-upstream */
export interface RegisterUpstreamRequestV1 {
  config_id: string;
  dial?: string;
  private_ip?: string;
  port?: number;
  dry_run?: boolean;
}

export interface RegisterUpstreamResponseV1 {
  changed?: boolean;
  dial?: string;
  discovery_config_id?: string;
  dry_run?: boolean;
  mutate?: MutateUpstreamsResponseV1;
  propagate?: PropagateConfigResponseV1;
  source_node_id?: string;
}

export interface UpstreamProfileBindingV1 {
  config_id: string;
  port?: number;
}

export interface UpstreamProfileV1 {
  id?: string;
  name?: string;
  description?: string;
  discovery_config_id?: string;
  bindings?: UpstreamProfileBindingV1[];
  created_at?: string;
  updated_at?: string;
}

/** POST /discovery/{id}/upstream-profiles, PUT /upstream-profiles/{id} */
export interface UpstreamProfileWriteRequestV1 {
  name: string;
  bindings: UpstreamProfileBindingV1[];
  description?: string;
}

/** POST /api/v1/upstream-profiles/{id}/register */
export interface RegisterUpstreamByProfileRequestV1 {
  private_ip: string;
  dry_run?: boolean;
}

export interface RegisterUpstreamProfileTargetV1 {
  config_id?: string;
  dial?: string;
}

export interface RegisterUpstreamProfileResponseV1 {
  changed?: boolean;
  discovery_config_id?: string;
  dry_run?: boolean;
  mutate?: MutateUpstreamsResponseV1;
  propagate?: PropagateConfigResponseV1;
  source_node_id?: string;
  targets?: RegisterUpstreamProfileTargetV1[];
  upstream_profile_id?: string;
}

export interface DnsChallengeRequestV1 {
  provider?: string;
  api_token?: string;
}

export interface DomainProfileBindingV1 {
  config_id: string;
  match_indexes?: number[];
}

export interface DomainProfileV1 {
  id?: string;
  name?: string;
  description?: string;
  discovery_config_id?: string;
  bindings?: DomainProfileBindingV1[];
  created_at?: string;
  updated_at?: string;
}

/** POST /discovery/{id}/domain-profiles, PUT /domain-profiles/{id} */
export interface DomainProfileWriteRequestV1 {
  name: string;
  bindings: DomainProfileBindingV1[];
  description?: string;
}

/** POST /api/v1/discovery/{id}/register-domain */
export interface RegisterDomainRequestV1 {
  config_id: string;
  domains: string[];
  match_indexes?: number[];
  dns_challenge?: DnsChallengeRequestV1;
  update_tls_policies?: boolean;
  dry_run?: boolean;
}

export interface RegisterDomainResponseV1 {
  changed?: boolean;
  discovery_config_id?: string;
  dry_run?: boolean;
  mutate?: MutateDomainsResponseV1;
  propagate?: PropagateConfigResponseV1;
  source_node_id?: string;
}

/** POST /api/v1/domain-profiles/{id}/register */
export interface RegisterDomainByProfileRequestV1 {
  domains: string[];
  dns_challenge?: DnsChallengeRequestV1;
  update_tls_policies?: boolean;
  dry_run?: boolean;
}

export interface RegisterDomainProfileTargetV1 {
  config_id?: string;
  domains?: string[];
  match_indexes?: number[];
}

export interface RegisterDomainProfileResponseV1 {
  changed?: boolean;
  discovery_config_id?: string;
  domain_profile_id?: string;
  dry_run?: boolean;
  mutate?: MutateDomainsResponseV1;
  propagate?: PropagateConfigResponseV1;
  source_node_id?: string;
  targets?: RegisterDomainProfileTargetV1[];
}
