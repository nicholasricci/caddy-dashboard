import type { DiscoveryConfigV1 } from '../../models/api-v1.model';
import {
  buildDiscoveryGroups,
  mapCaddyNodeV1ToListItem,
  mapNodeCreateDraftToPayload,
  defaultNodeCreateDraft,
  type NodeListItemVm
} from './nodes-page.vm';

describe('mapCaddyNodeV1ToListItem', () => {
  it('normalizes empty transport to aws_ssm', () => {
    expect(mapCaddyNodeV1ToListItem({ id: '1' }).transport).toBe('aws_ssm');
  });

  it('preserves http_admin', () => {
    expect(mapCaddyNodeV1ToListItem({ id: '1', transport: 'http_admin' }).transport).toBe('http_admin');
  });
});

describe('mapNodeCreateDraftToPayload', () => {
  it('omits region for non-SSM transport', () => {
    const p = mapNodeCreateDraftToPayload({
      ...defaultNodeCreateDraft(),
      name: 'edge',
      transport: 'ssh',
      region: 'eu-west-1',
      ssh_user: 'ubuntu',
      ssh_private_key_ref: 'ref/pk',
      ssh_host: '10.0.0.5',
      ssh_private_ip: ''
    });
    expect(p.region).toBeUndefined();
    expect(p.transport).toBe('ssh');
    expect(p.transport_config).toEqual({
      user: 'ubuntu',
      private_key_ref: 'ref/pk',
      host: '10.0.0.5'
    });
  });

  it('includes region for aws_ssm', () => {
    const p = mapNodeCreateDraftToPayload({
      ...defaultNodeCreateDraft(),
      name: 'edge',
      transport: 'aws_ssm',
      region: 'eu-south-1'
    });
    expect(p.region).toBe('eu-south-1');
    expect(p.transport_config).toEqual({});
  });
});

describe('buildDiscoveryGroups', () => {
  it('groups nodes by discovery config and appends unassigned last', () => {
    const nodes: NodeListItemVm[] = [
      {
        id: 'n1',
        name: 'node-1',
        status: 'online',
        private_ip: '10.0.0.1',
        instance_id: 'i-1',
        discovery_config_id: 'd-enabled',
        region: 'eu-west-1',
        ssm_enabled: true,
        transport: 'aws_ssm'
      },
      {
        id: 'n2',
        name: 'node-2',
        status: 'online',
        private_ip: '10.0.0.2',
        instance_id: 'i-2',
        discovery_config_id: '',
        region: 'eu-west-1',
        ssm_enabled: true,
        transport: 'aws_ssm'
      },
      {
        id: 'n3',
        name: 'node-3',
        status: 'offline',
        private_ip: '10.0.0.3',
        instance_id: 'i-3',
        discovery_config_id: 'missing',
        region: 'eu-west-1',
        ssm_enabled: false,
        transport: 'ssh'
      }
    ];
    const configs: DiscoveryConfigV1[] = [
      { id: 'd-disabled', name: 'Disabled', enabled: false, method: 'aws_tag', snapshot_scope: 'group' },
      { id: 'd-enabled', name: 'Enabled', enabled: true, method: 'aws_ssm', snapshot_scope: 'node' }
    ];

    const groups = buildDiscoveryGroups(nodes, configs);

    expect(groups.map(group => group.id)).toEqual(['d-enabled', 'd-disabled', 'manual-unassigned']);
    expect(groups[0].nodes.map(node => node.id)).toEqual(['n1']);
    expect(groups[1].nodes).toEqual([]);
    expect(groups[2].isUnassigned).toBeTrue();
    expect(groups[2].nodes.map(node => node.id)).toEqual(['n2', 'n3']);
  });
});
