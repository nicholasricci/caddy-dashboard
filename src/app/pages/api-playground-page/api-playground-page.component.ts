import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { DiscoveryApiService } from '../../services/api/discovery-api.service';
import { API_KEY_SCOPE_REGISTER_UPSTREAM, type RegisterUpstreamRequestV1, type RegisterUpstreamResponseV1 } from '../../models/api-v1.model';
import { normalizeDiscoveryRows } from '../../core/api-list-normalize.util';
import { StitchIconComponent } from '../../ui/stitch-icon.component';
import { ConfirmService } from '../../ui/confirm.service';
import { extractApiError } from '../../core/http-error.util';

type TargetMode = 'dial' | 'private_ip';
type ResultKind = 'preview' | 'applied';

interface PlaygroundResult {
  kind: ResultKind;
  response: RegisterUpstreamResponseV1;
}

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
          <span class="font-mono text-stitch-on-surface">{{ registerUpstreamScope }}</span>). Session JWT is not used for
          these calls.
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
              <option value="register_upstream">register_upstream — POST /discovery/:id/register-upstream</option>
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

          <div>
            <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="playground-discovery"
              >Discovery group</label
            >
            <select id="playground-discovery" class="select select-bordered w-full mt-1 text-sm" formControlName="discoveryId">
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
                    for="playground-private-ip"
                    >private_ip</label
                  >
                  <input
                    id="playground-private-ip"
                    class="input-technical mt-1 font-mono"
                    formControlName="privateIp"
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
            [disabled]="busy() || form.invalid"
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
            @if (r.response.dial) {
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
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly registerUpstreamScope = API_KEY_SCOPE_REGISTER_UPSTREAM;

  readonly busy = signal(false);
  readonly pendingAction = signal<'preview' | 'send' | null>(null);
  readonly formError = signal<string | null>(null);
  readonly requestError = signal<string | null>(null);
  readonly result = signal<PlaygroundResult | null>(null);
  readonly previewFingerprint = signal<string | null>(null);
  private readonly formRevision = signal(0);

  readonly discoveryResource = rxResource({
    stream: () => this.discoveryApi.listDiscovery()
  });

  readonly discoveryConfigs = computed(() => normalizeDiscoveryRows(this.discoveryResource.value()));

  readonly form = this.fb.nonNullable.group({
    operation: [{ value: 'register_upstream', disabled: true }],
    apiKeySecret: ['', [Validators.required]],
    discoveryId: ['', [Validators.required]],
    configId: ['', [Validators.required]],
    targetMode: ['dial' as TargetMode],
    dial: [''],
    privateIp: [''],
    port: ['']
  });

  readonly targetMode = computed(() => this.form.controls.targetMode.value as TargetMode);

  readonly canSend = computed(() => {
    this.formRevision();
    if (!this.previewFingerprint() || this.previewStale()) {
      return false;
    }
    return this.form.valid && !this.busy();
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
  }

  discoveryOptionLabel(cfg: { id?: string; name?: string }): string {
    const id = cfg.id ?? '';
    const name = cfg.name?.trim();
    return name ? `${name} (${id})` : id;
  }

  formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  preview(): void {
    void this.execute('preview', true);
  }

  async send(): Promise<void> {
    const confirmed = await this.confirmService.ask({
      title: 'Send register-upstream?',
      message:
        'This applies the upstream registration to live Caddy config on the discovery group (not a dry-run). Continue?',
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

    const built = this.buildRequestBody(dryRun);
    if (!built.ok) {
      this.formError.set(built.error);
      return;
    }

    const { discoveryId, apiKeySecret, body } = built;

    this.busy.set(true);
    this.pendingAction.set(action);

    this.discoveryApi.registerUpstream(discoveryId, apiKeySecret, body).subscribe({
      next: res => {
        this.busy.set(false);
        this.pendingAction.set(null);
        const kind: ResultKind = dryRun ? 'preview' : 'applied';
        this.result.set({ kind, response: res });
        if (dryRun) {
          this.previewFingerprint.set(this.buildFingerprint());
          this.formRevision.update(v => v + 1);
        }
      },
      error: err => {
        this.busy.set(false);
        this.pendingAction.set(null);
        this.requestError.set(extractApiError(err, 'Request failed'));
      }
    });
  }

  private buildFingerprint(): string {
    const v = this.form.getRawValue();
    return JSON.stringify({
      apiKeySecret: v.apiKeySecret.trim(),
      discoveryId: v.discoveryId,
      configId: v.configId.trim(),
      targetMode: v.targetMode,
      dial: v.dial.trim(),
      privateIp: v.privateIp.trim(),
      port: v.port.trim()
    });
  }

  private buildRequestBody(dryRun: boolean):
    | { ok: true; discoveryId: string; apiKeySecret: string; body: RegisterUpstreamRequestV1 }
    | { ok: false; error: string } {
    if (this.form.invalid) {
      return { ok: false, error: 'Fill in all required fields.' };
    }

    const v = this.form.getRawValue();
    const apiKeySecret = v.apiKeySecret.trim();
    const discoveryId = v.discoveryId.trim();
    const configId = v.configId.trim();

    if (!apiKeySecret || !discoveryId || !configId) {
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
      const privateIp = v.privateIp.trim();
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

    return { ok: true, discoveryId, apiKeySecret, body };
  }
}
