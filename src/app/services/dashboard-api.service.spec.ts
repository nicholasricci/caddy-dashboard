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
});
