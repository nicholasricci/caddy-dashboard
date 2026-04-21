import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ReverseProxyHandler } from '../types';
import { fromLines, parseJsonObject, safeObject, toLines } from '../value-utils';
import { RawJsonBlockComponent } from './raw-json-block.component';

@Component({
  selector: 'app-reverse-proxy-block',
  standalone: true,
  imports: [RawJsonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4">
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Upstreams (dial, one per line)</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="upstreamsText()"
          (change)="onUpstreams(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Headers request (JSON object)</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="requestHeadersText()"
          (change)="onRequestHeaders(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Headers response (JSON object)</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="responseHeadersText()"
          (change)="onResponseHeaders(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
      <app-raw-json-block [value]="transportText()" (valueChanged)="onTransport($event)" />
    </div>
  `
})
export class ReverseProxyBlockComponent {
  readonly value = input.required<ReverseProxyHandler>();
  readonly valueChanged = output<ReverseProxyHandler>();

  upstreamsText(): string {
    return toLines((this.value().upstreams ?? []).map(v => v.dial).filter(v => !!v));
  }

  requestHeadersText(): string {
    return JSON.stringify(safeObject(this.value().headers?.request), null, 2);
  }

  responseHeadersText(): string {
    return JSON.stringify(safeObject(this.value().headers?.response), null, 2);
  }

  transportText(): string {
    return JSON.stringify(safeObject(this.value().transport), null, 2);
  }

  onUpstreams(text: string): void {
    const lines = fromLines(text).map(dial => ({ dial }));
    this.valueChanged.emit({ ...this.value(), upstreams: lines });
  }

  onRequestHeaders(text: string): void {
    const next = parseJsonObject(text, safeObject(this.value().headers?.request));
    this.valueChanged.emit({
      ...this.value(),
      headers: {
        ...(this.value().headers ?? {}),
        request: next
      }
    });
  }

  onResponseHeaders(text: string): void {
    const next = parseJsonObject(text, safeObject(this.value().headers?.response));
    this.valueChanged.emit({
      ...this.value(),
      headers: {
        ...(this.value().headers ?? {}),
        response: next
      }
    });
  }

  onTransport(text: string): void {
    const next = parseJsonObject(text, safeObject(this.value().transport));
    this.valueChanged.emit({ ...this.value(), transport: next });
  }
}
