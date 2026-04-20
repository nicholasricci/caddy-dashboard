import type { CaddyNodeV1, DiscoveryConfigV1, SnapshotScopeV1 } from '../../models/api-v1.model';

/** Row model for the nodes table — decouples UI from optional API fields. */
export interface NodeListItemVm {
  id: string;
  name: string;
  status: string;
  private_ip: string;
  instance_id: string;
  discovery_config_id: string;
  region: string;
  ssm_enabled: boolean;
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
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    status: dto.status ?? 'unknown',
    private_ip: dto.private_ip ?? '',
    instance_id: dto.instance_id ?? '',
    discovery_config_id: dto.discovery_config_id ?? '',
    region: dto.region ?? '',
    ssm_enabled: !!dto.ssm_enabled
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

/** Create-modal draft — same shape as API body, explicit for forms. */
export interface NodeCreateDraftVm {
  name: string;
  private_ip: string;
  instance_id: string;
  region: string;
  ssm_enabled: boolean;
}

export function mapNodeCreateDraftToPayload(draft: NodeCreateDraftVm): CaddyNodeV1 {
  return { ...draft };
}

export function defaultNodeCreateDraft(): NodeCreateDraftVm {
  return {
    name: '',
    private_ip: '',
    instance_id: '',
    region: '',
    ssm_enabled: true
  };
}
