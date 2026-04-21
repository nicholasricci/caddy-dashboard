/** Types aligned with Caddy Dashboard Go API v1 (Swagger). */

export interface ApiErrorBody {
  error?: string;
}

export interface CaddyNodeV1 {
  id?: string;
  name?: string;
  private_ip?: string;
  instance_id?: string;
  discovery_config_id?: string;
  region?: string;
  ssm_enabled?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_seen_at?: string;
}

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
  target?: string;
  details?: Record<string, unknown> | string;
  created_at?: string;
  [key: string]: unknown;
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
