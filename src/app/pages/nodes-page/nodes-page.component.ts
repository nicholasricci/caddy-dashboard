import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import {
  defaultNodeCreateDraft,
  mapCaddyNodeV1ToListItem,
  mapNodeCreateDraftToPayload,
  type NodeCreateDraftVm,
  type NodeListItemVm
} from './nodes-page.vm';

@Component({
  selector: 'app-nodes-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-7xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="server" size="md" class="text-stitch-primary-fixed" />
            Server overview
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 max-w-2xl leading-relaxed">
            Registered Caddy instances. Sync pulls live config via SSM; open a node to edit config, then apply.
          </p>
        </div>
        <button
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
          (click)="load()"
          [disabled]="loading()"
          title="Reload list"
        >
          <app-stitch-icon name="refresh" size="xs" [class.animate-spin]="loading()" />
          Refresh
        </button>
      </header>

      <section class="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="stitch-panel stitch-panel--dim">
          <p class="stitch-panel-title mb-1 flex items-center gap-2">
            <app-stitch-icon name="circleStack" size="xs" />
            Nodes
          </p>
          <p class="font-display text-2xl font-semibold tabular-nums">{{ nodes().length }}</p>
        </div>
        <div class="stitch-panel stitch-panel--dim">
          <p class="stitch-panel-title mb-1 flex items-center gap-2">
            <app-stitch-icon name="chart" size="xs" />
            Online
          </p>
          <p class="font-display text-2xl font-semibold tabular-nums">{{ onlineCount() }}</p>
        </div>
        <div class="stitch-panel stitch-panel--dim">
          <p class="stitch-panel-title mb-1 flex items-center gap-2">
            <app-stitch-icon name="info" size="xs" />
            Offline / unknown
          </p>
          <p class="font-display text-2xl font-semibold tabular-nums">{{ offlineCount() }}</p>
        </div>
        <div class="stitch-panel flex flex-col justify-center">
          <p class="stitch-panel-title mb-3">Actions</p>
          <button type="button" class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn justify-center" (click)="openCreate()">
            <app-stitch-icon name="plus" size="xs" />
            Add node
          </button>
        </div>
      </section>

      @if (error()) {
        <div class="alert text-sm mb-8 rounded-sm border-stitch-ghost bg-stitch-surface-lowest text-stitch-on-surface">
          <span class="text-stitch-error font-medium">{{ error() }}</span>
        </div>
      }

      @if (loading()) {
        <div class="flex justify-center py-24 stitch-panel">
          <span class="loading loading-spinner loading-md text-stitch-on-surface-variant"></span>
        </div>
      } @else if (nodes().length === 0) {
        <div class="stitch-panel stitch-panel--dim text-center py-16 px-8">
          <app-stitch-icon name="server" size="lg" class="mx-auto text-stitch-on-surface-variant mb-4" />
          <p class="text-stitch-on-surface font-medium">No nodes yet</p>
          <p class="text-sm text-stitch-on-surface-variant mt-2 max-w-md mx-auto">
            Add a node manually or use Autodiscovery to import instances from AWS.
          </p>
          <button
            type="button"
            class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn justify-center mt-8"
            (click)="openCreate()"
          >
            <app-stitch-icon name="plus" size="xs" />
            Add your first node
          </button>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-sm stitch-panel p-0 border-stitch-ghost">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                <th class="font-medium py-6 px-4 text-left align-bottom">Name</th>
                <th class="font-medium py-6 px-4 text-left align-bottom">Status</th>
                <th class="font-mono text-[11px] py-6 px-4 text-left align-bottom">Private IP</th>
                <th class="font-mono text-[11px] py-6 px-4 text-left align-bottom">Instance</th>
                <th class="font-medium py-6 px-4 text-left align-bottom">Region</th>
                <th class="font-medium py-6 px-4 text-left align-bottom">SSM</th>
                <th class="py-6 px-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (n of nodes(); track n.id; let i = $index) {
                <tr
                  class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                  [ngClass]="{
                    'bg-transparent': i % 2 === 0,
                    'bg-stitch-surface-low/80': i % 2 !== 0
                  }"
                >
                  <td class="py-6 px-4 font-medium align-middle">{{ n.name || '—' }}</td>
                  <td class="py-6 px-4 align-middle">
                    <span class="stitch-status-chip">{{ n.status || 'unknown' }}</span>
                  </td>
                  <td class="py-6 px-4 font-mono text-xs align-middle text-stitch-on-surface">
                    {{ n.private_ip || '—' }}
                  </td>
                  <td
                    class="py-6 px-4 font-mono text-xs truncate max-w-[10rem] align-middle"
                    [title]="n.instance_id || ''"
                  >
                    {{ n.instance_id || '—' }}
                  </td>
                  <td class="py-6 px-4 align-middle">{{ n.region || '—' }}</td>
                  <td class="py-6 px-4 align-middle font-mono text-xs">{{ n.ssm_enabled ? 'Yes' : 'No' }}</td>
                  <td class="py-6 px-4 text-right align-middle whitespace-nowrap">
                    <a
                      class="text-sm text-stitch-primary-fixed hover:text-stitch-on-surface mr-3 inline-flex items-center gap-1"
                      [routerLink]="['/nodes', n.id]"
                    >
                      <app-stitch-icon name="configure" size="xs" />
                      Configure
                    </a>
                    <button
                      type="button"
                      class="text-sm text-stitch-error hover:underline inline-flex items-center gap-1"
                      (click)="remove(n)"
                    >
                      <app-stitch-icon name="trash" size="xs" />
                      Delete
                    </button>
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
            class="bg-stitch-surface-lowest w-full max-w-md rounded-sm border-stitch-ghost p-8 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nodes-create-title"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h3
              id="nodes-create-title"
              class="font-display text-lg font-semibold mb-6 text-stitch-on-surface flex items-center gap-2"
            >
              <app-stitch-icon name="plus" />
              New node
            </h3>
            <div class="space-y-5">
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-name"
                  >Name</label
                >
                <input
                  id="nodes-modal-name"
                  class="input-technical mt-1"
                  [(ngModel)]="draft.name"
                  placeholder="production-edge"
                />
              </div>
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-private-ip"
                  >Private IP</label
                >
                <input
                  id="nodes-modal-private-ip"
                  class="input-technical mt-1 font-mono text-sm"
                  [(ngModel)]="draft.private_ip"
                  placeholder="10.0.1.50"
                />
              </div>
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-instance-id"
                  >Instance ID</label
                >
                <input
                  id="nodes-modal-instance-id"
                  class="input-technical mt-1 font-mono text-sm"
                  [(ngModel)]="draft.instance_id"
                  placeholder="i-0abc…"
                />
              </div>
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-region"
                  >Region</label
                >
                <input
                  id="nodes-modal-region"
                  class="input-technical mt-1 font-mono text-sm"
                  [(ngModel)]="draft.region"
                  placeholder="eu-south-1"
                />
              </div>
              <label class="flex items-center gap-2 cursor-pointer text-sm text-stitch-on-surface" for="nodes-modal-ssm">
                <input
                  id="nodes-modal-ssm"
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-sm"
                  [(ngModel)]="draft.ssm_enabled"
                />
                SSM enabled
              </label>
            </div>
            <div class="flex justify-end gap-3 mt-10">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="saving()"
                (click)="saveCreate()"
              >
                @if (saving()) {
                  <span class="loading loading-spinner loading-xs"></span>
                } @else {
                  <app-stitch-icon name="plus" size="xs" />
                  Create
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class NodesPageComponent {
  private readonly api = inject(DashboardApiService);

  readonly nodes = signal<NodeListItemVm[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly saving = signal(false);

  readonly onlineCount = computed(() =>
    this.nodes().filter(n => this.isOnlineStatus(n.status)).length
  );

  readonly offlineCount = computed(() => {
    const total = this.nodes().length;
    return total - this.onlineCount();
  });

  draft: NodeCreateDraftVm = defaultNodeCreateDraft();

  constructor() {
    this.load();
  }

  private isOnlineStatus(status: string | undefined): boolean {
    if (!status) {
      return false;
    }
    return /online|up|healthy|running|active|ok/i.test(status);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listNodes().subscribe({
      next: rows => {
        this.nodes.set((rows ?? []).map(mapCaddyNodeV1ToListItem));
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error || 'Failed to load nodes');
        this.loading.set(false);
      }
    });
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openCreate(): void {
    this.draft = defaultNodeCreateDraft();
    this.showModal.set(true);
  }

  saveCreate(): void {
    this.saving.set(true);
    this.api.createNode(mapNodeCreateDraftToPayload(this.draft)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Create failed');
      }
    });
  }

  remove(n: NodeListItemVm): void {
    if (!n.id || !confirm(`Delete node ${n.name || n.id}?`)) {
      return;
    }
    this.api.deleteNode(n.id).subscribe({
      next: () => this.load(),
      error: err => this.error.set(err?.error?.error || 'Delete failed')
    });
  }
}
