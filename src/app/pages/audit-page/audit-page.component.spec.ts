import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuditPageComponent } from './audit-page.component';

describe('AuditPageComponent', () => {
  const apiBase = environment.apiUrl.replace(/\/$/, '');
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditPageComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders title and loads audit entries', () => {
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${apiBase}/audit`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'a1', actor: 'admin', action: 'user.create', target: 'user/bob' }]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Audit log');
    expect(root.textContent).toContain('user.create');
    expect(root.textContent).toContain('admin');
  });
});
