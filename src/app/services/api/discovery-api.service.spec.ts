import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import { authInterceptor } from '../auth.interceptor';
import { DiscoveryApiService } from './discovery-api.service';

describe('DiscoveryApiService', () => {
  let service: DiscoveryApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['getAccessToken']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        DiscoveryApiService
      ]
    });
    service = TestBed.inject(DiscoveryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('normalizes array snapshot responses', done => {
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
    req.flush([{ id: 'snap-1' }]);
  });

  it('normalizes object snapshot responses', done => {
    service.listDiscoverySnapshots('disc-2').subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0]['id']).toBe('snap-2');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-2/snapshots`);
    req.flush({ snapshots: [{ id: 'snap-2' }] });
  });

  it('registerUpstream POSTs with API key Authorization header', done => {
    const body = { config_id: '@route-main', dial: '10.0.0.5:8080', dry_run: true };
    service.registerUpstream('disc-1', 'cdk_live_secret', body).subscribe({
      next: res => {
        expect(res.dry_run).toBe(true);
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-1/register-upstream`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('Authorization')).toBe('cdk_live_secret');
    req.flush({ changed: false, dry_run: true });
  });
});
