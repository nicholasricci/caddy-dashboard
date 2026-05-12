import { normalizeNodeRows, normalizeDiscoveryRows, normalizeSnapshotRows } from './api-list-normalize.util';

describe('api-list-normalize.util', () => {
  it('normalizeNodeRows unwraps items', () => {
    expect(normalizeNodeRows({ items: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
  });

  it('normalizeDiscoveryRows unwraps discovery', () => {
    expect(normalizeDiscoveryRows({ discovery: [{ id: 'd1' }] })).toEqual([{ id: 'd1' }]);
  });

  it('normalizeSnapshotRows unwraps snapshots', () => {
    expect(normalizeSnapshotRows({ snapshots: [{ id: 's1' }] })).toEqual([{ id: 's1' }]);
  });
});
