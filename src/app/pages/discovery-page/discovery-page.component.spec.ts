import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { DiscoveryConfigV1 } from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { DiscoveryPageComponent } from './discovery-page.component';

class DashboardApiServiceMock {
  listDiscovery() {
    return of([]);
  }
  createDiscovery() {
    return of({});
  }
  updateDiscovery() {
    return of({});
  }
  deleteDiscovery() {
    return of(void 0);
  }
  runDiscovery() {
    return of({});
  }
}

class ConfirmServiceMock {
  ask() {
    return Promise.resolve(true);
  }
}

describe('DiscoveryPageComponent snapshot scope', () => {
  let fixture: ComponentFixture<DiscoveryPageComponent>;
  let component: DiscoveryPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoveryPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApiService, useClass: DashboardApiServiceMock },
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

    const payload = (component as unknown as { buildPayloadFromDraft: () => DiscoveryConfigV1 }).buildPayloadFromDraft();

    expect(payload.snapshot_scope).toBe('node');
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

    const payload = (component as unknown as { buildPayloadFromDraft: () => DiscoveryConfigV1 }).buildPayloadFromDraft();

    expect(payload.snapshot_scope).toBe('group');
  });
});
