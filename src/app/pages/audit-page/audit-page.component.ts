import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { rxResource } from '@angular/core/rxjs-interop';
import type { AuditLogEntryV1, AuditLogListMetaV1, AuditLogListResultV1 } from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { extractApiError } from '../../core/http-error.util';

interface AuditRowViewModel {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  summary: string;
  payloadText: string | null;
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium'
});

function toAuditEntries(rows: AuditLogListResultV1 | unknown): AuditLogEntryV1[] {
  if (Array.isArray(rows)) {
    return rows as AuditLogEntryV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const record = rows as Record<string, unknown>;
  if (Array.isArray(record['items'])) {
    return record['items'] as AuditLogEntryV1[];
  }
  return [];
}

function toAuditMeta(rows: AuditLogListResultV1 | unknown): AuditLogListMetaV1 | null {
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) {
    return null;
  }

  const meta = (rows as Record<string, unknown>)['meta'];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }

  return meta as AuditLogListMetaV1;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function displayText(value: unknown, fallback = '-'): string {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function formatTimestamp(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) {
    return '-';
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : timestampFormatter.format(date);
}

function formatPayloadText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeEntry(entry: AuditLogEntryV1, payload: Record<string, unknown> | null): string {
  if (typeof entry['details'] === 'string' && entry['details'].trim()) {
    return entry['details'].trim();
  }

  const parts: string[] = [];
  const pushIfPresent = (label: string, value: unknown): void => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${label}: ${value}`);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${label}: ${value}`);
    }
  };

  if (payload) {
    pushIfPresent('name', payload['name']);
    pushIfPresent('method', payload['method']);
    pushIfPresent('region', payload['region']);
    pushIfPresent('scope', payload['snapshot_scope']);
    if (typeof payload['enabled'] === 'boolean') {
      parts.push(payload['enabled'] ? 'enabled' : 'disabled');
    }
    if (typeof payload['discovered_nodes'] === 'number') {
      const count = payload['discovered_nodes'];
      parts.push(`discovered nodes: ${count}`);
    }
  }

  return parts.join(' · ') || '-';
}

function toAuditRow(entry: AuditLogEntryV1, index: number): AuditRowViewModel {
  const payload = toRecord(entry['payload'] ?? entry['details']);
  const payloadText = formatPayloadText(entry['payload'] ?? entry['details']);

  return {
    id: `${entry['id'] ?? entry['created_at'] ?? 'entry'}-${index}`,
    timestamp: formatTimestamp(entry['created_at'] ?? entry['timestamp']),
    actor: displayText(entry['actor']),
    action: displayText(entry['action']),
    resource: displayText(entry['resource'] ?? entry['target']),
    resourceId: displayText(entry['resource_id']),
    summary: summarizeEntry(entry, payload),
    payloadText
  };
}

@Component({
  selector: 'app-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-6xl mx-auto">
      <header class="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="audit" size="md" class="text-stitch-primary-fixed" />
            Audit log
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed">
            Recent administrative actions and system events.
          </p>
          @if (metaSummary(); as summary) {
            <p class="text-xs text-stitch-on-surface-variant mt-2">{{ summary }}</p>
          }
        </div>
        <button
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
          (click)="load()"
          [disabled]="loading()"
        >
          <app-stitch-icon name="refresh" size="xs" [class.animate-spin]="loading()" />
          Refresh
        </button>
      </header>

      @if (error()) {
        <div class="alert text-sm mb-8 rounded-sm border-stitch-ghost bg-stitch-surface-lowest text-stitch-on-surface">
          <span class="text-stitch-error font-medium">{{ error() }}</span>
        </div>
      }

      @if (loading()) {
        <div class="flex py-16 stitch-panel justify-center">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (entries().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-14 px-6">
          <app-stitch-icon name="audit" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-sm text-stitch-on-surface-variant">No audit entries returned from the API.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="whitespace-nowrap align-top">{{ row.timestamp }}</td>
                  <td class="align-top">{{ row.actor }}</td>
                  <td class="align-top">
                    <span class="stitch-status-chip">{{ row.action }}</span>
                  </td>
                  <td class="align-top min-w-52">
                    <div class="font-medium text-stitch-on-surface">{{ row.resource }}</div>
                    <div class="mt-1 text-xs font-mono text-stitch-on-surface-variant break-all">
                      {{ row.resourceId }}
                    </div>
                  </td>
                  <td class="align-top min-w-80 max-w-[34rem]">
                    <div class="text-sm text-stitch-on-surface break-words">{{ row.summary }}</div>
                    @if (row.payloadText) {
                      <details class="mt-2">
                        <summary class="cursor-pointer text-xs text-stitch-primary select-none">Payload JSON</summary>
                        <pre class="mt-2 overflow-auto rounded-sm bg-stitch-surface-lowest p-3 text-[11px] leading-5 text-stitch-on-surface whitespace-pre-wrap break-all border border-stitch-ghost">{{ row.payloadText }}</pre>
                      </details>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class AuditPageComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly refreshVersion = signal(0);

  readonly entriesResource = rxResource({
    stream: () => {
      this.refreshVersion();
      return this.api.listAuditLogs();
    }
  });
  readonly loading = computed(() => this.entriesResource.isLoading());
  readonly error = computed(() => {
    const e = this.entriesResource.error();
    return e ? extractApiError(e, 'Could not load audit logs') : null;
  });
  readonly entries = computed(() => toAuditEntries(this.entriesResource.value() as AuditLogListResultV1 | unknown));
  readonly rows = computed(() => this.entries().map((entry, index) => toAuditRow(entry, index)));
  readonly meta = computed(() => toAuditMeta(this.entriesResource.value() as AuditLogListResultV1 | unknown));
  readonly metaSummary = computed(() => {
    const meta = this.meta();
    if (!meta || typeof meta['total'] !== 'number') {
      return null;
    }

    const total = meta['total'];
    const visible = this.entries().length;
    if (visible === total) {
      return `${total} entr${total === 1 ? 'y' : 'ies'} loaded`;
    }

    return `Showing ${visible} of ${total} entries`;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.refreshVersion.update(v => v + 1);
  }
}
