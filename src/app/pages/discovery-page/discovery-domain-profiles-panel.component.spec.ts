import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DomainProfilesApiService } from '../../services/api/domain-profiles-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { DiscoveryDomainProfilesPanelComponent } from './discovery-domain-profiles-panel.component';

describe('DiscoveryDomainProfilesPanelComponent', () => {
  let fixture: ComponentFixture<DiscoveryDomainProfilesPanelComponent>;
  let component: DiscoveryDomainProfilesPanelComponent;
  let profilesApi: jasmine.SpyObj<DomainProfilesApiService>;

  beforeEach(async () => {
    profilesApi = jasmine.createSpyObj<DomainProfilesApiService>('DomainProfilesApiService', [
      'listForDiscovery',
      'create',
      'update',
      'delete'
    ]);
    profilesApi.listForDiscovery.and.returnValue(of([{ id: 'p1', name: 'web' }]));
    profilesApi.create.and.returnValue(of({ id: 'p2', name: 'api' }));
    profilesApi.update.and.returnValue(of({ id: 'p1', name: 'web-v2' }));
    profilesApi.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [DiscoveryDomainProfilesPanelComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DomainProfilesApiService, useValue: profilesApi },
        { provide: ConfirmService, useValue: { ask: jasmine.createSpy('ask').and.resolveTo(true) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryDomainProfilesPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('discoveryId', 'disc-1');
    fixture.componentRef.setInput('discoveryName', 'prod-group');
    fixture.detectChanges();
  });

  it('loads profiles for the discovery group', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(profilesApi.listForDiscovery).toHaveBeenCalledWith('disc-1');
    expect(component.profiles().length).toBe(1);
    expect(component.profiles()[0].name).toBe('web');
  });

  it('reloads the list after creating a profile', async () => {
    await fixture.whenStable();
    profilesApi.listForDiscovery.calls.reset();
    profilesApi.listForDiscovery.and.returnValue(
      of([
        { id: 'p1', name: 'web' },
        { id: 'p2', name: 'api' }
      ])
    );

    component.openCreate();
    component.profileForm.patchValue({ name: 'api', description: '' });
    component.profileForm.controls.bindings.at(0)?.patchValue({ configId: '@route', matchIndexes: '0' });
    component.save();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(profilesApi.create).toHaveBeenCalled();
    expect(profilesApi.listForDiscovery).toHaveBeenCalledWith('disc-1');
    expect(component.profiles().length).toBe(2);
  });
});
