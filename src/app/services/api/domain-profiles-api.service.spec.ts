import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import { authInterceptor } from '../auth.interceptor';
import { DomainProfilesApiService, normalizeDomainProfiles } from './domain-profiles-api.service';

describe('normalizeDomainProfiles', () => {
  it('returns array body as-is', () => {
    const profiles = [{ id: 'p1', name: 'web' }];
    expect(normalizeDomainProfiles(profiles)).toEqual(profiles);
  });

  it('returns items from wrapper', () => {
    const profiles = [{ id: 'p2' }];
    expect(normalizeDomainProfiles({ items: profiles })).toEqual(profiles);
  });

  it('returns empty array for invalid body', () => {
    expect(normalizeDomainProfiles(null)).toEqual([]);
    expect(normalizeDomainProfiles({})).toEqual([]);
  });
});

describe('DomainProfilesApiService', () => {
  let service: DomainProfilesApiService;
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
        DomainProfilesApiService
      ]
    });
    service = TestBed.inject(DomainProfilesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listForDiscovery GETs discovery-scoped profiles', done => {
    service.listForDiscovery('disc-1').subscribe({
      next: profiles => {
        expect(profiles.length).toBe(1);
        expect(profiles[0].name).toBe('web');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-1/domain-profiles`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 'p1', name: 'web' }] });
  });

  it('create POSTs to discovery-scoped path', done => {
    const body = { name: 'api', bindings: [{ config_id: '@route' }] };
    service.create('disc-1', body).subscribe({
      next: profile => {
        expect(profile.id).toBe('p1');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/discovery/disc-1/domain-profiles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'p1', name: 'api' });
  });

  it('registerByProfile POSTs with API key Authorization header', done => {
    const body = { domains: ['app.example.com'], dry_run: true };
    service.registerByProfile('p1', 'cdk_live_secret', body).subscribe({
      next: res => {
        expect(res.dry_run).toBe(true);
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/domain-profiles/p1/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('Authorization')).toBe('cdk_live_secret');
    req.flush({ changed: false, dry_run: true });
  });
});
