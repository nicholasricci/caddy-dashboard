import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { StitchIconComponent } from '../../ui/stitch-icon.component';

interface MethodChoice {
  id: 'aws_ssm' | 'aws_tag' | 'static_ip';
  title: string;
  description: string;
  icon: string;
}

type DiscoveryTagRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

type DiscoveryRuleForm = FormGroup<{
  name: FormControl<string>;
  method: FormControl<'aws_ssm' | 'aws_tag' | 'static_ip'>;
  region: FormControl<string>;
  tagRows: FormArray<DiscoveryTagRowForm>;
  addressesText: FormControl<string>;
  enabled: FormControl<boolean>;
}>;

@Component({
  selector: 'app-discovery-rule-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StitchIconComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 stitch-modal-scrim backdrop-blur-md"
        role="presentation"
        tabindex="-1"
        (click)="cancelRequested.emit()"
        (keydown.enter)="cancelRequested.emit()"
        (keydown.space)="$event.preventDefault(); cancelRequested.emit()"
        (keydown.escape)="cancelRequested.emit()"
      >
        <div
          class="bg-stitch-surface-lowest w-full max-w-2xl max-h-[min(90vh,48rem)] overflow-y-auto rounded-sm p-8 border-stitch-ghost shadow-2xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'discovery-modal-title'"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <h3 id="discovery-modal-title" class="font-display text-lg font-semibold mb-2 text-stitch-on-surface flex items-center gap-2">
            @if (editing()) {
              <app-stitch-icon name="edit" />
            } @else {
              <app-stitch-icon name="plus" />
            }
            {{ editing() ? 'Edit rule' : 'New rule' }}
          </h3>

          <form class="space-y-6" [formGroup]="form()">
            <div>
              <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="discovery-rule-name"
                >Name</label
              >
              <input id="discovery-rule-name" class="input-technical mt-1" formControlName="name" autocomplete="off" />
            </div>

            <fieldset class="border-0 p-0 m-0 min-w-0">
              <legend class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium mb-3">Discovery method</legend>
              <div class="grid gap-3 sm:grid-cols-3" role="group" aria-label="Discovery method">
                @for (opt of methodChoices(); track opt.id) {
                  <button
                    type="button"
                    class="stitch-panel text-left p-4 transition-colors border-stitch-ghost hover:bg-stitch-surface-low"
                    [class.ring-2]="currentMethod() === opt.id"
                    [class.ring-stitch-primary]="currentMethod() === opt.id"
                    [class.bg-stitch-surface-low]="currentMethod() === opt.id"
                    [attr.aria-pressed]="currentMethod() === opt.id"
                    (click)="methodChanged.emit(opt.id)"
                  >
                    <span class="flex items-start gap-2">
                      <app-stitch-icon [name]="$any(opt.icon)" size="sm" class="text-stitch-primary-fixed shrink-0 mt-0.5" />
                      <span class="min-w-0">
                        <span class="block font-display font-semibold text-sm text-stitch-on-surface">{{ opt.title }}</span>
                        <span class="block text-xs text-stitch-on-surface-variant mt-1 leading-snug">{{ opt.description }}</span>
                      </span>
                    </span>
                  </button>
                }
              </div>
            </fieldset>

            @if (currentMethod() !== 'static_ip') {
              <div>
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="discovery-region">AWS region</label>
                <input id="discovery-region" class="input-technical mt-1 font-mono text-sm" formControlName="region" autocomplete="off" />
              </div>
            }

            @if (currentMethod() === 'aws_tag') {
              <div class="space-y-3">
                <p class="text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium">Resource tags</p>
                @for (row of tagRows().controls; track $index; let ti = $index) {
                  <div class="flex flex-wrap items-end gap-3" [formGroup]="row">
                    <div class="min-w-0 flex-1 basis-[8rem]">
                      <label class="sr-only" [attr.for]="'discovery-tag-key-' + ti">Tag key {{ ti + 1 }}</label>
                      <input [id]="'discovery-tag-key-' + ti" class="input-technical font-mono text-sm" formControlName="key" placeholder="Key" autocomplete="off" />
                    </div>
                    <div class="min-w-0 flex-1 basis-[8rem]">
                      <label class="sr-only" [attr.for]="'discovery-tag-value-' + ti">Tag value {{ ti + 1 }}</label>
                      <input
                        [id]="'discovery-tag-value-' + ti"
                        class="input-technical font-mono text-sm"
                        formControlName="value"
                        placeholder="Value"
                        autocomplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn shrink-0"
                      (click)="removeTagRequested.emit(ti)"
                      [disabled]="tagRows().length <= 1"
                    >
                      <app-stitch-icon name="trash" size="xs" />
                      Remove
                    </button>
                  </div>
                }
                <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm stitch-icon-btn" (click)="addTagRequested.emit()">
                  <app-stitch-icon name="plus" size="xs" />
                  Add tag
                </button>
              </div>
            }

            @if (currentMethod() === 'static_ip') {
              <div>
                <label class="block text-[11px] uppercase tracking-wider text-stitch-on-surface-variant font-medium" for="discovery-addresses"
                  >Addresses / CIDRs</label
                >
                <p class="text-xs text-stitch-on-surface-variant mt-1 mb-2">One IPv4/IPv6 address or CIDR per line.</p>
                <textarea
                  id="discovery-addresses"
                  class="input-technical w-full min-h-[10rem] font-mono text-sm resize-y"
                  formControlName="addressesText"
                  rows="8"
                  spellcheck="false"
                  autocomplete="off"
                ></textarea>
              </div>
            }

            <label class="flex items-center gap-2 text-sm text-stitch-on-surface cursor-pointer" for="discovery-modal-enabled">
              <input id="discovery-modal-enabled" type="checkbox" class="checkbox checkbox-sm rounded-sm" formControlName="enabled" />
              Enabled
            </label>
          </form>
          <div class="flex justify-end gap-3 mt-10">
            <button type="button" class="btn-stitch-secondary btn-stitch-secondary--sm" (click)="cancelRequested.emit()">Cancel</button>
            <button
              type="button"
              class="btn-stitch-primary btn-stitch-primary--sm stitch-icon-btn"
              [disabled]="saving() || form().invalid"
              (click)="saveRequested.emit()"
            >
              @if (saving()) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                <app-stitch-icon name="apply" size="xs" />
                Save
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class DiscoveryRuleFormModalComponent {
  readonly open = input.required<boolean>();
  readonly editing = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly form = input.required<DiscoveryRuleForm>();
  readonly methodChoices = input.required<MethodChoice[]>();

  readonly saveRequested = output<void>();
  readonly cancelRequested = output<void>();
  readonly methodChanged = output<'aws_ssm' | 'aws_tag' | 'static_ip'>();
  readonly addTagRequested = output<void>();
  readonly removeTagRequested = output<number>();

  currentMethod(): 'aws_ssm' | 'aws_tag' | 'static_ip' {
    return this.form().controls.method.value;
  }

  tagRows(): FormArray<DiscoveryTagRowForm> {
    return this.form().controls.tagRows;
  }
}
