import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { FileServerHandler } from '../types';
import { fromLines, toLines } from '../value-utils';

@Component({
  selector: 'app-file-server-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4">
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Root</span>
        <input
          type="text"
          class="input input-bordered w-full mt-1.5 px-3 font-mono text-xs"
          [value]="value().root ?? ''"
          (change)="onRoot(($any($event.target).value ?? '').toString())"
        />
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Directory listing</span>
        <span class="mt-1.5 inline-flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            [checked]="value().browse === true"
            (change)="onBrowse(!!$any($event.target).checked)"
          />
          <span class="text-xs text-stitch-on-surface-variant">Enable directory browse</span>
        </span>
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-stitch-on-surface-variant">Hide paths (one per line)</span>
        <textarea
          class="textarea textarea-bordered w-full min-h-24 mt-1.5 px-3 py-2.5 font-mono text-xs"
          [value]="hideText()"
          (change)="onHide(($any($event.target).value ?? '').toString())"
        ></textarea>
      </label>
    </div>
  `
})
export class FileServerBlockComponent {
  readonly value = input.required<FileServerHandler>();
  readonly valueChanged = output<FileServerHandler>();

  hideText(): string {
    return toLines(this.value().hide);
  }

  onRoot(root: string): void {
    this.valueChanged.emit({ ...this.value(), root });
  }

  onBrowse(browse: boolean): void {
    this.valueChanged.emit({ ...this.value(), browse });
  }

  onHide(text: string): void {
    this.valueChanged.emit({ ...this.value(), hide: fromLines(text) });
  }
}
