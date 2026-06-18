import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type {
  RegisterDomainProfileResponseV1,
  RegisterUpstreamProfileResponseV1,
  RegisterUpstreamResponseV1
} from '../../models/api-v1.model';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { UpstreamProfilesApiService } from '../../services/api/upstream-profiles-api.service';
import { DomainProfilesApiService } from '../../services/api/domain-profiles-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ApiPlaygroundPageComponent } from './api-playground-page.component';

describe('ApiPlaygroundPageComponent', () => {
  let fixture: ComponentFixture<ApiPlaygroundPageComponent>;
  let component: ApiPlaygroundPageComponent;
  let discoveryApi: jasmine.SpyObj<DiscoveryApiService>;
  let upstreamProfilesApi: jasmine.SpyObj<UpstreamProfilesApiService>;
  let domainProfilesApi: jasmine.SpyObj<DomainProfilesApiService>;
  let confirmAsk: jasmine.Spy;

  const previewResponse: RegisterUpstreamResponseV1 = {
    changed: false,
    dry_run: true,
    dial: '10.0.0.5:8080'
  };

  const profilePreviewResponse: RegisterUpstreamProfileResponseV1 = {
    changed: false,
    dry_run: true,
    upstream_profile_id: 'prof-1'
  };

  const domainPreviewResponse: RegisterDomainProfileResponseV1 = {
    changed: false,
    dry_run: true,
    domain_profile_id: 'dprof-1'
  };

  beforeEach(async () => {
    confirmAsk = jasmine.createSpy('ask').and.resolveTo(true);
    discoveryApi = jasmine.createSpyObj<DiscoveryApiService>('DiscoveryApiService', [
      'listDiscovery',
      'registerUpstream',
      'registerDomain'
    ]);
    upstreamProfilesApi = jasmine.createSpyObj<UpstreamProfilesApiService>('UpstreamProfilesApiService', [
      'listForDiscovery',
      'registerByProfile'
    ]);
    domainProfilesApi = jasmine.createSpyObj<DomainProfilesApiService>('DomainProfilesApiService', [
      'listForDiscovery',
      'registerByProfile'
    ]);
    discoveryApi.listDiscovery.and.returnValue(of([{ id: 'disc-1', name: 'prod-group' }]));
    discoveryApi.registerUpstream.and.returnValue(of(previewResponse));
    discoveryApi.registerDomain.and.returnValue(of({ changed: false, dry_run: true }));
    upstreamProfilesApi.listForDiscovery.and.returnValue(
      of([{ id: 'prof-1', name: 'web-stack', discovery_config_id: 'disc-1' }])
    );
    upstreamProfilesApi.registerByProfile.and.returnValue(of(profilePreviewResponse));
    domainProfilesApi.listForDiscovery.and.returnValue(
      of([{ id: 'dprof-1', name: 'tenant-routes', discovery_config_id: 'disc-1' }])
    );
    domainProfilesApi.registerByProfile.and.returnValue(of(domainPreviewResponse));

    await TestBed.configureTestingModule({
      imports: [ApiPlaygroundPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DiscoveryApiService, useValue: discoveryApi },
        { provide: UpstreamProfilesApiService, useValue: upstreamProfilesApi },
        { provide: DomainProfilesApiService, useValue: domainProfilesApi },
        { provide: ConfirmService, useValue: { ask: confirmAsk } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApiPlaygroundPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillRegisterUpstreamForm(): void {
    component.form.patchValue({
      operation: 'register_upstream',
      apiKeySecret: 'cdk_live_test',
      upstreamDiscoveryId: 'disc-1',
      configId: '@route-main',
      targetMode: 'dial',
      dial: '10.0.0.5:8080'
    });
  }

  function fillProfileFormPasted(): void {
    component.form.patchValue({
      operation: 'register_upstream_by_profile',
      apiKeySecret: 'cdk_live_test',
      profileId: 'prof-pasted',
      profilePrivateIp: '10.0.0.5'
    });
  }

  it('renders playground title', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('API playground');
  });

  it('preview calls registerUpstream with dry_run true', async () => {
    await fixture.whenStable();
    fillRegisterUpstreamForm();
    component.preview();
    await fixture.whenStable();

    expect(discoveryApi.registerUpstream).toHaveBeenCalledWith(
      'disc-1',
      'cdk_live_test',
      jasmine.objectContaining({
        config_id: '@route-main',
        dial: '10.0.0.5:8080',
        dry_run: true
      })
    );
    expect(component.result()?.kind).toBe('preview');
  });

  it('send calls registerUpstream with dry_run false after confirm', async () => {
    await fixture.whenStable();
    fillRegisterUpstreamForm();
    component.preview();
    await fixture.whenStable();

    discoveryApi.registerUpstream.calls.reset();
    discoveryApi.registerUpstream.and.returnValue(of({ ...previewResponse, dry_run: false, changed: true }));

    await component.send();
    await fixture.whenStable();

    expect(confirmAsk).toHaveBeenCalled();
    expect(discoveryApi.registerUpstream).toHaveBeenCalledWith(
      'disc-1',
      'cdk_live_test',
      jasmine.objectContaining({ dry_run: false })
    );
    expect(component.result()?.kind).toBe('applied');
  });

  it('profile preview works with pasted profile ID and no discovery helper', async () => {
    await fixture.whenStable();
    fillProfileFormPasted();
    component.preview();
    await fixture.whenStable();

    expect(upstreamProfilesApi.listForDiscovery).not.toHaveBeenCalled();
    expect(upstreamProfilesApi.registerByProfile).toHaveBeenCalledWith(
      'prof-pasted',
      'cdk_live_test',
      jasmine.objectContaining({ private_ip: '10.0.0.5', dry_run: true })
    );
    expect(component.result()?.kind).toBe('preview');
  });

  it('profile picker sets profileId text input', async () => {
    await fixture.whenStable();
    component.form.patchValue({
      operation: 'register_upstream_by_profile',
      apiKeySecret: 'cdk_live_test',
      profileDiscoveryHelperId: 'disc-1',
      profilePrivateIp: '10.0.0.5'
    });
    await fixture.whenStable();

    component.form.controls.profilePicker.setValue('prof-1');
    component.applyProfilePick();

    expect(component.form.controls.profileId.value).toBe('prof-1');
  });

  it('updates visible fields when operation changes', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#playground-config-id')).not.toBeNull();
    expect(root.querySelector('#playground-profile-id')).toBeNull();

    component.form.controls.operation.setValue('register_upstream_by_profile');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('#playground-profile-id')).not.toBeNull();
    expect(root.querySelector('#playground-config-id')).toBeNull();
  });

  it('switching operation clears inactive branch fields', async () => {
    await fixture.whenStable();
    fillRegisterUpstreamForm();
    component.form.controls.operation.setValue('register_upstream_by_profile');
    await fixture.whenStable();

    expect(component.form.controls.upstreamDiscoveryId.value).toBe('');
    expect(component.form.controls.configId.value).toBe('');
    expect(component.form.controls.dial.value).toBe('');

    component.form.patchValue({
      profileId: 'prof-1',
      profilePrivateIp: '10.0.0.9'
    });
    component.form.controls.operation.setValue('register_upstream');
    await fixture.whenStable();

    expect(component.form.controls.profileId.value).toBe('');
    expect(component.form.controls.profilePrivateIp.value).toBe('');
  });

  it('domain preview calls registerDomain with dry_run true', async () => {
    await fixture.whenStable();
    component.form.patchValue({
      operation: 'register_domain',
      apiKeySecret: 'cdk_live_test',
      domainDiscoveryId: 'disc-1',
      domainConfigId: '@route-main',
      domainList: 'app.example.com'
    });
    component.preview();
    await fixture.whenStable();

    expect(discoveryApi.registerDomain).toHaveBeenCalledWith(
      'disc-1',
      'cdk_live_test',
      jasmine.objectContaining({
        config_id: '@route-main',
        domains: ['app.example.com'],
        dry_run: true
      })
    );
  });

  it('domain profile preview calls registerByProfile with domains', async () => {
    await fixture.whenStable();
    component.form.patchValue({
      operation: 'register_domain_by_profile',
      apiKeySecret: 'cdk_live_test',
      domainProfileId: 'dprof-1',
      domainList: 'tenant.example.com'
    });
    component.preview();
    await fixture.whenStable();

    expect(domainProfilesApi.registerByProfile).toHaveBeenCalledWith(
      'dprof-1',
      'cdk_live_test',
      jasmine.objectContaining({ domains: ['tenant.example.com'], dry_run: true })
    );
  });
});
