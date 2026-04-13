import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['waitForInitialization', 'getCurrentUser']);
    auth.waitForInitialization.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: auth }]
    });
    router = TestBed.inject(Router);
  });

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/admin/users' } as RouterStateSnapshot;

  it('returns UrlTree to home when not admin', async () => {
    auth.getCurrentUser.and.returnValue({
      id: '1',
      username: 'u',
      role: 'user',
      isAdmin: false
    });

    const result = await TestBed.runInInjectionContext(() => adminGuard(route, state));

    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('returns true when admin', async () => {
    auth.getCurrentUser.and.returnValue({
      id: '1',
      username: 'admin',
      role: 'admin',
      isAdmin: true
    });

    const result = await TestBed.runInInjectionContext(() => adminGuard(route, state));

    expect(result).toBe(true);
  });
});
