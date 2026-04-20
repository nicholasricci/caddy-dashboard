import type { DiscoveryConfigV1 } from '../../models/api-v1.model';
import { buildDiscoveryGroups, type NodeListItemVm } from './nodes-page.vm';

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
        ssm_enabled: true
      },
      {
        id: 'n2',
        name: 'node-2',
        status: 'online',
        private_ip: '10.0.0.2',
        instance_id: 'i-2',
        discovery_config_id: '',
        region: 'eu-west-1',
        ssm_enabled: true
      },
      {
        id: 'n3',
        name: 'node-3',
        status: 'offline',
        private_ip: '10.0.0.3',
        instance_id: 'i-3',
        discovery_config_id: 'missing',
        region: 'eu-west-1',
        ssm_enabled: false
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
