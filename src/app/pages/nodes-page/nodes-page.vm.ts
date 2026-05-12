import type {
  CaddyNodeV1,
  CaddyTransportV1,
  CreateNodeRequestV1,
  DiscoveryConfigV1,
  SnapshotScopeV1
} from '../../models/api-v1.model';
import { normalizeCaddyTransport } from '../../core/caddy-node-transport.util';

export { normalizeCaddyTransport } from '../../core/caddy-node-transport.util';

/** Row model for the nodes table — decouples UI from optional API fields. */
export interface NodeListItemVm {
  id: string;
  name: string;
  status: string;
  private_ip: string;
  instance_id: string;
  discovery_config_id: string;
  region: string;
  /** @deprecated Legacy display; prefer `transport`. */
  ssm_enabled: boolean;
  transport: CaddyTransportV1;
}

export interface DiscoveryGroupVm {
  id: string;
  name: string;
  method: string;
  region: string;
  enabled: boolean;
  snapshot_scope: SnapshotScopeV1;
  nodes: NodeListItemVm[];
  isUnassigned: boolean;
}

export function mapCaddyNodeV1ToListItem(dto: CaddyNodeV1): NodeListItemVm {
  const transport = normalizeCaddyTransport(dto);
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    status: dto.status ?? 'unknown',
    private_ip: dto.private_ip ?? '',
    instance_id: dto.instance_id ?? '',
    discovery_config_id: dto.discovery_config_id ?? '',
    region: dto.region ?? '',
    ssm_enabled: transport === 'aws_ssm' && dto.ssm_enabled !== false,
    transport
  };
}

export function buildDiscoveryGroups(nodes: NodeListItemVm[], configs: DiscoveryConfigV1[]): DiscoveryGroupVm[] {
  const knownConfigIds = new Set(configs.map(config => config.id ?? '').filter(id => id.length > 0));
  const grouped = new Map<string, NodeListItemVm[]>();
  for (const node of nodes) {
    const configId = node.discovery_config_id.trim();
    if (!configId) {
      continue;
    }
    const current = grouped.get(configId);
    if (current) {
      current.push(node);
    } else {
      grouped.set(configId, [node]);
    }
  }

  const groups: DiscoveryGroupVm[] = configs.map(config => {
    const id = config.id ?? '';
    const configName = config.name?.trim();
    return {
      id,
      name: configName && configName.length > 0 ? configName : (id || 'Unnamed discovery rule'),
      method: config.method ?? 'unknown',
      region: config.region ?? '',
      enabled: config.enabled !== false,
      snapshot_scope: config.snapshot_scope === 'group' ? 'group' : 'node',
      nodes: (grouped.get(id) ?? []).slice(),
      isUnassigned: false
    };
  });

  const unassignedNodes = nodes.filter(node => {
    const configId = node.discovery_config_id.trim();
    return !configId || !knownConfigIds.has(configId);
  });

  groups.sort((a, b) => {
    if (a.enabled !== b.enabled) {
      return a.enabled ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  if (unassignedNodes.length > 0) {
    groups.push({
      id: 'manual-unassigned',
      name: 'Manual / unassigned',
      method: 'manual',
      region: '',
      enabled: true,
      snapshot_scope: 'node',
      nodes: unassignedNodes,
      isUnassigned: true
    });
  }

  return groups;
}

/** Create-modal draft — maps to `CreateNodeRequestV1`. */
export interface NodeCreateDraftVm {
  name: string;
  transport: CaddyTransportV1;
  private_ip: string;
  instance_id: string;
  region: string;
  ssh_user: string;
  ssh_private_key_ref: string;
  ssh_host: string;
  ssh_private_ip: string;
  http_base_url: string;
}

export function mapNodeCreateDraftToPayload(draft: NodeCreateDraftVm): CreateNodeRequestV1 {
  const name = draft.name.trim();
  const transport = draft.transport;
  const body: CreateNodeRequestV1 = { name, transport };

  const pip = draft.private_ip.trim();
  if (pip) {
    body.private_ip = pip;
  }
  const iid = draft.instance_id.trim();
  if (iid) {
    body.instance_id = iid;
  }

  if (transport === 'aws_ssm') {
    const region = draft.region.trim();
    if (region) {
      body.region = region;
    }
    body.transport_config = {};
  } else if (transport === 'ssh') {
    const cfg: Record<string, unknown> = {};
    const user = draft.ssh_user.trim();
    const pk = draft.ssh_private_key_ref.trim();
    const host = draft.ssh_host.trim();
    const sip = draft.ssh_private_ip.trim();
    if (user) {
      cfg['user'] = user;
    }
    if (pk) {
      cfg['private_key_ref'] = pk;
    }
    if (host) {
      cfg['host'] = host;
    }
    if (sip) {
      cfg['private_ip'] = sip;
    }
    body.transport_config = cfg;
  } else if (transport === 'http_admin') {
    const baseUrl = draft.http_base_url.trim();
    body.transport_config = baseUrl ? { base_url: baseUrl } : {};
  } else {
    body.transport_config = {};
  }

  return body;
}

export function defaultNodeCreateDraft(): NodeCreateDraftVm {
  return {
    name: '',
    transport: 'aws_ssm',
    private_ip: '',
    instance_id: '',
    region: '',
    ssh_user: '',
    ssh_private_key_ref: '',
    ssh_host: '',
    ssh_private_ip: '',
    http_base_url: ''
  };
}
