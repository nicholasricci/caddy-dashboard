import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuditApiService } from './audit-api.service';

describe('AuditApiService', () => {
  let service: AuditApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), AuditApiService]
    });
    service = TestBed.inject(AuditApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listAuditLogs GETs /audit without params when filter is omitted', done => {
    service.listAuditLogs().subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/audit`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ items: [], meta: { total: 0, limit: 20, offset: 0 } });
  });

  it('listAuditLogs serializes filter query params and trims actor', done => {
    service
      .listAuditLogs({
        action: 'sync',
        resource: 'node',
        actor: '  admin  ',
        resource_id: 'node-1',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        limit: 10,
        offset: 20
      })
      .subscribe({
        next: () => done(),
        error: done.fail
      });

    const req = httpMock.expectOne(
      r =>
        r.url === `${apiBase}/audit` &&
        r.params.get('action') === 'sync' &&
        r.params.get('resource') === 'node' &&
        r.params.get('actor') === 'admin' &&
        r.params.get('resource_id') === 'node-1' &&
        r.params.get('from') === '2024-01-01T00:00:00Z' &&
        r.params.get('to') === '2024-12-31T23:59:59Z' &&
        r.params.get('limit') === '10' &&
        r.params.get('offset') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], meta: { total: 0, limit: 10, offset: 20 } });
  });

  it('listAuditLogs omits blank actor', done => {
    service.listAuditLogs({ actor: '   ', limit: 20, offset: 0 }).subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(r => r.url === `${apiBase}/audit`);
    expect(req.request.params.has('actor')).toBe(false);
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ items: [], meta: { total: 0, limit: 20, offset: 0 } });
  });

  it('listAuditTypes GETs /audit/types', done => {
    service.listAuditTypes().subscribe({
      next: res => {
        expect(res.actions).toEqual(['create', 'update']);
        expect(res.resources).toEqual(['node', 'user']);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/audit/types`);
    expect(req.request.method).toBe('GET');
    req.flush({ actions: ['create', 'update'], resources: ['node', 'user'] });
  });
});
