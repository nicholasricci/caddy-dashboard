import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import {
  SCHEDULED_TASK_TYPES,
  type CaddyConfigIdInfoV1,
  type ScheduledTaskLogListFilterV1,
  type ScheduledTaskLogListMetaV1,
  type ScheduledTaskLogListResultV1,
  type ScheduledTaskLogV1,
  type ScheduledTaskTypeV1,
  type ScheduledTaskV1
} from '../../models/api-v1.model';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { NodesApiService } from '../../services/api/nodes-api.service';
import { ScheduledTasksApiService } from '../../services/api/scheduled-tasks-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';
import { normalizeDiscoveryRows, normalizeNodeRows } from '../../core/api-list-normalize.util';

const TASK_TYPE_LABELS: Record<ScheduledTaskTypeV1, string> = {
  discovery_run: 'Discovery run',
  token_cleanup: 'Token cleanup',
  node_healthcheck: 'Node healthcheck',
  upstream_healthcheck: 'Upstream healthcheck'
};

const LOGS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const LOGS_DEFAULT_PAGE_SIZE = LOGS_PAGE_SIZE_OPTIONS[0];

const LOG_STATUS_OPTIONS = ['running', 'success', 'failed'] as const;

interface LogsDraftFilter {
  status: string;
  fromLocal: string;
  toLocal: string;
}

function emptyLogsDraftFilter(): LogsDraftFilter {
  return { status: '', fromLocal: '', toLocal: '' };
}

function defaultLogsListFilter(): ScheduledTaskLogListFilterV1 {
  return { limit: LOGS_DEFAULT_PAGE_SIZE, offset: 0 };
}

function fromDatetimeLocalInput(local: string): string | undefined {
  const trimmed = local.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function draftToAppliedLogsFilter(draft: LogsDraftFilter, limit: number): ScheduledTaskLogListFilterV1 {
  const filter: ScheduledTaskLogListFilterV1 = { limit, offset: 0 };
  if (draft.status) {
    filter.status = draft.status as ScheduledTaskLogListFilterV1['status'];
  }
  const from = fromDatetimeLocalInput(draft.fromLocal);
  if (from) {
    filter.from = from;
  }
  const to = fromDatetimeLocalInput(draft.toLocal);
  if (to) {
    filter.to = to;
  }
  return filter;
}

function toScheduledTaskLogs(rows: ScheduledTaskLogListResultV1 | unknown): ScheduledTaskLogV1[] {
  if (Array.isArray(rows)) {
    return rows as ScheduledTaskLogV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }
  const record = rows as Record<string, unknown>;
  if (Array.isArray(record['items'])) {
    return record['items'] as ScheduledTaskLogV1[];
  }
  return [];
}

function toScheduledTaskLogMeta(rows: ScheduledTaskLogListResultV1 | unknown): ScheduledTaskLogListMetaV1 | null {
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) {
    return null;
  }
  const meta = (rows as Record<string, unknown>)['meta'];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }
  return meta as ScheduledTaskLogListMetaV1;
}

function logsFilterIsActive(filter: ScheduledTaskLogListFilterV1): boolean {
  return Boolean(filter.status || filter.from || filter.to);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

function discoveryConfigIdFromTask(task: ScheduledTaskV1): string {
  const config = task.config;
  if (config && typeof config['discovery_config_id'] === 'string') {
    return config['discovery_config_id'];
  }
  return '';
}

function configIdsFromTask(task: ScheduledTaskV1): string[] {
  const config = task.config;
  if (!config || !Array.isArray(config['config_ids'])) {
    return [];
  }
  return config['config_ids'].filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function upstreamHealthcheckSummary(task: ScheduledTaskV1): string {
  const ids = configIdsFromTask(task);
  if (ids.length === 0) {
    return 'All upstream routes';
  }
  return `${ids.length} route${ids.length === 1 ? '' : 's'}`;
}

function upstreamHealthcheckTooltip(task: ScheduledTaskV1): string | null {
  const ids = configIdsFromTask(task);
  if (ids.length === 0) {
    return null;
  }
  return ids.join(', ');
}

function formatDetailsJson(details: Record<string, unknown> | undefined): string | null {
  if (!details || Object.keys(details).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function statusChipClass(status: string | null | undefined): string {
  if (!status) {
    return 'stitch-status-chip';
  }
  const normalized = status.toLowerCase();
  if (normalized === 'success') {
    return 'stitch-status-chip text-emerald-700 border-emerald-600/30 bg-emerald-600/10';
  }
  if (normalized === 'running') {
    return 'stitch-status-chip text-amber-700 border-amber-600/30 bg-amber-600/10';
  }
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
    return 'stitch-status-chip text-stitch-error border-stitch-error/30 bg-stitch-error/10';
  }
  return 'stitch-status-chip';
}

@Component({
  selector: 'app-scheduled-tasks-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent],
  template: `
    <div class="w-full min-w-0 px-10 py-12 max-w-7xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="clock" size="md" class="text-stitch-primary-fixed" />
            Scheduled tasks
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed max-w-2xl">
            Configure recurring automations (discovery runs, healthchecks, token cleanup). Admin only.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
            (click)="load()"
            [disabled]="loading()"
          >
            <app-stitch-icon name="refresh" size="xs" [class.animate-spin]="loading()" />
            Refresh
          </button>
          <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn" (click)="openCreate()">
            <app-stitch-icon name="plus" size="xs" />
            Add task
          </button>
        </div>
      </header>

      @if (error()) {
        <div
          class="alert text-sm mb-8 rounded-sm border-stitch-ghost bg-stitch-surface-lowest text-stitch-on-surface"
        >
          <span class="text-stitch-error font-medium">{{ error() }}</span>
        </div>
      }

      @if (lastRunMessage()) {
        <p class="text-sm text-stitch-on-surface mb-6 font-mono">{{ lastRunMessage() }}</p>
      }

      @if (loading()) {
        <div class="flex py-16 stitch-panel justify-center">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (tasks().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
          <app-stitch-icon name="clock" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-sm text-stitch-on-surface-variant">No scheduled tasks yet.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                <th class="font-medium py-4 px-4 text-left">Name</th>
                <th class="font-medium py-4 px-4 text-left">Type</th>
                <th class="font-medium py-4 px-4 text-left">Schedule</th>
                <th class="font-medium py-4 px-4 text-left">Enabled</th>
                <th class="font-medium py-4 px-4 text-left">Last run</th>
                <th class="font-medium py-4 px-4 text-left">Status</th>
                <th class="font-medium py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (task of tasks(); track task.id; let i = $index) {
                <tr
                  class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                  [class.bg-transparent]="i % 2 === 0"
                  [class.bg-stitch-surface-low/80]="i % 2 !== 0"
                >
                  <td class="py-4 px-4 align-middle">
                    <div class="font-medium text-stitch-on-surface">{{ task.name }}</div>
                    @if (task.description) {
                      <p class="text-xs text-stitch-on-surface-variant mt-1 max-w-xs">{{ task.description }}</p>
                    }
                  </td>
                  <td class="py-4 px-4 align-middle">
                    <span class="font-mono text-xs">{{ taskTypeLabel(task.task_type) }}</span>
                    @if (task.task_type === 'discovery_run') {
                      @let discId = discoveryConfigId(task);
                      @if (discId) {
                        <p class="text-[11px] text-stitch-on-surface-variant mt-1 font-mono break-all">
                          {{ discoveryLabel(discId) }}
                        </p>
                      }
                    }
                    @if (task.task_type === 'upstream_healthcheck') {
                      <p
                        class="text-[11px] text-stitch-on-surface-variant mt-1 font-mono"
                        [title]="upstreamTooltip(task) ?? ''"
                      >
                        {{ upstreamSummary(task) }}
                      </p>
                    }
                  </td>
                  <td
                    class="py-4 px-4 align-middle font-mono text-xs whitespace-nowrap"
                    [title]="task.cron_expression"
                  >
                    {{ task.cron_expression }}
                  </td>
                  <td class="py-4 px-4 align-middle">
                    <span
                      class="stitch-status-chip"
                      [class.text-emerald-700]="task.enabled !== false"
                      [class.border-emerald-600/30]="task.enabled !== false"
                      [class.bg-emerald-600/10]="task.enabled !== false"
                      [class.text-stitch-on-surface-variant]="task.enabled === false"
                    >
                      {{ task.enabled === false ? 'Disabled' : 'Enabled' }}
                    </span>
                  </td>
                  <td class="py-4 px-4 align-middle text-xs whitespace-nowrap">
                    {{ formatTs(task.last_run_at) }}
                  </td>
                  <td class="py-4 px-4 align-middle">
                    <span [class]="statusClass(task.last_status)">{{ task.last_status || '—' }}</span>
                    @if (task.last_error) {
                      <p class="text-[11px] text-stitch-error mt-1 max-w-xs truncate" [title]="task.last_error">
                        {{ task.last_error }}
                      </p>
                    }
                  </td>
                  <td class="py-4 px-4 text-right align-middle min-w-0">
                    <div class="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                        [disabled]="runningId() === task.id"
                        (click)="runNow(task)"
                      >
                        @if (runningId() === task.id) {
                          <span class="loading loading-spinner loading-xs"></span>
                        } @else {
                          <app-stitch-icon name="play" size="xs" />
                        }
                        Run now
                      </button>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                        [disabled]="togglingId() === task.id"
                        (click)="toggleEnabled(task)"
                      >
                        @if (togglingId() === task.id) {
                          <span class="loading loading-spinner loading-xs"></span>
                        } @else if (task.enabled === false) {
                          <app-stitch-icon name="reload" size="xs" />
                        } @else {
                          <app-stitch-icon name="pause" size="xs" />
                        }
                        {{ task.enabled === false ? 'Enable' : 'Disable' }}
                      </button>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                        (click)="openLogs(task)"
                      >
                        <app-stitch-icon name="document" size="xs" />
                        Logs
                      </button>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                        (click)="edit(task)"
                      >
                        <app-stitch-icon name="edit" size="xs" />
                        Edit
                      </button>
                      <button
                        type="button"
                        class="btn-stitch-secondary btn-stitch-secondary--sm text-stitch-error stitch-icon-btn shrink-0"
                        (click)="remove(task)"
                      >
                        <app-stitch-icon name="trash" size="xs" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (showModal()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeModal()"
          (keydown.enter)="closeModal()"
          (keydown.space)="$event.preventDefault(); closeModal()"
          (keydown.escape)="closeModal()"
        >
          <div
            class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-lg border-stitch-ghost shadow-2xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduled-task-modal-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="scheduled-task-modal-title"
              class="font-display text-lg font-semibold mb-6 text-stitch-on-surface flex items-center gap-2"
            >
              @if (editingId()) {
                <app-stitch-icon name="edit" />
              } @else {
                <app-stitch-icon name="plus" />
              }
              {{ editingId() ? 'Edit scheduled task' : 'New scheduled task' }}
            </h3>
            <form [formGroup]="taskForm">
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="st-name"
                >Name</label
              >
              <input id="st-name" class="input-technical mt-1 mb-5 w-full" formControlName="name" />

              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="st-description"
                >Description</label
              >
              <input id="st-description" class="input-technical mt-1 mb-5 w-full" formControlName="description" />

              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="st-type"
                >Task type</label
              >
              <select id="st-type" class="input-technical mt-1 mb-5 w-full" formControlName="task_type">
                @for (type of taskTypes; track type) {
                  <option [value]="type">{{ taskTypeLabel(type) }}</option>
                }
              </select>

              @if (taskForm.controls.task_type.value === 'discovery_run') {
                <label
                  class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                  for="st-discovery"
                  >Discovery group</label
                >
                <select id="st-discovery" class="input-technical mt-1 mb-5 w-full" formControlName="discovery_config_id">
                  <option value="">Select a discovery group…</option>
                  @for (d of discoveryOptions(); track d.id) {
                    <option [value]="d.id">{{ d.name || d.id }}</option>
                  }
                </select>
              }

              @if (taskForm.controls.task_type.value === 'upstream_healthcheck') {
                <label
                  class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                  for="st-upstream-discovery"
                  >Discovery group (load routes)</label
                >
                <select
                  id="st-upstream-discovery"
                  class="input-technical mt-1 mb-5 w-full"
                  [value]="upstreamDiscoveryId()"
                  (change)="onUpstreamDiscoveryChange($event)"
                >
                  <option value="">Select a discovery group…</option>
                  @for (d of discoveryOptions(); track d.id) {
                    <option [value]="d.id">{{ d.name || d.id }}</option>
                  }
                </select>

                <fieldset class="border-0 p-0 m-0 min-w-0 mb-5">
                  <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">
                    Routes with upstream (optional)
                  </legend>
                  <p class="text-xs text-stitch-on-surface-variant mb-3 leading-relaxed">
                    Leave all unchecked to healthcheck every upstream route.
                  </p>
                  @if (!upstreamDiscoveryId()) {
                    <p class="text-sm text-stitch-on-surface-variant">Select a discovery group to load routes.</p>
                  } @else if (upstreamRoutesLoading()) {
                    <div class="flex py-4 justify-center stitch-panel stitch-panel--dim">
                      <span class="loading loading-spinner loading-sm text-stitch-on-surface-variant"></span>
                    </div>
                  } @else if (upstreamRoutesError()) {
                    <p class="text-sm text-stitch-error">{{ upstreamRoutesError() }}</p>
                  } @else if (upstreamRouteOptions().length === 0) {
                    <p class="text-sm text-stitch-on-surface-variant">No routes with upstreams on the first node in this group.</p>
                  } @else {
                    <div class="space-y-2 max-h-40 overflow-y-auto stitch-panel stitch-panel--dim p-3">
                      @for (route of upstreamRouteOptions(); track route.id) {
                        <label class="flex items-start gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm mt-0.5"
                            [checked]="isConfigIdSelected(route.id)"
                            (change)="toggleConfigId(route.id, $event)"
                          />
                          <span class="font-mono text-xs break-all">
                            {{ route.id }}
                            @if (route.upstream_count !== undefined && route.upstream_count !== null) {
                              <span class="text-stitch-on-surface-variant ml-1">({{ route.upstream_count }} upstreams)</span>
                            }
                          </span>
                        </label>
                      }
                    </div>
                  }
                </fieldset>
              }

              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="st-cron"
                >Schedule (cron_expression)</label
              >
              <input
                id="st-cron"
                class="input-technical mt-1 mb-2 w-full font-mono"
                formControlName="cron_expression"
                placeholder="*/30 * * * *"
              />
              <p class="text-xs text-stitch-on-surface-variant mb-5">
                5-field cron (e.g. <span class="font-mono">*/30 * * * *</span>) or
                <span class="font-mono">@every 5m</span> / <span class="font-mono">@daily</span>
              </p>

              <label class="flex items-center gap-2 mb-8 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm" formControlName="enabled" />
                <span class="text-sm text-stitch-on-surface">Enabled</span>
              </label>
            </form>
            <div class="flex justify-end gap-3">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="taskForm.invalid || saving()"
                (click)="save()"
              >
                @if (saving()) {
                  <span class="loading loading-spinner loading-xs"></span>
                } @else {
                  <app-stitch-icon name="apply" size="xs" />
                }
                Save
              </button>
            </div>
          </div>
        </div>
      }

      @if (showLogsModal()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
          role="presentation"
          tabindex="-1"
          (click)="closeLogsModal()"
          (keydown.enter)="closeLogsModal()"
          (keydown.space)="$event.preventDefault(); closeLogsModal()"
          (keydown.escape)="closeLogsModal()"
        >
          <div
            class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-4xl border-stitch-ghost shadow-2xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduled-task-logs-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="scheduled-task-logs-title"
              class="font-display text-lg font-semibold mb-2 text-stitch-on-surface flex items-center gap-2"
            >
              <app-stitch-icon name="document" />
              Execution logs
            </h3>
            <p class="text-sm text-stitch-on-surface-variant mb-6 font-mono">{{ logsTaskName() }}</p>

            <section class="stitch-panel stitch-panel--dim mb-6">
              <p class="stitch-panel-title mb-4">Filters</p>
              <div class="grid gap-4 sm:grid-cols-3">
                <label class="form-control">
                  <span class="text-xs text-stitch-on-surface-variant">Status</span>
                  <select
                    class="select select-bordered w-full mt-1.5 px-3 font-mono text-xs"
                    [value]="logsDraftFilter().status"
                    (change)="setLogsDraftField('status', readSelectValue($event))"
                  >
                    <option value="">All</option>
                    @for (status of logStatusOptions; track status) {
                      <option [value]="status">{{ status }}</option>
                    }
                  </select>
                </label>
                <label class="form-control">
                  <span class="text-xs text-stitch-on-surface-variant" for="st-logs-filter-from">From</span>
                  <input
                    id="st-logs-filter-from"
                    type="datetime-local"
                    class="input input-bordered w-full mt-1.5 font-mono text-xs"
                    [value]="logsDraftFilter().fromLocal"
                    (input)="setLogsDraftField('fromLocal', readInputValue($event))"
                  />
                </label>
                <label class="form-control">
                  <span class="text-xs text-stitch-on-surface-variant" for="st-logs-filter-to">To</span>
                  <input
                    id="st-logs-filter-to"
                    type="datetime-local"
                    class="input input-bordered w-full mt-1.5 font-mono text-xs"
                    [value]="logsDraftFilter().toLocal"
                    (input)="setLogsDraftField('toLocal', readInputValue($event))"
                  />
                </label>
              </div>
              <div class="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="btn-stitch-primary btn-stitch-primary--sm"
                  (click)="applyLogsFilters()"
                  [disabled]="logsLoading()"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  class="btn-stitch-secondary btn-stitch-secondary--sm"
                  (click)="clearLogsFilters()"
                  [disabled]="logsLoading()"
                >
                  Clear
                </button>
                <label class="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-stitch-on-surface-variant">
                  <span>Page size</span>
                  <select
                    class="select select-bordered select-sm min-w-[4.75rem] pl-3 pr-8 font-mono text-xs"
                    [value]="logsPageSize()"
                    (change)="onLogsPageSizeChange(readSelectNumber($event))"
                  >
                    @for (size of logsPageSizeOptions; track size) {
                      <option [value]="size">{{ size }}</option>
                    }
                  </select>
                </label>
              </div>
            </section>

            @if (logsLoading()) {
              <div class="flex py-12 justify-center">
                <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
              </div>
            } @else if (logsError()) {
              <p class="text-sm text-stitch-error">{{ logsError() }}</p>
            } @else if (logs().length === 0) {
              <p class="text-sm text-stitch-on-surface-variant">
                @if (logsFiltersActive()) {
                  No execution logs match the current filters.
                } @else {
                  No execution logs for this task.
                }
              </p>
            } @else {
              <div class="overflow-x-auto rounded-sm border border-stitch-ghost">
                <table class="table w-full border-collapse text-sm">
                  <thead>
                    <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                      <th class="font-medium py-4 px-3 text-left">Started</th>
                      <th class="font-medium py-4 px-3 text-left">Finished</th>
                      <th class="font-medium py-4 px-3 text-left">Status</th>
                      <th class="font-medium py-4 px-3 text-left">Error</th>
                      <th class="py-4 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of logs(); track log.id ?? $index) {
                      <tr class="border-b border-stitch-ghost/60 hover:bg-stitch-surface-container/30">
                        <td class="py-4 px-3 text-xs whitespace-nowrap">{{ formatTs(log.started_at) }}</td>
                        <td class="py-4 px-3 text-xs whitespace-nowrap">{{ formatTs(log.finished_at) }}</td>
                        <td class="py-4 px-3">
                          <span [class]="statusClass(log.status)">{{ log.status || '—' }}</span>
                        </td>
                        <td class="py-4 px-3 text-xs text-stitch-error max-w-[12rem] truncate" [title]="log.error || ''">
                          {{ log.error || '—' }}
                        </td>
                        <td class="py-4 px-3 text-right">
                          @if (detailsText(log)) {
                            <button
                              type="button"
                              class="text-xs text-stitch-primary-fixed hover:underline"
                              (click)="toggleLogExpanded(logRowKey(log, $index))"
                            >
                              {{ isLogExpanded(logRowKey(log, $index)) ? 'Hide details' : 'Details' }}
                            </button>
                          }
                        </td>
                      </tr>
                      @if (isLogExpanded(logRowKey(log, $index)) && detailsText(log)) {
                        <tr>
                          <td colspan="5" class="px-3 pb-4">
                            <pre
                              class="overflow-auto rounded-sm bg-stitch-surface-lowest p-3 text-[11px] leading-5 text-stitch-on-surface whitespace-pre-wrap break-all border border-stitch-ghost"
                              >{{ detailsText(log) }}</pre
                            >
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>

              @if (logsPageSummary()) {
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p class="text-[10px] font-mono text-stitch-on-surface-variant">{{ logsPageSummary() }}</p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm"
                      (click)="logsPrevPage()"
                      [disabled]="!logsCanGoPrev() || logsLoading()"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm"
                      (click)="logsNextPage()"
                      [disabled]="!logsCanGoNext() || logsLoading()"
                    >
                      Next
                    </button>
                  </div>
                </div>
              }
            }

            <div class="flex justify-end mt-6">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeLogsModal()">
                Close
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ScheduledTasksAdminPageComponent {
  readonly taskTypes = SCHEDULED_TASK_TYPES;
  readonly logsPageSizeOptions = LOGS_PAGE_SIZE_OPTIONS;
  readonly logStatusOptions = LOG_STATUS_OPTIONS;

  private readonly scheduledTasksApi = inject(ScheduledTasksApiService);
  private readonly discoveryApi = inject(DiscoveryApiService);
  private readonly nodesApi = inject(NodesApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  private readonly refreshVersion = signal(0);
  private readonly nodesRefreshVersion = signal(0);
  readonly actionError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly runningId = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);
  readonly lastRunMessage = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly showLogsModal = signal(false);
  readonly logsTaskId = signal<string | null>(null);
  readonly logsTaskName = signal('');
  private readonly logsRefreshVersion = signal(0);
  readonly logsDraftFilter = signal<LogsDraftFilter>(emptyLogsDraftFilter());
  readonly logsPageSize = signal<number>(LOGS_DEFAULT_PAGE_SIZE);
  readonly logsAppliedFilter = signal<ScheduledTaskLogListFilterV1>(defaultLogsListFilter());
  private readonly expandedLogIds = signal<Set<string>>(new Set());
  readonly upstreamDiscoveryId = signal('');
  readonly selectedConfigIds = signal<Set<string>>(new Set());
  readonly upstreamRoutesLoading = signal(false);
  readonly upstreamRoutesError = signal<string | null>(null);
  readonly upstreamRouteOptions = signal<CaddyConfigIdInfoV1[]>([]);

  readonly tasksResource = rxResource({
    params: () => this.refreshVersion(),
    stream: () => this.scheduledTasksApi.listScheduledTasks()
  });

  readonly discoveryResource = rxResource({
    stream: () => this.discoveryApi.listDiscovery()
  });

  readonly nodesResource = rxResource({
    params: () => this.nodesRefreshVersion(),
    stream: () => this.nodesApi.listNodes()
  });

  readonly logsResource = rxResource({
    params: () => ({
      taskId: this.logsTaskId(),
      filter: this.logsAppliedFilter(),
      limit: this.logsPageSize(),
      refresh: this.logsRefreshVersion()
    }),
    stream: ({ params }) => {
      if (!params.taskId) {
        return of({
          items: [],
          meta: { total: 0, limit: params.limit, offset: 0 }
        } satisfies ScheduledTaskLogListResultV1);
      }
      return this.scheduledTasksApi.listScheduledTaskLogs(params.taskId, {
        ...params.filter,
        limit: params.limit
      });
    }
  });

  readonly tasks = computed(() => (this.tasksResource.value() as ScheduledTaskV1[] | undefined) ?? []);
  readonly loading = computed(() => this.tasksResource.isLoading());
  readonly discoveryOptions = computed(() =>
    normalizeDiscoveryRows(this.discoveryResource.value() as unknown)
  );
  readonly nodes = computed(() => normalizeNodeRows(this.nodesResource.value() as unknown));

  readonly logs = computed(() =>
    toScheduledTaskLogs(this.logsResource.value() as ScheduledTaskLogListResultV1 | unknown)
  );
  readonly logsMeta = computed(() =>
    toScheduledTaskLogMeta(this.logsResource.value() as ScheduledTaskLogListResultV1 | unknown)
  );
  readonly logsLoading = computed(() => this.logsResource.isLoading());
  readonly logsError = computed(() => {
    const e = this.logsResource.error();
    return e ? extractApiError(e, 'Failed to load logs') : null;
  });
  readonly logsFiltersActive = computed(() => logsFilterIsActive(this.logsAppliedFilter()));
  readonly logsCanGoPrev = computed(() => (this.logsAppliedFilter().offset ?? 0) > 0);
  readonly logsCanGoNext = computed(() => {
    const meta = this.logsMeta();
    const total = meta?.total;
    if (typeof total !== 'number') {
      return false;
    }
    const offset = this.logsAppliedFilter().offset ?? 0;
    return offset + this.logs().length < total;
  });
  readonly logsPageSummary = computed(() => {
    const meta = this.logsMeta();
    const total = meta?.total;
    if (typeof total !== 'number' || total === 0) {
      return '';
    }
    const offset = this.logsAppliedFilter().offset ?? 0;
    const visible = this.logs().length;
    if (visible === 0) {
      return `0 of ${total} entries`;
    }
    const start = offset + 1;
    const end = Math.min(offset + visible, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.tasksResource.error();
    return e ? extractApiError(e, 'Failed to load scheduled tasks') : null;
  });

  readonly taskForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    task_type: ['discovery_run' as ScheduledTaskTypeV1, [Validators.required]],
    discovery_config_id: [''],
    cron_expression: ['', [Validators.required]],
    enabled: [true]
  });

  readonly taskTypeLabel = (type: ScheduledTaskTypeV1) => TASK_TYPE_LABELS[type] ?? type;
  readonly formatTs = formatTimestamp;
  readonly statusClass = statusChipClass;
  readonly discoveryConfigId = discoveryConfigIdFromTask;
  readonly upstreamSummary = upstreamHealthcheckSummary;
  readonly upstreamTooltip = upstreamHealthcheckTooltip;

  constructor() {
    this.load();
    this.taskForm.controls.task_type.valueChanges.subscribe(type => {
      this.syncDiscoveryValidators(type);
      if (type !== 'upstream_healthcheck') {
        this.resetUpstreamPickerState();
      }
    });
    this.syncDiscoveryValidators(this.taskForm.controls.task_type.value);
  }

  private resetUpstreamPickerState(): void {
    this.upstreamDiscoveryId.set('');
    this.selectedConfigIds.set(new Set());
    this.upstreamRouteOptions.set([]);
    this.upstreamRoutesLoading.set(false);
    this.upstreamRoutesError.set(null);
  }

  private bumpNodesRefresh(): void {
    this.nodesRefreshVersion.update(v => v + 1);
  }

  onUpstreamDiscoveryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.upstreamDiscoveryId.set(value);
    this.loadUpstreamRoutes();
  }

  private loadUpstreamRoutes(): void {
    const discoveryId = this.upstreamDiscoveryId();
    if (!discoveryId) {
      this.upstreamRouteOptions.set([]);
      this.upstreamRoutesError.set(null);
      return;
    }

    const node = this.nodes().find(n => n.discovery_config_id === discoveryId && n.id);
    if (!node?.id) {
      this.upstreamRouteOptions.set([]);
      this.upstreamRoutesError.set('No nodes in this discovery group.');
      return;
    }

    this.upstreamRoutesLoading.set(true);
    this.upstreamRoutesError.set(null);
    this.nodesApi.listLiveConfigIds(node.id).subscribe({
      next: body => {
        const items = body.items ?? [];
        const filtered = items.filter(
          (item): item is CaddyConfigIdInfoV1 & { id: string } =>
            item.has_upstreams === true && typeof item.id === 'string' && item.id.length > 0
        );
        this.upstreamRouteOptions.set(filtered);
        this.upstreamRoutesLoading.set(false);
      },
      error: err => {
        this.upstreamRoutesLoading.set(false);
        this.upstreamRoutesError.set(extractApiError(err, 'Failed to load routes'));
      }
    });
  }

  isConfigIdSelected(id: string | undefined): boolean {
    if (!id) {
      return false;
    }
    return this.selectedConfigIds().has(id);
  }

  toggleConfigId(id: string | undefined, event: Event): void {
    if (!id) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedConfigIds.update(current => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private syncDiscoveryValidators(type: ScheduledTaskTypeV1): void {
    const discoveryControl = this.taskForm.controls.discovery_config_id;
    if (type === 'discovery_run') {
      discoveryControl.setValidators([Validators.required]);
    } else {
      discoveryControl.clearValidators();
      discoveryControl.setValue('');
    }
    discoveryControl.updateValueAndValidity({ emitEvent: false });
  }

  discoveryLabel(id: string): string {
    const match = this.discoveryOptions().find(d => d.id === id);
    return match?.name ? `${match.name} (${id})` : id;
  }

  detailsText(log: ScheduledTaskLogV1): string | null {
    return formatDetailsJson(log.details);
  }

  logRowKey(log: ScheduledTaskLogV1, index: number): string {
    return log.id ?? `row-${index}`;
  }

  isLogExpanded(key: string): boolean {
    return this.expandedLogIds().has(key);
  }

  toggleLogExpanded(key: string): void {
    this.expandedLogIds.update(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  load(): void {
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.resetUpstreamPickerState();
    this.bumpNodesRefresh();
    this.taskForm.reset({
      name: '',
      description: '',
      task_type: 'discovery_run',
      discovery_config_id: '',
      cron_expression: '*/30 * * * *',
      enabled: true
    });
    this.showModal.set(true);
  }

  edit(task: ScheduledTaskV1): void {
    if (!task.id) {
      return;
    }
    this.editingId.set(task.id);
    this.resetUpstreamPickerState();
    this.selectedConfigIds.set(new Set(configIdsFromTask(task)));
    this.bumpNodesRefresh();
    this.taskForm.reset({
      name: task.name,
      description: task.description ?? '',
      task_type: task.task_type,
      discovery_config_id: discoveryConfigIdFromTask(task),
      cron_expression: task.cron_expression,
      enabled: task.enabled !== false
    });
    this.showModal.set(true);
  }

  save(): void {
    if (this.taskForm.invalid) {
      return;
    }
    const value = this.taskForm.getRawValue();
    let config: Record<string, unknown>;
    if (value.task_type === 'discovery_run') {
      config = { discovery_config_id: value.discovery_config_id };
    } else if (value.task_type === 'upstream_healthcheck') {
      const ids = [...this.selectedConfigIds()];
      config = ids.length > 0 ? { config_ids: ids } : {};
    } else {
      config = {};
    }
    const body = {
      name: value.name,
      description: value.description || undefined,
      task_type: value.task_type,
      cron_expression: value.cron_expression,
      enabled: value.enabled,
      config
    };

    this.saving.set(true);
    const id = this.editingId();
    const request$ = id
      ? this.scheduledTasksApi.updateScheduledTask(id, body)
      : this.scheduledTasksApi.createScheduledTask(body);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.actionError.set(extractApiError(err, 'Save failed'));
      }
    });
  }

  async remove(task: ScheduledTaskV1): Promise<void> {
    if (!task.id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete scheduled task',
      message: `Delete “${task.name}”?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.scheduledTasksApi.deleteScheduledTask(task.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Delete failed'))
    });
  }

  runNow(task: ScheduledTaskV1): void {
    if (!task.id) {
      return;
    }
    this.runningId.set(task.id);
    this.scheduledTasksApi.runScheduledTaskNow(task.id).subscribe({
      next: log => {
        this.runningId.set(null);
        const status = log.status ?? 'completed';
        this.lastRunMessage.set(`${new Date().toISOString()} — “${task.name}” run finished (${status}).`);
        this.load();
        if (this.showLogsModal() && this.logsTaskId() === task.id) {
          this.logsRefreshVersion.update(v => v + 1);
        }
      },
      error: err => {
        this.runningId.set(null);
        this.actionError.set(extractApiError(err, 'Run failed'));
      }
    });
  }

  toggleEnabled(task: ScheduledTaskV1): void {
    if (!task.id) {
      return;
    }
    const nextEnabled = task.enabled === false;
    this.togglingId.set(task.id);
    this.scheduledTasksApi.toggleScheduledTask(task.id, nextEnabled).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.load();
      },
      error: err => {
        this.togglingId.set(null);
        this.actionError.set(extractApiError(err, 'Toggle failed'));
      }
    });
  }

  openLogs(task: ScheduledTaskV1): void {
    if (!task.id) {
      return;
    }
    this.logsTaskId.set(task.id);
    this.logsTaskName.set(task.name);
    this.expandedLogIds.set(new Set());
    this.logsDraftFilter.set(emptyLogsDraftFilter());
    this.logsPageSize.set(LOGS_DEFAULT_PAGE_SIZE);
    this.logsAppliedFilter.set(defaultLogsListFilter());
    this.logsRefreshVersion.update(v => v + 1);
    this.showLogsModal.set(true);
  }

  closeLogsModal(): void {
    this.showLogsModal.set(false);
    this.logsTaskId.set(null);
  }

  readSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  readSelectNumber(event: Event): number {
    return Number((event.target as HTMLSelectElement).value);
  }

  readInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  setLogsDraftField<K extends keyof LogsDraftFilter>(field: K, value: LogsDraftFilter[K]): void {
    this.logsDraftFilter.update(draft => ({ ...draft, [field]: value }));
  }

  applyLogsFilters(): void {
    this.logsAppliedFilter.set(draftToAppliedLogsFilter(this.logsDraftFilter(), this.logsPageSize()));
    this.logsRefreshVersion.update(v => v + 1);
  }

  clearLogsFilters(): void {
    this.logsDraftFilter.set(emptyLogsDraftFilter());
    this.logsPageSize.set(LOGS_DEFAULT_PAGE_SIZE);
    this.logsAppliedFilter.set(defaultLogsListFilter());
    this.logsRefreshVersion.update(v => v + 1);
  }

  onLogsPageSizeChange(size: number): void {
    if (!LOGS_PAGE_SIZE_OPTIONS.includes(size as (typeof LOGS_PAGE_SIZE_OPTIONS)[number])) {
      return;
    }
    this.logsPageSize.set(size);
    this.logsAppliedFilter.update(current => ({ ...current, limit: size, offset: 0 }));
    this.logsRefreshVersion.update(v => v + 1);
  }

  logsPrevPage(): void {
    if (!this.logsCanGoPrev()) {
      return;
    }
    const current = this.logsAppliedFilter();
    const limit = current.limit ?? this.logsPageSize();
    const offset = current.offset ?? 0;
    this.logsAppliedFilter.set({ ...current, offset: Math.max(0, offset - limit) });
    this.logsRefreshVersion.update(v => v + 1);
  }

  logsNextPage(): void {
    if (!this.logsCanGoNext()) {
      return;
    }
    const current = this.logsAppliedFilter();
    const limit = current.limit ?? this.logsPageSize();
    const offset = current.offset ?? 0;
    this.logsAppliedFilter.set({ ...current, offset: offset + limit });
    this.logsRefreshVersion.update(v => v + 1);
  }
}
