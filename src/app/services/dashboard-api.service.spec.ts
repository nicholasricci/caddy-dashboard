import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DashboardApiService } from './dashboard-api.service';
import { environment } from '../../environments/environment';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        DashboardApiService
      ]
    });
    service = TestBed.inject(DashboardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listNodes GETs /nodes', done => {
    service.listNodes().subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0].id).toBe('n1');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'n1', name: 'edge' }]);
  });

  it('health GETs /health', done => {
    service.health().subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/health`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
  });

  it('ready GETs /ready', done => {
    service.ready().subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/ready`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ready' });
  });

  it('syncConfig POSTs /nodes/:id/sync with empty body', done => {
    service.syncConfig('node-1').subscribe({
      next: () => done(),
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/sync`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ status: 'ok' });
  });

  it('listLiveConfigIds GETs /nodes/:id/config/live/ids', done => {
    service.listLiveConfigIds('node-1').subscribe({
      next: body => {
        expect(body.items?.length).toBe(1);
        expect(body.items?.[0].id).toBe('route/main');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/config/live/ids`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 'route/main', has_upstreams: true, upstream_count: 1, upstreams: [{ dial: '127.0.0.1:8080' }] }] });
  });

  it('getLiveConfigById GETs encoded /nodes/:id/config/live/ids/:configId', done => {
    service.getLiveConfigById('node-1', 'route/main').subscribe({
      next: body => {
        expect(body['handler']).toBe('reverse_proxy');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/config/live/ids/route%2Fmain`);
    expect(req.request.method).toBe('GET');
    req.flush({ handler: 'reverse_proxy' });
  });

  it('getLiveConfigUpstreams GETs encoded /nodes/:id/config/live/ids/:configId/upstreams', done => {
    service.getLiveConfigUpstreams('node-1', 'route/main').subscribe({
      next: body => {
        expect(body.has_upstreams).toBeTrue();
        expect(body.upstream_count).toBe(2);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/config/live/ids/route%2Fmain/upstreams`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'route/main',
      has_upstreams: true,
      upstream_count: 2,
      upstreams: [{ dial: '127.0.0.1:8080' }, { dial: '127.0.0.1:8081' }]
    });
  });

  it('getLiveConfigHosts GETs encoded /nodes/:id/config/live/ids/:configId/hosts', done => {
    service.getLiveConfigHosts('node-1', 'route/main').subscribe({
      next: body => {
        expect(body.host_count).toBe(2);
        expect(body.hosts).toEqual(['app.example.com', 'api.example.com']);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/config/live/ids/route%2Fmain/hosts`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'route/main',
      host_count: 2,
      hosts: ['app.example.com', 'api.example.com']
    });
  });

  it('listAuditLogs GETs /audit', done => {
    service.listAuditLogs().subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/audit`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'a1', action: 'user.update' }]);
  });

  it('listDiscoverySnapshots GETs /discovery/:id/snapshots', done => {
    service.listDiscoverySnapshots('disc-1').subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0]['id']).toBe('snap-1');
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/discovery/disc-1/snapshots`);
    expect(req.request.method).toBe('GET');
    req.flush({ snapshots: [{ id: 'snap-1' }] });
  });
});
