import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NodesApiService } from './nodes-api.service';
import { environment } from '../../../environments/environment';

describe('NodesApiService', () => {
  let service: NodesApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        NodesApiService
      ]
    });
    service = TestBed.inject(NodesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('mutateDomains POSTs /nodes/:id/config/mutate/domains', done => {
    const body = {
      dry_run: true,
      targets: [{ config_id: 'route/main', add_domains: ['a.example.com'] }]
    };
    service.mutateDomains('node-1', body).subscribe({
      next: res => {
        expect(res.changed).toBe(false);
        expect(res.dry_run).toBe(true);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-1/config/mutate/domains`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ changed: false, dry_run: true, diff: { added: ['a.example.com'] } });
  });

  it('mutateUpstreams POSTs /nodes/:id/config/mutate/upstreams with encoded config_id', done => {
    const body = {
      dry_run: false,
      targets: [{ config_id: 'route/special@id', add_dial: '127.0.0.1:8080' }]
    };
    service.mutateUpstreams('node-2', body).subscribe({
      next: res => {
        expect(res.changed).toBe(true);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-2/config/mutate/upstreams`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ changed: true, dry_run: false });
  });

  it('propagateConfig POSTs /nodes/:id/config/propagate with empty body', done => {
    service.propagateConfig('node-3').subscribe({
      next: res => {
        expect(res.source_node_id).toBe('node-3');
        expect(res.applied_to).toEqual(['peer-1']);
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/nodes/node-3/config/propagate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ source_node_id: 'node-3', applied_to: ['peer-1'], skipped: [] });
  });
});
