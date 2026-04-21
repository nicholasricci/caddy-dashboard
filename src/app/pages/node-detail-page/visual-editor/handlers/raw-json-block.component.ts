import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-raw-json-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="form-control w-full">
      <span class="label-text text-xs text-stitch-on-surface-variant">Raw JSON</span>
      <textarea
        class="textarea textarea-bordered min-h-32 w-full mt-1.5 px-3 py-2.5 font-mono text-xs"
        [value]="value()"
        (change)="valueChanged.emit(($any($event.target).value ?? '').toString())"
      ></textarea>
    </label>
  `
})
export class RawJsonBlockComponent {
  readonly value = input('{}');
  readonly valueChanged = output<string>();
}
