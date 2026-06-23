import { API_KEY_SCOPE_REGISTER_DOMAIN, API_KEY_SCOPE_REGISTER_UPSTREAM } from '../models/api-v1.model';

export const UPSTREAM_PROFILE_SUMMARY =
  'An upstream profile names the Caddy routes (and optional ports) that should receive backend dials for a discovery group. Automation calls one endpoint with a private_ip instead of repeating config_id for every route.';

export const DOMAIN_PROFILE_SUMMARY =
  'A domain profile names the Caddy routes (and optional match_indexes) that should receive hostnames for a discovery group. Automation passes domains[] once and each hostname is applied to every binding in the profile.';

export const UPSTREAM_PROFILE_SCENARIO =
  'When a new instance joins a discovery group (for example after autoscaling), a provisioning script can register it with a single machine-to-machine call. The profile expands that private_ip into dials on every bound route — for example @frontend:80 and @api:8080 — without the caller knowing each config_id.';

export const DOMAIN_PROFILE_SCENARIO =
  'When onboarding a tenant or customer hostname, automation can register every domain against all routes in the profile at once — for example adding acme.example.com to @sites and @tls-policy — without sending config_id on each request.';

export const UPSTREAM_PROFILE_WHAT_BULLETS = [
  'Bindings: Caddy route config_id plus optional port per row.',
  'Scoped to one discovery group (the rule you open Profiles on).',
  `API keys need scope ${API_KEY_SCOPE_REGISTER_UPSTREAM} and may restrict allowed_upstream_profile_ids.`
] as const;

export const DOMAIN_PROFILE_WHAT_BULLETS = [
  'Bindings: Caddy route config_id plus optional match_indexes per row.',
  'Scoped to one discovery group (the rule you open Profiles on).',
  `API keys need scope ${API_KEY_SCOPE_REGISTER_DOMAIN} and may restrict allowed_domain_profile_ids.`
] as const;

export const UPSTREAM_PROFILE_EXAMPLE_DEFINITION =
  'Profile web-stack: bindings @frontend:80, @api:8080 → registers 10.0.0.42:80 and 10.0.0.42:8080 from one private_ip.';

export const DOMAIN_PROFILE_EXAMPLE_DEFINITION =
  'Profile customer-sites: bindings @sites[0], @tls-policy → adds each domain in domains[] to both routes.';

export const UPSTREAM_BINDING_HINT =
  'Each row is a Caddy route (config_id) and optional port used when expanding a private_ip into a dial.';

export const DOMAIN_BINDING_HINT =
  'Each row is a Caddy route (config_id) and optional match_indexes for which host matcher to update.';

export const UPSTREAM_PROFILE_CURL_INTRO =
  'Registers backend dials on every binding in the profile from a single private_ip.';

export const DOMAIN_PROFILE_CURL_INTRO =
  'Adds every domain in domains[] to every binding in the profile.';

export const DISCOVERY_PROFILES_SIDEBAR_ITEM =
  'Profiles group repeated machine-to-machine register parameters per discovery rule. Open Profiles on a rule to configure upstream (dial) and domain (hostname) templates.';

export const UPSTREAM_PROFILE_API_KEYS_RESTRICT_NOTE =
  'Leave empty to allow any upstream profile on the selected discovery groups.';

export const DOMAIN_PROFILE_API_KEYS_RESTRICT_NOTE =
  'Leave empty to allow any domain profile on the selected discovery groups.';

const DEFAULT_UPSTREAM_PROFILE_ID = '<upstream-profile-id>';
const DEFAULT_DOMAIN_PROFILE_ID = '<domain-profile-id>';

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export function exampleUpstreamProfileCurl(
  baseUrl: string,
  profileId = DEFAULT_UPSTREAM_PROFILE_ID,
  secret = 'cdk_live_…'
): string {
  const base = normalizeApiBase(baseUrl);
  return `curl -X POST "${base}/upstream-profiles/${profileId}/register" \\
  -H "Authorization: ${secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"private_ip":"10.0.0.42"}'`;
}

export function exampleDomainProfileCurl(
  baseUrl: string,
  profileId = DEFAULT_DOMAIN_PROFILE_ID,
  secret = 'cdk_live_…'
): string {
  const base = normalizeApiBase(baseUrl);
  return `curl -X POST "${base}/domain-profiles/${profileId}/register" \\
  -H "Authorization: ${secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"domains":["acme.example.com"]}'`;
}
