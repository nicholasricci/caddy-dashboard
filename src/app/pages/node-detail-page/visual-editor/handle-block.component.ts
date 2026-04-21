import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BlockShellComponent } from './block-shell.component';
import type { CaddyHandler, FileServerHandler, ReverseProxyHandler, StaticResponseHandler, SubrouteHandler } from './types';
import { FileServerBlockComponent } from './handlers/file-server-block.component';
import { RawJsonBlockComponent } from './handlers/raw-json-block.component';
import { ReverseProxyBlockComponent } from './handlers/reverse-proxy-block.component';
import { StaticResponseBlockComponent } from './handlers/static-response-block.component';
import { SubrouteBlockComponent } from './handlers/subroute-block.component';

type KnownHandlerType = 'reverse_proxy' | 'static_response' | 'file_server' | 'subroute' | 'raw';

@Component({
  selector: 'app-handle-block',
  standalone: true,
  imports: [
    BlockShellComponent,
    ReverseProxyBlockComponent,
    StaticResponseBlockComponent,
    FileServerBlockComponent,
    RawJsonBlockComponent,
    SubrouteBlockComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-block-shell title="Handler" [subtitle]="value().handler" [showDuplicate]="true" [showRemove]="true" (duplicate)="duplicateRequested.emit()" (remove)="removeRequested.emit()">
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Handler type</span>
        <select class="select select-bordered w-full mt-1.5 px-3 font-mono text-xs" [value]="kind()" (change)="changeKind(($any($event.target).value ?? '').toString())">
          <option value="reverse_proxy">reverse_proxy</option>
          <option value="static_response">static_response</option>
          <option value="file_server">file_server</option>
          <option value="subroute">subroute</option>
          <option value="raw">raw (custom)</option>
        </select>
      </label>

      @switch (kind()) {
        @case ('reverse_proxy') {
          <app-reverse-proxy-block [value]="asReverseProxy()" (valueChanged)="valueChanged.emit($event)" />
        }
        @case ('static_response') {
          <app-static-response-block [value]="asStaticResponse()" (valueChanged)="valueChanged.emit($event)" />
        }
        @case ('file_server') {
          <app-file-server-block [value]="asFileServer()" (valueChanged)="valueChanged.emit($event)" />
        }
        @case ('subroute') {
          <app-subroute-block [value]="asSubroute()" (valueChanged)="valueChanged.emit($event)" />
        }
        @default {
          <app-raw-json-block [value]="rawText()" (valueChanged)="onRaw($event)" />
        }
      }
    </app-block-shell>
  `
})
export class HandleBlockComponent {
  readonly value = input.required<CaddyHandler>();
  readonly valueChanged = output<CaddyHandler>();
  readonly removeRequested = output<void>();
  readonly duplicateRequested = output<void>();

  kind(): KnownHandlerType {
    const h = this.value().handler;
    if (h === 'reverse_proxy' || h === 'static_response' || h === 'file_server' || h === 'subroute') {
      return h;
    }
    return 'raw';
  }

  changeKind(next: string): void {
    if (next === 'reverse_proxy') {
      this.valueChanged.emit({ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] });
      return;
    }
    if (next === 'static_response') {
      this.valueChanged.emit({ handler: 'static_response', status_code: 200, body: '' });
      return;
    }
    if (next === 'file_server') {
      this.valueChanged.emit({ handler: 'file_server', browse: false });
      return;
    }
    if (next === 'subroute') {
      this.valueChanged.emit({ handler: 'subroute', routes: [] });
      return;
    }
    this.valueChanged.emit({ handler: 'custom' });
  }

  rawText(): string {
    return JSON.stringify(this.value(), null, 2);
  }

  onRaw(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as CaddyHandler;
      if (parsed && typeof parsed === 'object' && typeof parsed.handler === 'string') {
        this.valueChanged.emit(parsed);
      }
    } catch {
      // keep previous valid value
    }
  }

  asReverseProxy(): ReverseProxyHandler {
    return this.value() as ReverseProxyHandler;
  }

  asStaticResponse(): StaticResponseHandler {
    return this.value() as StaticResponseHandler;
  }

  asFileServer(): FileServerHandler {
    return this.value() as FileServerHandler;
  }

  asSubroute(): SubrouteHandler {
    return this.value() as SubrouteHandler;
  }
}
