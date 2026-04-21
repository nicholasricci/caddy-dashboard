import { ConfigEditStore } from './config-edit.store';

describe('ConfigEditStore', () => {
  let store: ConfigEditStore;

  beforeEach(() => {
    store = new ConfigEditStore();
    store.setConfig({
      apps: {
        http: {
          servers: {
            srv0: {
              listen: [':443'],
              routes: [
                {
                  handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] }]
                }
              ]
            }
          }
        }
      }
    });
  });

  it('updates nested values immutably', () => {
    store.updateAt(['apps', 'http', 'servers', 'srv0', 'listen', 0], () => ':8443');

    expect(store.readAt(['apps', 'http', 'servers', 'srv0', 'listen', 0])).toBe(':8443');
  });

  it('inserts and removes array elements', () => {
    store.insertAt(['apps', 'http', 'servers', 'srv0', 'routes'], { terminal: true });
    expect(store.readAt(['apps', 'http', 'servers', 'srv0', 'routes'])).toEqual([
      { handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] }] },
      { terminal: true }
    ]);

    store.removeAt(['apps', 'http', 'servers', 'srv0', 'routes', 0]);
    expect(store.readAt(['apps', 'http', 'servers', 'srv0', 'routes'])).toEqual([{ terminal: true }]);
  });

  it('roundtrips hydrate and serialize', () => {
    const text = store.serialize();
    const result = store.hydrate(text);

    expect(result.ok).toBeTrue();
    expect(store.parseError()).toBeNull();
    expect(store.readAt(['apps', 'http', 'servers', 'srv0', 'listen', 0])).toBe(':443');
  });

  it('tracks parse errors for invalid json', () => {
    const result = store.hydrate('{"apps":');

    expect(result.ok).toBeFalse();
    expect(store.parseError()).toBe('Invalid JSON.');
  });
});
