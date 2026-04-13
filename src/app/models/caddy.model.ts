
// OpenAPI v3.1.0 Schemas

// Base Schemas
export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}

// Auth Schemas
export interface Body_register_auth_register_post {
  email: string;
  username: string;
  password: string;
}

export interface Body_login_auth_token_post {
  grant_type?: 'password' | null;
  username: string;
  password: string;
  scope?: string;
  client_id?: string | null;
  client_secret?: string | null;
}

export interface User {
  id?: string | null;
  username: string;
  email: string;
  password_hash: string;
  role?: string;
  authorized?: boolean;
  is_admin?: boolean | null;
  created_at?: string | null; // date-time
  updated_at?: string | null; // date-time
}

// Caddy Admin Schemas
export interface CaddyAdaptRequest {
  config: string; // Configuration to adapt (e.g., Caddyfile)
  content_type?: string; // Content type of the configuration
}

export interface CaddyAdaptResponse {
  adapted_config: Record<string, unknown>;
  warnings?: string[] | null;
}

export interface CaddyConfigResponse {
  config?: Record<string, unknown> | null;
  success?: boolean;
  message?: string;
}

export interface CaddyLoadConfigRequest {
  config: Record<string, unknown>; // Caddy configuration in JSON format
}

export interface CaddyPKIResponse {
  ca_id: string;
  certificates?: string[] | null;
  info?: Record<string, unknown> | null;
}

export interface CaddyStatusResponse {
  status: string;
  version?: string | null;
  message?: string;
  timestamp?: string; // date-time
}

export interface CaddyUpstream {
  address: string;
  num_requests?: number;
  fails?: number;
}

export interface CaddyUpstreamsResponse {
  upstreams?: CaddyUpstream[];
}

export interface CaddyNode {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  description?: string;
  status: 'online' | 'offline' | 'unknown';
  is_active?: boolean;
  enabled: boolean;
  url?: string;
  last_seen?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  connection_type?: 'http' | 'ssm';
  ssm_instance_id?: string | null;
  ssm_region?: string | null;
}

export interface CaddyConfigBackupResponse {
  id: number;
  name: string;
  config_json: string;
  caddy_ip_address: string | null;
  original_config_id: number | null;
  created_by: number;
  created_at: string; // date-time
}

export interface CaddyImportConfigBackupRequest {
  config_json: string;
  name?: string | null;
  source_instance?: string | null;
}

// SSM Schemas
export interface SSMInstance {
  instance_id: string;
  name?: string | null;
  ip_address?: string | null;
  region: string;
  state: string;
  instance_type?: string;
  launch_time?: string;
  private_ip?: string | null;
  public_ip?: string | null;
  tags?: Record<string, string>;
}

export interface SSMDiscoveryRequest {
  regions: string[];
}

export interface SSMDiscoveryResponse {
  instances: SSMInstance[];
  scan_summary?: {
    total_instances: number;
    regions_scanned: string[];
    scan_duration_seconds: number;
  };
}

export interface CreateSSMNodeRequest {
  name: string;
  ssm_instance_id: string;
  ssm_region: string;
  ip_address?: string | null;
  description?: string;
  is_active?: boolean;
}

export interface SSMConnectionInfo {
  instance_id: string;
  region: string;
  connection_status: 'connected' | 'disconnected' | 'unknown';
  last_ping?: string | null;
  ssm_agent_version?: string | null;
}

// Network Discovery Schemas
export interface CaddyServerInfo {
  ip: string;
  port?: number;
  url: string;
  status: 'online' | 'offline';
  response_code?: number | null;
  version_info?: string | null;
}

export interface CaddyServerValidationRequest {
  ip: string;
  port?: number;
}

export interface CaddyServerValidationResponse {
  ip: string;
  port: number;
  is_valid: boolean;
  url: string;
}

export interface NetworkDiscoveryRequest {
  custom_networks?: string[] | null; // e.g., ['192.168.1.0/24']
  quick_scan?: boolean;
}

export interface NetworkDiscoveryResponse {
  servers: CaddyServerInfo[];
  scan_summary: Record<string, unknown>;
}

// Token Schemas (based on common OAuth2 practices)
export interface Token {
  access_token: string;
  token_type: string;
}
