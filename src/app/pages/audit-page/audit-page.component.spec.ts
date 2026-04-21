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

  it('renders title and loads audit entries', async () => {
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${apiBase}/audit`);
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [
        {
          id: 'a1',
          actor: 'admin',
          action: 'update',
          resource: 'discovery',
          resource_id: 'disc-1',
          payload: {
            name: 'eu-south-1-Project-Caddy (MAIN)',
            region: 'eu-south-1',
            snapshot_scope: 'group',
            enabled: true
          },
          created_at: '2026-04-20T11:23:17.851+02:00'
        }
      ],
      meta: { total: 1, limit: 20, offset: 0 }
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Audit log');
    expect(root.textContent).toContain('discovery');
    expect(root.textContent).toContain('admin');
    expect(root.textContent).toContain('disc-1');
    expect(root.textContent).toContain('eu-south-1-Project-Caddy (MAIN)');
    expect(root.textContent).toContain('Payload JSON');
  });
});
