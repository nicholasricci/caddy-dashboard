import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { DiscoveryPageComponent } from './discovery-page.component';

class ConfirmServiceMock {
  ask() {
    return Promise.resolve(true);
  }
}

describe('DiscoveryPageComponent snapshot scope', () => {
  let fixture: ComponentFixture<DiscoveryPageComponent>;
  let component: DiscoveryPageComponent;
  let api: jasmine.SpyObj<DashboardApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<DashboardApiService>('DashboardApiService', [
      'listDiscovery',
      'createDiscovery',
      'updateDiscovery',
      'deleteDiscovery',
      'runDiscovery'
    ]);
    api.listDiscovery.and.returnValue(of([]));
    api.createDiscovery.and.returnValue(of({ id: 'new-rule' }));
    api.updateDiscovery.and.returnValue(of({ id: 'disc-1' }));
    api.deleteDiscovery.and.returnValue(of(void 0));
    api.runDiscovery.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [DiscoveryPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApiService, useValue: api },
        { provide: ConfirmService, useClass: ConfirmServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults snapshot_scope to node in payload', () => {
    component.openCreate();
    component.discoveryForm.controls.name.setValue('rule-a');
    component.discoveryForm.controls.method.setValue('aws_ssm');
    component.discoveryForm.controls.region.setValue('eu-west-1');

    component.save();

    expect(api.createDiscovery).toHaveBeenCalled();
    const payload = api.createDiscovery.calls.mostRecent().args[0] as Record<string, unknown>;
    expect(payload['snapshot_scope']).toBe('node');
  });

  it('keeps group snapshot_scope when editing existing rule', () => {
    component.edit({
      id: 'disc-1',
      name: 'rule-b',
      method: 'static_ip',
      snapshot_scope: 'group',
      parameters: { addresses: ['10.0.0.5'] },
      enabled: true
    });
    component.discoveryForm.controls.name.setValue('rule-b-updated');

    component.save();

    expect(api.updateDiscovery).toHaveBeenCalled();
    const payload = api.updateDiscovery.calls.mostRecent().args[1] as Record<string, unknown>;
    expect(payload['snapshot_scope']).toBe('group');
    expect(payload['name']).toBe('rule-b-updated');
  });
});
