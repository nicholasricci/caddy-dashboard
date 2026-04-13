import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { App } from './app';
import { routes } from './app.routes';

describe('App routing (integration)', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [provideZonelessChangeDetection(), provideRouter(routes)]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('redirects unauthenticated user from / to /login', async () => {
    localStorage.clear();
    await router.navigate(['']);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/login');
  });

  it('navigates to login path', async () => {
    await router.navigate(['/login']);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/login');
  });
});
