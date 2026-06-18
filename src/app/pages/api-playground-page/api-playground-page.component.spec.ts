import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { RegisterUpstreamResponseV1 } from '../../models/api-v1.model';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ApiPlaygroundPageComponent } from './api-playground-page.component';

describe('ApiPlaygroundPageComponent', () => {
  let fixture: ComponentFixture<ApiPlaygroundPageComponent>;
  let component: ApiPlaygroundPageComponent;
  let discoveryApi: jasmine.SpyObj<DiscoveryApiService>;
  let confirmAsk: jasmine.Spy;

  const previewResponse: RegisterUpstreamResponseV1 = {
    changed: false,
    dry_run: true,
    dial: '10.0.0.5:8080'
  };

  beforeEach(async () => {
    confirmAsk = jasmine.createSpy('ask').and.resolveTo(true);
    discoveryApi = jasmine.createSpyObj<DiscoveryApiService>('DiscoveryApiService', [
      'listDiscovery',
      'registerUpstream'
    ]);
    discoveryApi.listDiscovery.and.returnValue(of([{ id: 'disc-1', name: 'prod-group' }]));
    discoveryApi.registerUpstream.and.returnValue(of(previewResponse));

    await TestBed.configureTestingModule({
      imports: [ApiPlaygroundPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DiscoveryApiService, useValue: discoveryApi },
        { provide: ConfirmService, useValue: { ask: confirmAsk } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApiPlaygroundPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillForm(): void {
    component.form.patchValue({
      apiKeySecret: 'cdk_live_test',
      discoveryId: 'disc-1',
      configId: '@route-main',
      targetMode: 'dial',
      dial: '10.0.0.5:8080'
    });
  }

  it('renders playground title', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('API playground');
  });

  it('preview calls registerUpstream with dry_run true', async () => {
    await fixture.whenStable();
    fillForm();
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
    fillForm();
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
});
