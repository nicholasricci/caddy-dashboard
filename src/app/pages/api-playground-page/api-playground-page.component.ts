import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { UpstreamProfilesApiService } from '../../services/api/upstream-profiles-api.service';
import {
  API_KEY_SCOPE_REGISTER_UPSTREAM,
  type RegisterUpstreamByProfileRequestV1,
  type RegisterUpstreamProfileResponseV1,
  type RegisterUpstreamRequestV1,
  type RegisterUpstreamResponseV1
} from '../../models/api-v1.model';
import { normalizeDiscoveryRows } from '../../core/api-list-normalize.util';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';

type PlaygroundOperation = 'register_upstream' | 'register_upstream_by_profile';
type TargetMode = 'dial' | 'private_ip';
type ResultKind = 'preview' | 'applied';

interface PlaygroundResult {
  kind: ResultKind;
  response: RegisterUpstreamResponseV1 | RegisterUpstreamProfileResponseV1;
}

const PLAYGROUND_OPERATIONS: readonly {
  id: PlaygroundOperation;
  label: string;
}[] = [
  { id: 'register_upstream', label: 'register_upstream — POST /discovery/:id/register-upstream' },
  {
    id: 'register_upstream_by_profile',
    label: 'register_upstream_by_profile — POST /upstream-profiles/:id/register'
  }
];

function parseOptionalPort(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const port = Number.parseInt(trimmed, 10);
  return Number.isFinite(port) ? port : undefined;
}

@Component({
  selector: 'app-api-playground-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent],
  template: `
    <div class="px-10 py-12 max-w-4xl mx-auto">
      <header class="mb-10">
        <h2 class="font-display text-3xl font-semibold tracking-tight text-stitch-on-surface flex items-center gap-3">
          <app-stitch-icon name="sparkles" size="md" class="text-stitch-primary-fixed" />
          API playground
        </h2>
        <p class="text-sm text-stitch-on-surface-variant mt-3 leading-relaxed max-w-2xl">
          Test machine-to-machine endpoints with an API key secret (scope
          <span class="font-mono text-stitch-on-surface">{{ registerUpstreamScope }}</span>). Each operation exposes only
          the parameters its API endpoint expects.
        </p>
      </header>

      <section class="stitch-panel stitch-panel--dim mb-8">
        <p class="stitch-panel-title mb-6">Request</p>

        <form class="space-y-5" [formGroup]="form">
          <div>
            <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-operation"
              >Operation</label
            >
            <select id="playground-operation" class="select select-bordered w-full mt-1 font-mono text-sm" formControlName="operation">
              @for (op of operations; track op.id) {
                <option [value]="op.id">{{ op.label }}</option>
              }
            </select>
          </div>

          <div>
            <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-api-key"
              >API key secret</label
            >
            <input
              id="playground-api-key"
              class="input-technical mt-1 font-mono"
              type="password"
              formControlName="apiKeySecret"
              autocomplete="off"
              placeholder="cdk_live_..."
            />
            <p class="text-xs text-stitch-on-surface-variant mt-1">Not stored; kept in memory for this page only.</p>
          </div>

          @if (operation() === 'register_upstream_by_profile') {
            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="playground-profile-discovery"
                >Discovery group (optional)</label
              >
              <select
                id="playground-profile-discovery"
                class="select select-bordered w-full mt-1 text-sm"
                formControlName="profileDiscoveryHelperId"
              >
                <option value="">— none — loads profile list when selected</option>
                @for (cfg of discoveryConfigs(); track cfg.id) {
                  <option [value]="cfg.id">{{ discoveryOptionLabel(cfg) }}</option>
                }
              </select>
              <p class="text-xs text-stitch-on-surface-variant mt-1">
                Helper only (session JWT). Not sent on the M2M call — paste a profile ID below or pick from the list.
              </p>
            </div>

            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="playground-profile-id"
                >Profile ID</label
              >
              <input
                id="playground-profile-id"
                class="input-technical mt-1 font-mono"
                formControlName="profileId"
                placeholder="prof-…"
                autocomplete="off"
              />
            </div>

            @if (form.controls.profileDiscoveryHelperId.value) {
              <div>
                <label
                  class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                  for="playground-profile-picker"
                  >Pick from list</label
                >
                <select
                  id="playground-profile-picker"
                  class="select select-bordered w-full mt-1 text-sm"
                  formControlName="profilePicker"
                  (change)="applyProfilePick()"
                >
                  <option value="">Select a profile</option>
                  @for (profile of profilesForDiscovery(); track profile.id) {
                    <option [value]="profile.id">{{ profileOptionLabel(profile) }}</option>
                  }
                </select>
                @if (profilesLoading()) {
                  <p class="text-xs text-stitch-on-surface-variant mt-1">Loading profiles…</p>
                } @else if (profilesForDiscovery().length === 0) {
                  <p class="text-xs text-stitch-on-surface-variant mt-1">No upstream profiles for this discovery group.</p>
                }
              </div>
            }

            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="playground-profile-private-ip"
                >private_ip</label
              >
              <input
                id="playground-profile-private-ip"
                class="input-technical mt-1 font-mono"
                formControlName="profilePrivateIp"
                placeholder="10.0.0.5"
                autocomplete="off"
              />
            </div>
          } @else {
            <div>
              <label
                class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                for="playground-upstream-discovery"
                >Discovery group</label
              >
              <select
                id="playground-upstream-discovery"
                class="select select-bordered w-full mt-1 text-sm"
                formControlName="upstreamDiscoveryId"
              >
                <option value="" disabled>Select a discovery rule</option>
                @for (cfg of discoveryConfigs(); track cfg.id) {
                  <option [value]="cfg.id">{{ discoveryOptionLabel(cfg) }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-config-id"
                >config_id</label
              >
              <input
                id="playground-config-id"
                class="input-technical mt-1 font-mono"
                formControlName="configId"
                placeholder="@your-route-id"
                autocomplete="off"
              />
            </div>

            <fieldset class="border-0 p-0 m-0 min-w-0">
              <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-2">Target</legend>
              <div class="flex flex-wrap gap-4 mb-4" role="radiogroup" aria-label="Upstream target mode">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" class="radio radio-sm" formControlName="targetMode" value="dial" />
                  dial (host:port)
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" class="radio radio-sm" formControlName="targetMode" value="private_ip" />
                  private_ip + port
                </label>
              </div>

              @if (targetMode() === 'dial') {
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-dial"
                  >dial</label
                >
                <input
                  id="playground-dial"
                  class="input-technical mt-1 font-mono"
                  formControlName="dial"
                  placeholder="10.0.0.5:8080"
                  autocomplete="off"
                />
              } @else {
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium"
                      for="playground-upstream-private-ip"
                      >private_ip</label
                    >
                    <input
                      id="playground-upstream-private-ip"
                      class="input-technical mt-1 font-mono"
                      formControlName="upstreamPrivateIp"
                      placeholder="10.0.0.5"
                      autocomplete="off"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-port"
                      >port (optional)</label
                    >
                    <input
                      id="playground-port"
                      class="input-technical mt-1 font-mono"
                      formControlName="port"
                      inputmode="numeric"
                      placeholder="8080"
                      autocomplete="off"
                    />
                  </div>
                </div>
              }
            </fieldset>
          }
        </form>

        @if (formError()) {
          <p class="text-sm text-stitch-error mt-4">{{ formError() }}</p>
        }
        @if (requestError()) {
          <p class="text-sm text-stitch-error mt-4">{{ requestError() }}</p>
        }

        <div class="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
            [disabled]="busy() || !canPreview()"
            (click)="preview()"
          >
            @if (busy() && pendingAction() === 'preview') {
              <span class="loading loading-spinner loading-xs"></span>
            } @else {
              <app-stitch-icon name="document" size="xs" />
            }
            Preview (dry-run)
          </button>
          <button
            type="button"
            class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
            [disabled]="busy() || !canSend()"
            (click)="send()"
          >
            @if (busy() && pendingAction() === 'send') {
              <span class="loading loading-spinner loading-xs"></span>
            } @else {
              <app-stitch-icon name="apply" size="xs" />
            }
            Send
          </button>
        </div>
        @if (previewStale()) {
          <p class="text-xs text-amber-700 mt-3">Form changed since last preview — run Preview again before Send.</p>
        }
      </section>

      @if (result(); as r) {
        <section class="stitch-panel mb-8">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <p class="stitch-panel-title mb-0">Result</p>
            <span class="stitch-status-chip">{{ r.kind === 'preview' ? 'Preview' : 'Applied' }}</span>
            @if (r.response.changed !== undefined) {
              <span class="stitch-status-chip">changed: {{ r.response.changed ? 'yes' : 'no' }}</span>
            }
            @if ('dial' in r.response && r.response.dial) {
              <span class="text-xs font-mono text-stitch-on-surface-variant">dial: {{ r.response.dial }}</span>
            }
            @if (r.response.source_node_id) {
              <span class="text-xs font-mono text-stitch-on-surface-variant">node: {{ r.response.source_node_id }}</span>
            }
          </div>
          <pre class="text-xs font-mono whitespace-pre-wrap break-all text-stitch-on-surface-variant leading-relaxed max-h-96 overflow-y-auto">{{ formatJson(r.response) }}</pre>
        </section>
      }
    </div>
  `
})
export class ApiPlaygroundPageComponent {
  private readonly discoveryApi = inject(DiscoveryApiService);
  private readonly profilesApi = inject(UpstreamProfilesApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly operations = PLAYGROUND_OPERATIONS;
  readonly registerUpstreamScope = API_KEY_SCOPE_REGISTER_UPSTREAM;

  readonly busy = signal(false);
  readonly pendingAction = signal<'preview' | 'send' | null>(null);
  readonly formError = signal<string | null>(null);
  readonly requestError = signal<string | null>(null);
  readonly result = signal<PlaygroundResult | null>(null);
  readonly previewFingerprint = signal<string | null>(null);
  private readonly formRevision = signal(0);
  private readonly profileDiscoveryId = signal('');

  readonly discoveryResource = rxResource({
    stream: () => this.discoveryApi.listDiscovery()
  });

  readonly profilesResource = rxResource({
    params: () => ({ discoveryId: this.profileDiscoveryId() }),
    stream: ({ params }) => {
      const discoveryId = params.discoveryId.trim();
      if (!discoveryId) {
        return of([]);
      }
      return this.profilesApi.listForDiscovery(discoveryId);
    }
  });

  readonly discoveryConfigs = computed(() => normalizeDiscoveryRows(this.discoveryResource.value()));
  readonly profilesForDiscovery = computed(() => this.profilesResource.value() ?? []);
  readonly profilesLoading = computed(() => this.profilesResource.isLoading());

  readonly form = this.fb.nonNullable.group({
    operation: ['register_upstream' as PlaygroundOperation],
    apiKeySecret: ['', [Validators.required]],
    profileDiscoveryHelperId: [''],
    profileId: [''],
    profilePicker: [''],
    profilePrivateIp: [''],
    upstreamDiscoveryId: [''],
    configId: [''],
    targetMode: ['dial' as TargetMode],
    dial: [''],
    upstreamPrivateIp: [''],
    port: ['']
  });

  readonly operation = computed(() => {
    this.formRevision();
    return this.form.controls.operation.value as PlaygroundOperation;
  });
  readonly targetMode = computed(() => {
    this.formRevision();
    return this.form.controls.targetMode.value as TargetMode;
  });

  readonly canPreview = computed(() => {
    this.formRevision();
    return this.formValidForOperation() && !this.busy();
  });

  readonly canSend = computed(() => {
    this.formRevision();
    if (!this.previewFingerprint() || this.previewStale()) {
      return false;
    }
    return this.formValidForOperation() && !this.busy();
  });

  readonly previewStale = computed(() => {
    this.formRevision();
    const fp = this.previewFingerprint();
    if (!fp) {
      return false;
    }
    return fp !== this.buildFingerprint();
  });

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.formRevision.update(v => v + 1);
      this.formError.set(null);
      this.requestError.set(null);
    });
    this.form.controls.operation.valueChanges.subscribe(op => {
      this.previewFingerprint.set(null);
      this.result.set(null);
      this.resetInactiveOperationFields(op as PlaygroundOperation);
      this.syncValidators();
      this.formRevision.update(v => v + 1);
    });
    this.form.controls.profileDiscoveryHelperId.valueChanges.subscribe(discoveryId => {
      this.profileDiscoveryId.set(discoveryId ?? '');
      this.form.controls.profilePicker.setValue('', { emitEvent: false });
      this.profilesResource.reload();
    });
    this.syncValidators();
  }

  applyProfilePick(): void {
    const picked = this.form.controls.profilePicker.value.trim();
    if (picked) {
      this.form.controls.profileId.setValue(picked);
    }
  }

  discoveryOptionLabel(cfg: { id?: string; name?: string }): string {
    const id = cfg.id ?? '';
    const name = cfg.name?.trim();
    return name ? `${name} (${id})` : id;
  }

  profileOptionLabel(profile: { id?: string; name?: string }): string {
    const id = profile.id ?? '';
    const name = profile.name?.trim();
    return name ? `${name} (${id})` : id;
  }

  formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  preview(): void {
    void this.execute('preview', true);
  }

  async send(): Promise<void> {
    const title =
      this.operation() === 'register_upstream_by_profile'
        ? 'Send profile register?'
        : 'Send register-upstream?';
    const message =
      this.operation() === 'register_upstream_by_profile'
        ? 'This applies upstream dials for all bindings in the profile on live Caddy config (not a dry-run). Continue?'
        : 'This applies the upstream registration to live Caddy config on the discovery group (not a dry-run). Continue?';
    const confirmed = await this.confirmService.ask({
      title,
      message,
      confirmLabel: 'Send',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    void this.execute('send', false);
  }

  private async execute(action: 'preview' | 'send', dryRun: boolean): Promise<void> {
    this.formError.set(null);
    this.requestError.set(null);

    const built = this.buildRequest(dryRun);
    if (!built.ok) {
      this.formError.set(built.error);
      return;
    }

    this.busy.set(true);
    this.pendingAction.set(action);

    const onSuccess = (res: RegisterUpstreamResponseV1 | RegisterUpstreamProfileResponseV1) => {
      this.busy.set(false);
      this.pendingAction.set(null);
      const kind: ResultKind = dryRun ? 'preview' : 'applied';
      this.result.set({ kind, response: res });
      if (dryRun) {
        this.previewFingerprint.set(this.buildFingerprint());
        this.formRevision.update(v => v + 1);
      }
    };

    const onError = (err: unknown) => {
      this.busy.set(false);
      this.pendingAction.set(null);
      this.requestError.set(extractApiError(err, 'Request failed'));
    };

    if (built.kind === 'register_upstream') {
      const { discoveryId, apiKeySecret, body } = built;
      this.discoveryApi.registerUpstream(discoveryId, apiKeySecret, body).subscribe({
        next: onSuccess,
        error: onError
      });
    } else {
      const { profileId, apiKeySecret, body } = built;
      this.profilesApi.registerByProfile(profileId, apiKeySecret, body).subscribe({
        next: onSuccess,
        error: onError
      });
    }
  }

  private resetInactiveOperationFields(active: PlaygroundOperation): void {
    if (active === 'register_upstream_by_profile') {
      this.form.patchValue(
        {
          upstreamDiscoveryId: '',
          configId: '',
          targetMode: 'dial',
          dial: '',
          upstreamPrivateIp: '',
          port: ''
        },
        { emitEvent: false }
      );
      return;
    }

    this.profileDiscoveryId.set('');
    this.form.patchValue(
      {
        profileDiscoveryHelperId: '',
        profileId: '',
        profilePicker: '',
        profilePrivateIp: ''
      },
      { emitEvent: false }
    );
  }

  private formValidForOperation(): boolean {
    const v = this.form.getRawValue();
    if (!v.apiKeySecret.trim()) {
      return false;
    }
    if (v.operation === 'register_upstream_by_profile') {
      return !!v.profileId.trim() && !!v.profilePrivateIp.trim();
    }
    if (!v.upstreamDiscoveryId.trim() || !v.configId.trim()) {
      return false;
    }
    if (v.targetMode === 'dial') {
      return !!v.dial.trim();
    }
    return !!v.upstreamPrivateIp.trim();
  }

  private syncValidators(): void {
    const isProfile = this.operation() === 'register_upstream_by_profile';
    const { profileId, profilePrivateIp, upstreamDiscoveryId, configId, upstreamPrivateIp } = this.form.controls;

    if (isProfile) {
      profileId.setValidators([Validators.required]);
      profilePrivateIp.setValidators([Validators.required]);
      upstreamDiscoveryId.clearValidators();
      configId.clearValidators();
      upstreamPrivateIp.clearValidators();
    } else {
      profileId.clearValidators();
      profilePrivateIp.clearValidators();
      upstreamDiscoveryId.setValidators([Validators.required]);
      configId.setValidators([Validators.required]);
    }

    for (const control of [profileId, profilePrivateIp, upstreamDiscoveryId, configId, upstreamPrivateIp]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private buildFingerprint(): string {
    const v = this.form.getRawValue();
    if (v.operation === 'register_upstream_by_profile') {
      return JSON.stringify({
        operation: v.operation,
        apiKeySecret: v.apiKeySecret.trim(),
        profileId: v.profileId.trim(),
        profilePrivateIp: v.profilePrivateIp.trim()
      });
    }
    return JSON.stringify({
      operation: v.operation,
      apiKeySecret: v.apiKeySecret.trim(),
      upstreamDiscoveryId: v.upstreamDiscoveryId.trim(),
      configId: v.configId.trim(),
      targetMode: v.targetMode,
      dial: v.dial.trim(),
      upstreamPrivateIp: v.upstreamPrivateIp.trim(),
      port: v.port.trim()
    });
  }

  private buildRequest(dryRun: boolean):
    | { ok: true; kind: 'register_upstream'; discoveryId: string; apiKeySecret: string; body: RegisterUpstreamRequestV1 }
    | {
        ok: true;
        kind: 'register_upstream_by_profile';
        profileId: string;
        apiKeySecret: string;
        body: RegisterUpstreamByProfileRequestV1;
      }
    | { ok: false; error: string } {
    if (!this.formValidForOperation()) {
      return { ok: false, error: 'Fill in all required fields.' };
    }

    const v = this.form.getRawValue();
    const apiKeySecret = v.apiKeySecret.trim();

    if (v.operation === 'register_upstream_by_profile') {
      const profileId = v.profileId.trim();
      const privateIp = v.profilePrivateIp.trim();
      if (!profileId || !privateIp) {
        return { ok: false, error: 'API key, profile ID, and private_ip are required.' };
      }
      return {
        ok: true,
        kind: 'register_upstream_by_profile',
        profileId,
        apiKeySecret,
        body: { private_ip: privateIp, dry_run: dryRun }
      };
    }

    const discoveryId = v.upstreamDiscoveryId.trim();
    const configId = v.configId.trim();
    if (!discoveryId || !configId) {
      return { ok: false, error: 'API key, discovery group, and config_id are required.' };
    }

    const body: RegisterUpstreamRequestV1 = {
      config_id: configId,
      dry_run: dryRun
    };

    if (v.targetMode === 'dial') {
      const dial = v.dial.trim();
      if (!dial) {
        return { ok: false, error: 'dial is required when using dial target mode.' };
      }
      body.dial = dial;
    } else {
      const privateIp = v.upstreamPrivateIp.trim();
      if (!privateIp) {
        return { ok: false, error: 'private_ip is required when using private_ip target mode.' };
      }
      body.private_ip = privateIp;
      const port = parseOptionalPort(v.port);
      if (v.port.trim() && port === undefined) {
        return { ok: false, error: 'port must be a valid integer.' };
      }
      if (port !== undefined) {
        body.port = port;
      }
    }

    return { ok: true, kind: 'register_upstream', discoveryId, apiKeySecret, body };
  }
}
