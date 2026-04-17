import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import type { AuditLogEntryV1 } from '../../models/api-v1.model';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { extractApiError } from '../../core/http-error.util';

function toAuditEntries(rows: unknown): AuditLogEntryV1[] {
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

@Component({
  selector: 'app-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StitchIconComponent],
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
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (row of entries(); track trackByEntry($index, row)) {
                <tr>
                  <td>{{ formatTimestamp(row) }}</td>
                  <td>{{ stringify(row['actor']) }}</td>
                  <td>{{ stringify(row['action']) }}</td>
                  <td>{{ stringify(row['target']) }}</td>
                  <td class="max-w-[340px] truncate" [title]="stringify(row['details'])">
                    {{ stringify(row['details']) }}
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
  readonly entries = computed(() => toAuditEntries(this.entriesResource.value() as unknown));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.refreshVersion.update(v => v + 1);
  }

  trackByEntry(index: number, row: AuditLogEntryV1): string {
    const id = row['id'];
    const createdAt = row['created_at'];
    return `${id ?? createdAt ?? 'entry'}-${index}`;
  }

  stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'string') {
      return value || '-';
    }
    return JSON.stringify(value);
  }

  formatTimestamp(entry: AuditLogEntryV1): string {
    const raw = entry['created_at'] ?? entry['timestamp'];
    if (typeof raw !== 'string' || !raw) {
      return '-';
    }
    return raw;
  }
}
