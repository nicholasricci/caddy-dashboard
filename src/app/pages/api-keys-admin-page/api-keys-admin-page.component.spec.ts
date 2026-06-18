import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { API_KEY_SCOPE_REGISTER_UPSTREAM, type DiscoveryConfigV1 } from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ApiKeysAdminPageComponent } from './api-keys-admin-page.component';

describe('ApiKeysAdminPageComponent', () => {
  let fixture: ComponentFixture<ApiKeysAdminPageComponent>;
  let component: ApiKeysAdminPageComponent;
  let api: jasmine.SpyObj<DashboardApiService>;
  let confirmAsk: jasmine.Spy;

  beforeEach(async () => {
    confirmAsk = jasmine.createSpy('ask').and.resolveTo(true);
    api = jasmine.createSpyObj<DashboardApiService>('DashboardApiService', [
      'listApiKeys',
      'listDiscovery',
      'createApiKey',
      'revokeApiKey',
      'deleteApiKey'
    ]);
    api.listApiKeys.and.returnValue(
      of([
        {
          id: 'k1',
          name: 'ci-prod',
          key_prefix: 'cdk_live_abc',
          scopes: [API_KEY_SCOPE_REGISTER_UPSTREAM],
          allowed_discovery_config_ids: ['disc-1']
        }
      ])
    );
    api.listDiscovery.and.returnValue(of([{ id: 'disc-1', name: 'prod-group', method: 'aws_ssm' }]));
    api.createApiKey.and.returnValue(
      of({
        api_key: { id: 'k2', name: 'new-key' },
        secret: 'cdk_live_once_only'
      })
    );
    api.revokeApiKey.and.returnValue(of(void 0));
    api.deleteApiKey.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ApiKeysAdminPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApiService, useValue: api },
        { provide: ConfirmService, useValue: { ask: confirmAsk } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApiKeysAdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders discovery labels when listDiscovery returns wrapped items', async () => {
    api.listDiscovery.and.returnValue(
      of({ items: [{ id: 'disc-1', name: 'prod-group' }] } as unknown as DiscoveryConfigV1[])
    );

    fixture = TestBed.createComponent(ApiKeysAdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('prod-group');
  });

  it('renders title and discovery group labels', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('API keys');
    expect(root.textContent).toContain('ci-prod');
    expect(root.textContent).toContain('prod-group');
    expect(root.textContent).toContain(API_KEY_SCOPE_REGISTER_UPSTREAM);
  });

  it('create opens secret reveal modal', async () => {
    await fixture.whenStable();

    component.openCreate();
    component.selectedDiscoveryIds.set(new Set(['disc-1']));
    component.keyForm.patchValue({ name: 'new-key', scopesText: API_KEY_SCOPE_REGISTER_UPSTREAM });
    component.create();

    expect(api.createApiKey).toHaveBeenCalledWith({
      name: 'new-key',
      scopes: [API_KEY_SCOPE_REGISTER_UPSTREAM],
      allowed_discovery_config_ids: ['disc-1'],
      expires_at: undefined
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.revealedSecret()?.secret).toBe('cdk_live_once_only');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('cdk_live_once_only');
    expect(root.textContent).toContain('register-upstream');
  });

  it('reload after revoke fetches API keys again', async () => {
    await fixture.whenStable();
    api.listApiKeys.calls.reset();

    await component.revoke({ id: 'k1', name: 'active-key' });
    await fixture.whenStable();

    expect(api.listApiKeys).toHaveBeenCalled();
  });

  it('revoke calls API after confirm', async () => {
    await fixture.whenStable();
    await component.revoke({ id: 'k1', name: 'active-key' });

    expect(confirmAsk).toHaveBeenCalled();
    expect(api.revokeApiKey).toHaveBeenCalledWith('k1');
  });

  it('delete calls API after confirm', async () => {
    await fixture.whenStable();
    await component.remove({ id: 'k9', name: 'old-key' });

    expect(confirmAsk).toHaveBeenCalled();
    expect(api.deleteApiKey).toHaveBeenCalledWith('k9');
  });
});
