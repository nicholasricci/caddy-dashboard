import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, tap } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getAccessToken', 'refreshAccessToken']);
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: routerSpy },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds Authorization header when token exists', () => {
    auth.getAccessToken.and.returnValue('my-token');

    http.get(`${apiBase}/nodes`).subscribe();

    const req = httpMock.expectOne(`${apiBase}/nodes`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush([]);
  });

  it('on 401 refreshes and retries with new token', () => {
    let token = 'old';
    auth.getAccessToken.and.callFake(() => token);
    auth.refreshAccessToken.and.returnValue(
      of(undefined).pipe(
        tap(() => {
          token = 'new';
        })
      )
    );

    http.get(`${apiBase}/nodes`).subscribe();

    const first = httpMock.expectOne(`${apiBase}/nodes`);
    expect(first.request.headers.get('Authorization')).toBe('Bearer old');
    first.flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    const retry = httpMock.expectOne(`${apiBase}/nodes`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([]);
  });
});
