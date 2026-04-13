import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'waitForInitialization',
      'getToken',
      'getCurrentUser'
    ]);
    auth.waitForInitialization.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'login', children: [] }]),
        { provide: AuthService, useValue: auth }
      ]
    });
    router = TestBed.inject(Router);
  });

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/' } as RouterStateSnapshot;

  it('returns UrlTree to login when unauthenticated', async () => {
    auth.getToken.and.returnValue(null);
    auth.getCurrentUser.and.returnValue(null);

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toEqual(router.createUrlTree(['/login']));
  });

  it('returns true when token and user present', async () => {
    auth.getToken.and.returnValue('tok');
    auth.getCurrentUser.and.returnValue({
      id: '1',
      username: 'u',
      role: 'user',
      isAdmin: false
    });

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });
});
