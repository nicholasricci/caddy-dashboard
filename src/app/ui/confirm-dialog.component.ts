import { Component, output, input, ElementRef, viewChild, effect, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[100] flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md',
    role: 'presentation',
    tabindex: '-1',
    '(click)': 'onBackdropClick($event)',
    '(keydown.enter)': 'cancelled.emit()',
    '(keydown.space)': '$event.preventDefault(); cancelled.emit()',
    '(keydown.escape)': 'cancelled.emit()'
  },
  template: `
    <div
      class="bg-stitch-surface-lowest rounded-sm p-8 w-full max-w-md border-stitch-ghost shadow-2xl"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="descriptionId"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      <h3 [id]="titleId" class="font-display text-lg font-semibold mb-4 text-stitch-on-surface">
        {{ title() }}
      </h3>
      @if (message()) {
        <p [id]="descriptionId" class="text-sm text-stitch-on-surface-variant mb-8">
          {{ message() }}
        </p>
      }
      <div class="flex justify-end gap-3">
        <button
          #cancelButton
          type="button"
          class="btn-stitch-secondary btn-stitch-secondary--sm"
          [disabled]="busy()"
          (click)="cancelled.emit()"
        >
          {{ cancelLabel() }}
        </button>
        <button
          type="button"
          class="btn-stitch-primary btn-stitch-primary--sm"
          [class.btn-stitch-danger]="variant() === 'danger'"
          [disabled]="busy()"
          (click)="confirmed.emit()"
        >
          @if (busy()) {
            <span class="loading loading-spinner loading-xs"></span>
          } @else {
            {{ confirmLabel() }}
          }
        </button>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly variant = input<'default' | 'danger'>('default');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  readonly titleId = `confirm-dialog-title-${Math.random().toString(36).slice(2)}`;
  readonly descriptionId = `confirm-dialog-description-${Math.random().toString(36).slice(2)}`;

  constructor() {
    effect(() => {
      this.title();
      queueMicrotask(() => this.cancelButton()?.nativeElement.focus());
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }
}
