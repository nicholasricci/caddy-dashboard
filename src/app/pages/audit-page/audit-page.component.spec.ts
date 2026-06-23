import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { AuditPageComponent } from './audit-page.component';
import { DashboardApiService } from '../../services/dashboard-api.service';

describe('AuditPageComponent', () => {
  const auditListResponse = {
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
  };

  const auditTypesResponse = {
    actions: ['create', 'update', 'sync'],
    resources: ['node', 'discovery', 'user']
  };

  let listAuditLogs: jasmine.Spy;
  let listAuditTypes: jasmine.Spy;

  beforeEach(async () => {
    listAuditLogs = jasmine.createSpy('listAuditLogs').and.returnValue(of(auditListResponse));
    listAuditTypes = jasmine.createSpy('listAuditTypes').and.returnValue(of(auditTypesResponse));

    await TestBed.configureTestingModule({
      imports: [AuditPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DashboardApiService,
          useValue: { listAuditLogs, listAuditTypes }
        }
      ]
    }).compileComponents();
  });

  it('renders title and loads audit types and entries', async () => {
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listAuditTypes).toHaveBeenCalled();
    expect(listAuditLogs).toHaveBeenCalledWith({ limit: 20, offset: 0 });

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Audit log');
    expect(root.textContent).toContain('discovery');
    expect(root.textContent).toContain('admin');
    expect(root.textContent).toContain('disc-1');
    expect(root.textContent).toContain('eu-south-1-Project-Caddy (MAIN)');
    expect(root.textContent).toContain('Payload JSON');
    expect(root.textContent).toContain('create');
    expect(root.textContent).toContain('node');
  });

  it('applies filters and resets offset to zero', async () => {
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    listAuditLogs.calls.reset();
    listAuditLogs.and.returnValue(of({ items: [], meta: { total: 0, limit: 20, offset: 0 } }));

    const component = fixture.componentInstance;
    component.setDraftField('action', 'sync');
    component.setDraftField('resource', 'node');
    component.applyFilters();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listAuditLogs).toHaveBeenCalledWith({
      action: 'sync',
      resource: 'node',
      limit: 20,
      offset: 0
    });
    expect(fixture.nativeElement.textContent).toContain('No audit entries match the current filters.');
  });

  it('requests the next page using server offset', async () => {
    listAuditLogs.and.returnValue(
      of({
        items: auditListResponse.items,
        meta: { total: 40, limit: 20, offset: 0 }
      })
    );

    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    listAuditLogs.calls.reset();
    listAuditLogs.and.returnValue(
      of({
        items: auditListResponse.items,
        meta: { total: 40, limit: 20, offset: 20 }
      })
    );

    fixture.componentInstance.nextPage();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listAuditLogs).toHaveBeenCalledWith({
      limit: 20,
      offset: 20
    });
    expect(fixture.nativeElement.textContent).toContain('Showing 21–21 of 40');
  });
});
