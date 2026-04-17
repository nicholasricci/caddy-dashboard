import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

@Component({
  selector: 'app-node-config-editor',
  standalone: true,
  imports: [CommonModule, StitchIconComponent],
  template: `
    <div class="flex-1 min-w-0 min-h-0 bg-stitch-surface-lowest flex flex-col">
      @if (showToolbar()) {
        <div
          class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stitch-ghost bg-stitch-surface-low shrink-0"
        >
          <button
            type="button"
            class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
            (click)="formatClick.emit()"
          >
            <app-stitch-icon name="sparkles" size="xs" />
            Format JSON
          </button>
          <button
            type="button"
            class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn"
            (click)="copyClick.emit()"
          >
            <app-stitch-icon name="clipboard" size="xs" />
            Copy
          </button>
          <span class="text-[10px] uppercase tracking-wider text-stitch-on-surface-variant ml-auto font-medium">
            Editor
          </span>
        </div>
      }
      <div #editorHost class="flex-1 min-h-0 min-h-[24rem] w-full relative"></div>
      @if (showDiffHost()) {
        <div #diffHost class="flex-1 min-h-0 min-h-[min(65vh,36rem)] w-full relative"></div>
      }
    </div>
  `
})
export class NodeConfigEditorComponent {
  readonly showToolbar = input(true);
  readonly showDiffHost = input(false);

  readonly formatClick = output<void>();
  readonly copyClick = output<void>();

  @ViewChild('editorHost') editorHost?: ElementRef<HTMLDivElement>;
  @ViewChild('diffHost') diffHost?: ElementRef<HTMLDivElement>;
}
