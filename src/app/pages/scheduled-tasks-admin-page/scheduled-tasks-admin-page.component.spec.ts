import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { DiscoveryConfigV1, ScheduledTaskLogV1, ScheduledTaskV1 } from '../../models/api-v1.model';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { NodesApiService } from '../../services/api/nodes-api.service';
import { ScheduledTasksApiService } from '../../services/api/scheduled-tasks-api.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ScheduledTasksAdminPageComponent } from './scheduled-tasks-admin-page.component';

const DISC_1 = '8040ce98-d808-4d3d-b2c4-f6161144188c';

const sampleTask: ScheduledTaskV1 = {
  id: 'task-1',
  name: 'Discovery EU',
  description: 'Every 30 minutes',
  task_type: 'discovery_run',
  cron_expression: '*/30 * * * *',
  config: { discovery_config_id: DISC_1 },
  enabled: true,
  last_status: 'success'
};

const sampleLog: ScheduledTaskLogV1 = {
  id: 'log-1',
  scheduled_task_id: 'task-1',
  started_at: '2026-06-23T15:00:00Z',
  finished_at: '2026-06-23T15:00:05Z',
  status: 'success',
  details: { discovered_nodes: 3 }
};

const sampleLogListResponse = {
  items: [sampleLog],
  meta: { total: 1, limit: 10, offset: 0 }
};

describe('ScheduledTasksAdminPageComponent', () => {
  let fixture: ComponentFixture<ScheduledTasksAdminPageComponent>;
  let scheduledTasksApi: jasmine.SpyObj<ScheduledTasksApiService>;
  let discoveryApi: jasmine.SpyObj<DiscoveryApiService>;
  let nodesApi: jasmine.SpyObj<NodesApiService>;
  let confirmAsk: jasmine.Spy;

  beforeEach(async () => {
    confirmAsk = jasmine.createSpy('ask').and.resolveTo(true);
    scheduledTasksApi = jasmine.createSpyObj<ScheduledTasksApiService>('ScheduledTasksApiService', [
      'listScheduledTasks',
      'createScheduledTask',
      'updateScheduledTask',
      'deleteScheduledTask',
      'toggleScheduledTask',
      'runScheduledTaskNow',
      'listScheduledTaskLogs'
    ]);
    discoveryApi = jasmine.createSpyObj<DiscoveryApiService>('DiscoveryApiService', ['listDiscovery']);
    nodesApi = jasmine.createSpyObj<NodesApiService>('NodesApiService', ['listNodes', 'listLiveConfigIds']);

    scheduledTasksApi.listScheduledTasks.and.returnValue(of([sampleTask]));
    scheduledTasksApi.createScheduledTask.and.returnValue(of(sampleTask));
    scheduledTasksApi.updateScheduledTask.and.returnValue(of(sampleTask));
    scheduledTasksApi.deleteScheduledTask.and.returnValue(of(void 0));
    scheduledTasksApi.toggleScheduledTask.and.returnValue(of({ ...sampleTask, enabled: false }));
    scheduledTasksApi.runScheduledTaskNow.and.returnValue(of(sampleLog));
    scheduledTasksApi.listScheduledTaskLogs.and.returnValue(of(sampleLogListResponse));
    discoveryApi.listDiscovery.and.returnValue(
      of([{ id: DISC_1, name: 'EU group', region: 'eu-west-1', method: 'aws_ssm' } as DiscoveryConfigV1])
    );
    nodesApi.listNodes.and.returnValue(
      of([{ id: 'node-1', name: 'caddy-1', discovery_config_id: DISC_1 }])
    );
    nodesApi.listLiveConfigIds.and.returnValue(
      of({
        items: [
          { id: 'route/a', has_upstreams: true, upstream_count: 2 },
          { id: 'route/b', has_upstreams: false }
        ]
      })
    );

    await TestBed.configureTestingModule({
      imports: [ScheduledTasksAdminPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ScheduledTasksApiService, useValue: scheduledTasksApi },
        { provide: DiscoveryApiService, useValue: discoveryApi },
        { provide: NodesApiService, useValue: nodesApi },
        { provide: ConfirmService, useValue: { ask: confirmAsk } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduledTasksAdminPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders scheduled tasks from the API', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Discovery EU');
    expect(root.textContent).toContain('*/30 * * * *');
  });

  it('opens create modal with discovery group select for discovery_run', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const addBtn = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Add task'));
    addBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('New scheduled task');
    expect(root.querySelector('#st-discovery')).withContext('discovery select visible').not.toBeNull();
  });

  it('calls run-now on the API', async () => {
    const component = fixture.componentInstance;
    component.runNow(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.runScheduledTaskNow).toHaveBeenCalledWith('task-1');
  });

  it('toggles task with enabled false when disabling', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const toggleBtn = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Disable'));
    toggleBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.toggleScheduledTask).toHaveBeenCalledWith('task-1', false);
  });

  it('re-fetches the list after creating a task', async () => {
    const component = fixture.componentInstance;
    component.openCreate();
    component.taskForm.patchValue({
      name: 'New task',
      task_type: 'token_cleanup',
      cron_expression: '@daily',
      discovery_config_id: '',
      enabled: true
    });
    component.save();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.createScheduledTask).toHaveBeenCalled();
    expect(scheduledTasksApi.listScheduledTasks.calls.count()).toBeGreaterThan(1);
  });

  it('opens logs modal and loads execution logs', async () => {
    const component = fixture.componentInstance;
    component.openLogs(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(scheduledTasksApi.listScheduledTaskLogs).toHaveBeenCalledWith('task-1', { limit: 10, offset: 0 });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Execution logs');
    expect(root.textContent).toContain('success');
  });

  it('applies log filters and resets offset to zero', async () => {
    const component = fixture.componentInstance;
    component.openLogs(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();

    scheduledTasksApi.listScheduledTaskLogs.calls.reset();
    scheduledTasksApi.listScheduledTaskLogs.and.returnValue(
      of({ items: [], meta: { total: 0, limit: 20, offset: 0 } })
    );

    component.setLogsDraftField('status', 'failed');
    component.applyLogsFilters();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(scheduledTasksApi.listScheduledTaskLogs).toHaveBeenCalledWith('task-1', {
      status: 'failed',
      limit: 10,
      offset: 0
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No execution logs match the current filters.');
  });

  it('requests the next log page using server offset', async () => {
    scheduledTasksApi.listScheduledTaskLogs.and.returnValue(
      of({ items: [sampleLog], meta: { total: 40, limit: 10, offset: 0 } })
    );

    const component = fixture.componentInstance;
    component.openLogs(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    scheduledTasksApi.listScheduledTaskLogs.calls.reset();
    scheduledTasksApi.listScheduledTaskLogs.and.returnValue(
      of({ items: [sampleLog], meta: { total: 40, limit: 10, offset: 10 } })
    );

    component.logsNextPage();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(scheduledTasksApi.listScheduledTaskLogs).toHaveBeenCalledWith('task-1', {
      limit: 10,
      offset: 10
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Showing 11–11 of 40');
  });

  it('resets log filters when opening logs for a different task', async () => {
    const component = fixture.componentInstance;
    component.openLogs(sampleTask);
    component.setLogsDraftField('status', 'failed');
    component.applyLogsFilters();
    fixture.detectChanges();
    await fixture.whenStable();

    scheduledTasksApi.listScheduledTaskLogs.calls.reset();

    component.openLogs({ ...sampleTask, id: 'task-2', name: 'Other task' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.listScheduledTaskLogs).toHaveBeenCalledWith('task-2', { limit: 10, offset: 0 });
  });

  it('refreshes logs when run-now completes with logs modal open', async () => {
    const component = fixture.componentInstance;
    component.openLogs(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();

    const callsBefore = scheduledTasksApi.listScheduledTaskLogs.calls.count();
    component.runNow(sampleTask);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.listScheduledTaskLogs.calls.count()).toBeGreaterThan(callsBefore);
  });

  it('loads live config ids when upstream discovery group is selected', async () => {
    const component = fixture.componentInstance;
    component.openCreate();
    component.taskForm.patchValue({ task_type: 'upstream_healthcheck', discovery_config_id: DISC_1 });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(nodesApi.listLiveConfigIds).toHaveBeenCalledWith('node-1');
    expect(component.upstreamRouteOptions().length).toBe(1);
    expect(component.upstreamRouteOptions()[0].id).toBe('route/a');
  });

  it('saves upstream_healthcheck with discovery_config_id and selected config_ids', async () => {
    const component = fixture.componentInstance;
    component.openCreate();
    component.taskForm.patchValue({
      name: 'Upstream check',
      task_type: 'upstream_healthcheck',
      discovery_config_id: DISC_1,
      cron_expression: '*/5 * * * *',
      enabled: true
    });
    component.selectedConfigIds.set(new Set(['route/a']));
    component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.createScheduledTask).toHaveBeenCalledWith(
      jasmine.objectContaining({
        task_type: 'upstream_healthcheck',
        config: { discovery_config_id: DISC_1, config_ids: ['route/a'] }
      })
    );
  });

  it('saves upstream_healthcheck with discovery_config_id only when no routes selected', async () => {
    const component = fixture.componentInstance;
    component.openCreate();
    component.taskForm.patchValue({
      name: 'Upstream check all',
      task_type: 'upstream_healthcheck',
      discovery_config_id: DISC_1,
      cron_expression: '*/5 * * * *',
      enabled: true
    });
    component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.createScheduledTask).toHaveBeenCalledWith(
      jasmine.objectContaining({
        config: { discovery_config_id: DISC_1 }
      })
    );
  });

  it('does not save upstream_healthcheck without discovery_config_id', async () => {
    const component = fixture.componentInstance;
    component.openCreate();
    component.taskForm.patchValue({
      name: 'Upstream check',
      task_type: 'upstream_healthcheck',
      discovery_config_id: '',
      cron_expression: '*/5 * * * *',
      enabled: true
    });
    component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scheduledTasksApi.createScheduledTask).not.toHaveBeenCalled();
    expect(component.taskForm.invalid).toBeTrue();
  });

  it('pre-selects config_ids and loads routes when editing upstream_healthcheck task', async () => {
    const component = fixture.componentInstance;
    component.edit({
      id: 'task-2',
      name: 'Upstream HC',
      task_type: 'upstream_healthcheck',
      cron_expression: '*/5 * * * *',
      config: { discovery_config_id: DISC_1, config_ids: ['route/a'] },
      enabled: true
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isConfigIdSelected('route/a')).toBeTrue();
    expect(nodesApi.listLiveConfigIds).toHaveBeenCalledWith('node-1');
    expect(component.upstreamRouteOptions().length).toBe(1);
  });

  it('parses upstream healthcheck log details', () => {
    const component = fixture.componentInstance;
    const parsed = component.upstreamLogDetails({
      details: {
        duration_ms: 16906,
        discoveries: 1,
        discovery_results: [
          {
            discovery_config_id: DISC_1,
            discovery_name: 'eu-central-1-Project-Caddy (DR)',
            dials_checked: 6,
            unhealthy_dials: 3,
            changed: true,
            pruned: ['10.0.1.5:8080']
          }
        ]
      }
    });

    expect(parsed?.duration_ms).toBe(16906);
    expect(parsed?.discovery_results?.[0]?.discovery_name).toBe('eu-central-1-Project-Caddy (DR)');
    expect(parsed?.discovery_results?.[0]?.pruned).toEqual(['10.0.1.5:8080']);
  });
});
