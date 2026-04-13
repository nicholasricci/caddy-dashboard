import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { fakeAccessTokenPayload } from '../testing/jwt-test.helpers';

describe('AuthService', () => {
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), AuthService]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    const service = TestBed.inject(AuthService);
    expect(service).toBeTruthy();
  });

  it('login stores tokens and hydrates user from JWT', done => {
    const service = TestBed.inject(AuthService);
    const access = fakeAccessTokenPayload({ sub: 'u1', username: 'alice', role: 'admin' });
    service.login({ username: 'alice', password: 'secret' }).subscribe({
      next: () => {
        expect(service.getAccessToken()).toBe(access);
        expect(service.getCurrentUser()?.username).toBe('alice');
        expect(service.getCurrentUser()?.isAdmin).toBeTrue();
        done();
      },
      error: done.fail
    });
    const req = httpMock.expectOne(`${apiBase}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ access_token: access, refresh_token: 'rt1' });
  });

  it('refreshAccessToken uses single in-flight request when called concurrently', done => {
    const access1 = fakeAccessTokenPayload({ sub: '1', username: 'a' });
    localStorage.setItem('refresh_token', 'rt-shared');
    localStorage.setItem('access_token', access1);
    const service = TestBed.inject(AuthService);

    let completed = 0;
    const onComplete = () => {
      completed++;
      if (completed === 2) {
        expect(service.getAccessToken()).toBe(access2);
        done();
      }
    };

    const access2 = fakeAccessTokenPayload({ sub: '1', username: 'a', role: 'user' });
    service.refreshAccessToken().subscribe({ next: onComplete, error: done.fail });
    service.refreshAccessToken().subscribe({ next: onComplete, error: done.fail });

    const requests = httpMock.match(`${apiBase}/auth/refresh`);
    expect(requests.length).toBe(1);
    requests[0].flush({ access_token: access2, refresh_token: 'rt2' });
  });

  it('logout clears tokens from both storages', () => {
    const service = TestBed.inject(AuthService);
    localStorage.setItem('access_token', 'a');
    localStorage.setItem('refresh_token', 'r');
    sessionStorage.setItem('access_token', 'a2');
    sessionStorage.setItem('refresh_token', 'r2');
    service.logout();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
  });
});
