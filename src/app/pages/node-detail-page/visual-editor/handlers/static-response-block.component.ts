import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StaticResponseHandler } from '../types';
import { parseJsonObject, safeObject } from '../value-utils';

@Component({
  selector: 'app-static-response-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4">
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Status code</span>
        <input
          type="number"
          class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs"
          [value]="value().status_code ?? 200"
          (change)="onStatus(($any($event.target).value ?? '').toString())"
        />
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Body</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="value().body ?? ''"
          (change)="onBody(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Headers (JSON object)</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="headersText()"
          (change)="onHeaders(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
    </div>
  `
})
export class StaticResponseBlockComponent {
  readonly value = input.required<StaticResponseHandler>();
  readonly valueChanged = output<StaticResponseHandler>();

  headersText(): string {
    return JSON.stringify(safeObject(this.value().headers), null, 2);
  }

  onStatus(raw: string): void {
    const parsed = Number(raw);
    const status_code = Number.isFinite(parsed) ? parsed : 200;
    this.valueChanged.emit({ ...this.value(), status_code });
  }

  onBody(body: string): void {
    this.valueChanged.emit({ ...this.value(), body });
  }

  onHeaders(text: string): void {
    const headers = parseJsonObject(text, safeObject(this.value().headers));
    this.valueChanged.emit({ ...this.value(), headers: headers as Record<string, string[]> });
  }
}
