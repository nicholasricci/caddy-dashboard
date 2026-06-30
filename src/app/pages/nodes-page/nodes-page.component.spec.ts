import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { NodesPageComponent } from './nodes-page.component';
import { mapCaddyNodeV1ToListItem } from './nodes-page.vm';

describe('NodesPageComponent', () => {
  let fixture: ComponentFixture<NodesPageComponent>;
  let component: NodesPageComponent;
  let api: jasmine.SpyObj<DashboardApiService>;
  let confirmAsk: jasmine.Spy;

  beforeEach(async () => {
    confirmAsk = jasmine.createSpy('ask').and.resolveTo(true);
    api = jasmine.createSpyObj<DashboardApiService>('DashboardApiService', [
      'listNodes',
      'listDiscovery',
      'deleteNode',
      'createNode'
    ]);
    api.listNodes.and.returnValue(
      of([
        {
          id: 'node-1',
          name: 'edge-prod',
          status: 'online',
          transport: 'aws_ssm',
          region: 'eu-south-1',
          discovery_config_id: 'disc-1'
        }
      ])
    );
    api.listDiscovery.and.returnValue(of([{ id: 'disc-1', name: 'prod-group', method: 'aws_ssm' }]));
    api.deleteNode.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [NodesPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DashboardApiService, useValue: api },
        { provide: ConfirmService, useValue: { ask: confirmAsk } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NodesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and node name', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Server overview');
    expect(root.textContent).toContain('edge-prod');
    expect(root.textContent).toContain('prod-group');
  });

  it('reload on load() fetches nodes again', async () => {
    await fixture.whenStable();
    api.listNodes.calls.reset();
    api.listDiscovery.calls.reset();

    component.load();
    await fixture.whenStable();

    expect(api.listNodes).toHaveBeenCalled();
    expect(api.listDiscovery).toHaveBeenCalled();
  });

  it('reload after delete fetches nodes again', async () => {
    await fixture.whenStable();
    api.listNodes.calls.reset();
    api.listDiscovery.calls.reset();

    await component.remove(
      mapCaddyNodeV1ToListItem({
        id: 'node-1',
        name: 'edge-prod',
        status: 'online',
        transport: 'aws_ssm',
        discovery_config_id: 'disc-1'
      })
    );
    await fixture.whenStable();

    expect(confirmAsk).toHaveBeenCalled();
    expect(api.deleteNode).toHaveBeenCalledWith('node-1');
    expect(api.listNodes).toHaveBeenCalled();
    expect(api.listDiscovery).toHaveBeenCalled();
  });

  it('delete calls API after confirm', async () => {
    await fixture.whenStable();

    await component.remove(
      mapCaddyNodeV1ToListItem({
        id: 'node-9',
        name: 'old-node',
        transport: 'aws_ssm'
      })
    );

    expect(confirmAsk).toHaveBeenCalled();
    expect(api.deleteNode).toHaveBeenCalledWith('node-9');
  });
});
