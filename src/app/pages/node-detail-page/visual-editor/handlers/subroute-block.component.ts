import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RawJsonBlockComponent } from './raw-json-block.component';
import type { SubrouteHandler } from '../types';

@Component({
  selector: 'app-subroute-block',
  standalone: true,
  imports: [RawJsonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <app-raw-json-block [value]="routesJson()" (valueChanged)="setRoutesJson($event)" />
    </div>
  `
})
export class SubrouteBlockComponent {
  readonly value = input.required<SubrouteHandler>();
  readonly valueChanged = output<SubrouteHandler>();

  routesJson(): string {
    return JSON.stringify(this.value().routes ?? [], null, 2);
  }

  setRoutesJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        this.valueChanged.emit({ ...this.value(), routes: parsed });
      }
    } catch {
      // keep previous valid routes
    }
  }
}
