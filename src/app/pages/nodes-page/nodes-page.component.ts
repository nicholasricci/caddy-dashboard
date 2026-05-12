import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { forkJoin, map, startWith } from 'rxjs';
import { RouterModule } from '@angular/router';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import type { CaddyTransportV1, DiscoveryConfigV1 } from '../../models/api-v1.model';
import { LiveConfigIdDialogComponent } from '../node-detail-page/live-config-id-dialog.component';
import {
  buildDiscoveryGroups,
  defaultNodeCreateDraft,
  mapCaddyNodeV1ToListItem,
  mapNodeCreateDraftToPayload,
  type NodeCreateDraftVm,
  type NodeListItemVm
} from './nodes-page.vm';
import { extractApiError } from '../../core/http-error.util';
import { normalizeDiscoveryRows, normalizeNodeRows } from '../../core/api-list-normalize.util';

const sshTransportValidator: ValidatorFn = (ac: AbstractControl): ValidationErrors | null => {
  const transport = ac.get('transport')?.value as string | undefined;
  if (transport !== 'ssh') {
    return null;
  }
  const user = String(ac.get('ssh_user')?.value ?? '').trim();
  const pk = String(ac.get('ssh_private_key_ref')?.value ?? '').trim();
  const host = String(ac.get('ssh_host')?.value ?? '').trim();
  const sip = String(ac.get('ssh_private_ip')?.value ?? '').trim();
  if (!user || !pk || (!host && !sip)) {
    return { sshTransport: true };
  }
  return null;
};

@Component({
  selector: 'app-nodes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, ReactiveFormsModule, StitchIconComponent, LiveConfigIdDialogComponent],
  template: `
    <div class="px-10 py-12 max-w-7xl mx-auto">
      <header class="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
            <app-stitch-icon name="server" size="md" class="text-stitch-primary-fixed" />
            Server overview
          </h2>
          <p class="text-sm text-stitch-on-surface-variant mt-3 max-w-2xl leading-relaxed">
            Registered Caddy instances. Sync pulls live config using each node’s transport; open a node to edit
            config, then apply.
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
        <div class="space-y-4">
          @for (group of discoveryGroups(); track group.id) {
            <section class="stitch-panel p-0 overflow-hidden">
              <header class="px-4 py-4 border-b border-stitch-ghost flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="font-display font-semibold text-base text-stitch-on-surface">{{ group.name }}</h3>
                  <p class="text-xs font-mono text-stitch-on-surface-variant mt-1">
                    {{ group.method }}
                    @if (group.region) {
                      <span> · {{ group.region }}</span>
                    }
                    <span> · snapshots: {{ group.snapshot_scope }}</span>
                    @if (!group.isUnassigned) {
                      <span> · {{ group.enabled ? 'enabled' : 'disabled' }}</span>
                    }
                  </p>
                </div>
                @if (group.isUnassigned) {
                  <button
                    type="button"
                    class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
                    (click)="openCreate()"
                  >
                    <app-stitch-icon name="plus" size="xs" />
                    Add node
                  </button>
                }
              </header>

              @if (group.nodes.length === 0) {
                <p class="px-4 py-6 text-sm text-stitch-on-surface-variant">No nodes in this group.</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="table w-full border-collapse">
                    <thead>
                      <tr class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant border-b border-stitch-ghost">
                        <th class="font-medium py-4 px-4 text-left align-bottom">Name</th>
                        <th class="font-medium py-4 px-4 text-left align-bottom">Status</th>
                        <th class="font-mono text-[11px] py-4 px-4 text-left align-bottom">Private IP</th>
                        <th class="font-mono text-[11px] py-4 px-4 text-left align-bottom">Instance</th>
                        <th class="font-medium py-4 px-4 text-left align-bottom">Transport</th>
                        <th class="font-medium py-4 px-4 text-left align-bottom">Region</th>
                        <th class="py-4 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (n of group.nodes; track n.id; let i = $index) {
                        <tr
                          class="text-sm hover:bg-stitch-surface-container/40 transition-colors"
                          [class.bg-transparent]="i % 2 === 0"
                          [class.bg-stitch-surface-low/80]="i % 2 !== 0"
                        >
                          <td class="py-4 px-4 font-medium align-middle">{{ n.name || '—' }}</td>
                          <td class="py-4 px-4 align-middle">
                            <span class="stitch-status-chip">{{ n.status || 'unknown' }}</span>
                          </td>
                          <td class="py-4 px-4 font-mono text-xs align-middle text-stitch-on-surface">{{ n.private_ip || '—' }}</td>
                          <td
                            class="py-4 px-4 font-mono text-xs truncate max-w-[10rem] align-middle"
                            [title]="n.instance_id || ''"
                          >
                            {{ n.instance_id || '—' }}
                          </td>
                          <td class="py-4 px-4 align-middle font-mono text-xs">{{ n.transport }}</td>
                          <td class="py-4 px-4 align-middle text-sm">
                            @if (n.transport === 'aws_ssm') {
                              {{ n.region || '—' }}
                            } @else {
                              —
                            }
                          </td>
                          <td class="py-4 px-4 text-right align-middle whitespace-nowrap">
                            <a
                              class="text-sm text-stitch-primary-fixed hover:text-stitch-on-surface mr-3 inline-flex items-center gap-1"
                              [routerLink]="['/nodes', n.id]"
                            >
                              <app-stitch-icon name="configure" size="xs" />
                              Configure
                            </a>
                            <button
                              type="button"
                              class="text-sm text-stitch-on-surface-variant hover:text-stitch-on-surface mr-3 inline-flex items-center gap-1"
                              (click)="openLiveConfigIdDialog(n)"
                              [disabled]="!n.id"
                            >
                              <app-stitch-icon name="circleStack" size="xs" />
                              Explore @id
                            </button>
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
            </section>
          }
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
            class="bg-stitch-surface-lowest w-full max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto rounded-sm border-stitch-ghost p-8 shadow-2xl"
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
            <form class="space-y-5" [formGroup]="createForm">
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-name"
                  >Name</label
                >
                <input
                  id="nodes-modal-name"
                  class="input-technical mt-1"
                  formControlName="name"
                  placeholder="production-edge"
                />
              </div>
              <div>
                <label
                  class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                  for="nodes-modal-transport"
                  >Transport</label
                >
                <select id="nodes-modal-transport" class="select-technical mt-1 w-full" formControlName="transport">
                  <option value="aws_ssm">AWS SSM (default)</option>
                  <option value="ssh">SSH</option>
                  <option value="http_admin">HTTP admin</option>
                  <option value="inventory_only">Inventory only</option>
                </select>
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
                  formControlName="private_ip"
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
                  formControlName="instance_id"
                  placeholder="i-0abc…"
                />
              </div>
              @if (createTransport() === 'aws_ssm') {
                <div>
                  <label
                    class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                    for="nodes-modal-region"
                    >AWS region</label
                  >
                  <input
                    id="nodes-modal-region"
                    class="input-technical mt-1 font-mono text-sm"
                    formControlName="region"
                    placeholder="eu-south-1"
                  />
                </div>
              }
              @if (createTransport() === 'ssh') {
                <div class="space-y-4 border-t border-stitch-ghost pt-4">
                  <p class="text-xs text-stitch-on-surface-variant">SSH transport requires user, private key ref, and host or private IP.</p>
                  <div>
                    <label
                      class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                      for="nodes-modal-ssh-user"
                      >SSH user</label
                    >
                    <input id="nodes-modal-ssh-user" class="input-technical mt-1 font-mono text-sm" formControlName="ssh_user" />
                  </div>
                  <div>
                    <label
                      class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                      for="nodes-modal-ssh-pk"
                      >Private key ref</label
                    >
                    <input
                      id="nodes-modal-ssh-pk"
                      class="input-technical mt-1 font-mono text-sm"
                      formControlName="ssh_private_key_ref"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                      for="nodes-modal-ssh-host"
                      >Host</label
                    >
                    <input id="nodes-modal-ssh-host" class="input-technical mt-1 font-mono text-sm" formControlName="ssh_host" />
                  </div>
                  <div>
                    <label
                      class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                      for="nodes-modal-ssh-pip"
                      >Private IP (target)</label
                    >
                    <input
                      id="nodes-modal-ssh-pip"
                      class="input-technical mt-1 font-mono text-sm"
                      formControlName="ssh_private_ip"
                    />
                  </div>
                </div>
              }
              @if (createTransport() === 'http_admin') {
                <div>
                  <label
                    class="block text-[11px] font-medium uppercase tracking-wider text-stitch-on-surface-variant"
                    for="nodes-modal-http-base"
                    >Admin base URL</label
                  >
                  <input
                    id="nodes-modal-http-base"
                    class="input-technical mt-1 font-mono text-sm"
                    formControlName="http_base_url"
                    placeholder="https://10.0.0.5:2019"
                  />
                </div>
              }
              @if (createForm.errors?.['sshTransport'] && createTransport() === 'ssh') {
                <p class="text-sm text-stitch-error">Enter user, private key ref, and either host or private IP.</p>
              }
            </form>
            <div class="flex justify-end gap-3 mt-10">
              <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="closeModal()">
                Cancel
              </button>
              <button
                type="button"
                class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
                [disabled]="saving() || createForm.invalid"
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

      <app-live-config-id-dialog
        [open]="liveConfigIdDialogOpen()"
        [nodeId]="liveConfigIdDialogNodeId()"
        [nodeName]="liveConfigIdDialogNodeName()"
        (closeRequested)="closeLiveConfigIdDialog()"
      />
    </div>
  `
})
export class NodesPageComponent {
  private readonly api = inject(DashboardApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly showModal = signal(false);
  readonly liveConfigIdDialogOpen = signal(false);
  readonly liveConfigIdDialogNodeId = signal('');
  readonly liveConfigIdDialogNodeName = signal('');
  readonly saving = signal(false);
  readonly actionError = signal<string | null>(null);
  private readonly refreshVersion = signal(0);

  readonly createForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required]],
      transport: ['aws_ssm' as CaddyTransportV1],
      private_ip: [''],
      instance_id: [''],
      region: [''],
      ssh_user: [''],
      ssh_private_key_ref: [''],
      ssh_host: [''],
      ssh_private_ip: [''],
      http_base_url: ['']
    },
    { validators: [sshTransportValidator] }
  );

  readonly createTransport = toSignal(
    this.createForm.controls.transport.valueChanges.pipe(
      startWith(this.createForm.controls.transport.value)
    ),
    { initialValue: this.createForm.controls.transport.value }
  );

  readonly nodesResource = rxResource({
    stream: () => {
      this.refreshVersion();
      return forkJoin({
        nodes: this.api.listNodes(),
        discovery: this.api.listDiscovery()
      }).pipe(
        map(result => ({
          nodes: normalizeNodeRows(result.nodes).map(mapCaddyNodeV1ToListItem),
          discovery: normalizeDiscoveryRows(result.discovery)
        }))
      );
    }
  });

  readonly nodes = computed(() => (this.nodesResource.value() as { nodes: NodeListItemVm[] } | undefined)?.nodes ?? []);
  readonly discoveryGroups = computed(() => {
    const value = this.nodesResource.value() as { nodes: NodeListItemVm[]; discovery: DiscoveryConfigV1[] } | undefined;
    if (!value) {
      return [];
    }
    return buildDiscoveryGroups(value.nodes, value.discovery);
  });
  readonly loading = computed(() => this.nodesResource.isLoading());
  readonly error = computed(() => {
    const actionErr = this.actionError();
    if (actionErr) {
      return actionErr;
    }
    const e = this.nodesResource.error();
    return e ? extractApiError(e, 'Failed to load nodes') : null;
  });

  readonly onlineCount = computed(() =>
    this.nodes().filter(n => this.isOnlineStatus(n.status)).length
  );

  readonly offlineCount = computed(() => {
    const total = this.nodes().length;
    return total - this.onlineCount();
  });

  constructor() {
    this.syncTransportValidators();
    this.createForm.controls.transport.valueChanges.subscribe(() => this.syncTransportValidators());
    this.load();
  }

  private syncTransportValidators(): void {
    const t = this.createForm.controls.transport.value;
    const region = this.createForm.controls.region;
    const httpUrl = this.createForm.controls.http_base_url;
    const su = this.createForm.controls.ssh_user;
    const spk = this.createForm.controls.ssh_private_key_ref;
    const sh = this.createForm.controls.ssh_host;
    const spip = this.createForm.controls.ssh_private_ip;

    region.clearValidators();
    httpUrl.clearValidators();
    su.clearValidators();
    spk.clearValidators();
    sh.clearValidators();
    spip.clearValidators();

    if (t === 'aws_ssm') {
      region.setValidators([Validators.required]);
    } else if (t === 'http_admin') {
      httpUrl.setValidators([Validators.required]);
    } else if (t === 'ssh') {
      su.setValidators([Validators.required]);
      spk.setValidators([Validators.required]);
    }

    region.updateValueAndValidity({ emitEvent: false });
    httpUrl.updateValueAndValidity({ emitEvent: false });
    su.updateValueAndValidity({ emitEvent: false });
    spk.updateValueAndValidity({ emitEvent: false });
    sh.updateValueAndValidity({ emitEvent: false });
    spip.updateValueAndValidity({ emitEvent: false });
    this.createForm.updateValueAndValidity({ emitEvent: false });
  }

  private isOnlineStatus(status: string | undefined): boolean {
    if (!status) {
      return false;
    }
    return /online|up|healthy|running|active|ok/i.test(status);
  }

  load(): void {
    this.actionError.set(null);
    this.refreshVersion.update(v => v + 1);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openCreate(): void {
    const d = defaultNodeCreateDraft();
    this.createForm.reset({
      name: d.name,
      transport: d.transport,
      private_ip: d.private_ip,
      instance_id: d.instance_id,
      region: d.region,
      ssh_user: d.ssh_user,
      ssh_private_key_ref: d.ssh_private_key_ref,
      ssh_host: d.ssh_host,
      ssh_private_ip: d.ssh_private_ip,
      http_base_url: d.http_base_url
    });
    this.syncTransportValidators();
    this.showModal.set(true);
  }

  saveCreate(): void {
    if (this.createForm.invalid) {
      return;
    }
    this.saving.set(true);
    this.api.createNode(mapNodeCreateDraftToPayload(this.createForm.getRawValue() as NodeCreateDraftVm)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.actionError.set(extractApiError(err, 'Create failed'));
      }
    });
  }

  openLiveConfigIdDialog(n: NodeListItemVm): void {
    if (!n.id) {
      return;
    }
    this.liveConfigIdDialogNodeId.set(n.id);
    this.liveConfigIdDialogNodeName.set(n.name || n.id);
    this.liveConfigIdDialogOpen.set(true);
  }

  closeLiveConfigIdDialog(): void {
    this.liveConfigIdDialogOpen.set(false);
    this.liveConfigIdDialogNodeId.set('');
    this.liveConfigIdDialogNodeName.set('');
  }

  async remove(n: NodeListItemVm): Promise<void> {
    if (!n.id) {
      return;
    }
    const confirmed = await this.confirmService.ask({
      title: 'Delete node',
      message: `Delete node ${n.name || n.id}?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.api.deleteNode(n.id).subscribe({
      next: () => this.load(),
      error: err => this.actionError.set(extractApiError(err, 'Delete failed'))
    });
  }
}
