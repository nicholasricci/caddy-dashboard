import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiKeysApiService, normalizeApiKeys } from './api-keys-api.service';
import { environment } from '../../../environments/environment';
import { API_KEY_SCOPE_REGISTER_UPSTREAM } from '../../models/api-v1.model';

describe('normalizeApiKeys', () => {
  it('returns items array from wrapper', () => {
    const keys = [{ id: 'k1', name: 'test' }];
    expect(normalizeApiKeys({ items: keys })).toEqual(keys);
  });

  it('returns empty array for invalid body', () => {
    expect(normalizeApiKeys(null)).toEqual([]);
    expect(normalizeApiKeys({ api_keys: [] })).toEqual([]);
    expect(normalizeApiKeys([])).toEqual([]);
  });
});

describe('ApiKeysApiService', () => {
  let service: ApiKeysApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiKeysApiService
      ]
    });
    service = TestBed.inject(ApiKeysApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listApiKeys GETs /api-keys and normalizes items', done => {
    service.listApiKeys().subscribe({
      next: keys => {
        expect(keys.length).toBe(1);
        expect(keys[0].name).toBe('myapp');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/api-keys`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 'k1', name: 'myapp' }] });
  });

  it('createApiKey POSTs /api-keys', done => {
    const body = {
      name: 'ci',
      scopes: [API_KEY_SCOPE_REGISTER_UPSTREAM],
      allowed_discovery_config_ids: ['disc-1']
    };
    service.createApiKey(body).subscribe({
      next: res => {
        expect(res.secret).toBe('cdk_live_secret');
        expect(res.api_key.id).toBe('k1');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/api-keys`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ api_key: { id: 'k1' }, secret: 'cdk_live_secret' });
  });

  it('revokeApiKey POSTs /api-keys/:id/revoke', done => {
    service.revokeApiKey('key-1').subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/api-keys/key-1/revoke`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deleteApiKey DELETEs /api-keys/:id', done => {
    service.deleteApiKey('key-2').subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/api-keys/key-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
