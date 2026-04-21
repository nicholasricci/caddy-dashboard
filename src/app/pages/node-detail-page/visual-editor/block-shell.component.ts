import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { StitchIconComponent } from '../../../ui/stitch-icon.component';

@Component({
  selector: 'app-block-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StitchIconComponent],
  template: `
    <section class="stitch-panel !p-0 overflow-hidden">
      <header class="px-4 py-3 md:px-5 border-b border-stitch-ghost bg-stitch-surface-low flex items-center gap-3">
        <button
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
          (click)="collapsed.update(v => !v)"
        >
          <app-stitch-icon name="chevronLeft" size="xs" [class.rotate-180]="!collapsed()" />
        </button>
        <p class="font-display text-sm text-stitch-on-surface leading-none">{{ title() }}</p>
        <span class="text-[10px] uppercase tracking-wider text-stitch-on-surface-variant leading-none">{{ subtitle() }}</span>
        <div class="ml-auto flex items-center gap-2">
          @if (showAdd()) {
            <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="add.emit()">
              <app-stitch-icon name="plus" size="xs" />
              Add
            </button>
          }
          @if (showDuplicate()) {
            <button
              type="button"
              class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
              (click)="duplicate.emit()"
            >
              <app-stitch-icon name="clipboard" size="xs" />
              Duplicate
            </button>
          }
          @if (showRemove()) {
            <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="remove.emit()">
              <app-stitch-icon name="trash" size="xs" class="text-stitch-error" />
              Remove
            </button>
          }
        </div>
      </header>
      @if (!collapsed()) {
        <div class="px-4 py-4 md:px-5">
          <ng-content />
        </div>
      }
    </section>
  `
})
export class BlockShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly showAdd = input(false);
  readonly showDuplicate = input(false);
  readonly showRemove = input(false);

  readonly add = output<void>();
  readonly duplicate = output<void>();
  readonly remove = output<void>();

  protected readonly collapsed = signal(false);
}
