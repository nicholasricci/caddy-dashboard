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
});
