import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardApiService } from '../../services/dashboard-api.service';
import type { CaddyConfigIdInfoV1 } from '../../models/api-v1.model';
import { LiveConfigIdDialogComponent } from './live-config-id-dialog.component';

describe('LiveConfigIdDialogComponent', () => {
  let fixture: ComponentFixture<LiveConfigIdDialogComponent>;
  let component: LiveConfigIdDialogComponent;
  let listLiveConfigIds: jasmine.Spy;

  beforeEach(async () => {
    listLiveConfigIds = jasmine.createSpy('listLiveConfigIds').and.returnValue(of({ items: [] }));
    await TestBed.configureTestingModule({
      imports: [LiveConfigIdDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DashboardApiService,
          useValue: {
            listLiveConfigIds,
            getLiveConfigById: () => of({}),
            getLiveConfigUpstreams: () => of({ has_upstreams: false, upstream_count: 0, upstreams: [] }),
            getLiveConfigHosts: () => of({ host_count: 0, hosts: [] })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveConfigIdDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('nodeId', 'node-1');
    fixture.detectChanges();
  });

  it('emits closeRequested on backdrop click', () => {
    const closeSpy = jasmine.createSpy('close');
    component.closeRequested.subscribe(closeSpy);

    const backdrop = fixture.nativeElement.querySelector('[role="presentation"]') as HTMLElement;
    backdrop.click();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('emits closeRequested on escape pressed inside dialog', () => {
    const closeSpy = jasmine.createSpy('close');
    component.closeRequested.subscribe(closeSpy);

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('filters the ID list by search query (case-insensitive substring)', () => {
    const items: CaddyConfigIdInfoV1[] = [
      { id: 'alpha-1', has_upstreams: false, host_count: 0 },
      { id: 'beta-2', has_upstreams: false, host_count: 0 },
      { id: 'alpha-3', has_upstreams: false, host_count: 0 }
    ];
    listLiveConfigIds.and.returnValue(of({ items }));
    fixture.componentRef.setInput('nodeId', 'node-reload-a');
    fixture.detectChanges();

    const asideButtons = () => fixture.nativeElement.querySelectorAll('aside button[type="button"]');
    expect(asideButtons().length).toBe(3);

    const input = fixture.nativeElement.querySelector('#live-config-id-filter') as HTMLInputElement;
    input.value = 'beta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(asideButtons().length).toBe(1);
    expect(asideButtons()[0].textContent).toContain('beta-2');

    input.value = 'ALPHA';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(asideButtons().length).toBe(2);
  });

  it('shows No matching IDs when the filter matches nothing', () => {
    const items: CaddyConfigIdInfoV1[] = [{ id: 'only-id', has_upstreams: false, host_count: 0 }];
    listLiveConfigIds.and.returnValue(of({ items }));
    fixture.componentRef.setInput('nodeId', 'node-reload-b');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#live-config-id-filter') as HTMLInputElement;
    input.value = 'nomatch';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No matching IDs.');
  });

  it('clears the search query when the node id changes and IDs are re-fetched', () => {
    const items: CaddyConfigIdInfoV1[] = [{ id: 'x', has_upstreams: false, host_count: 0 }];
    listLiveConfigIds.and.returnValue(of({ items }));
    fixture.componentRef.setInput('nodeId', 'node-reload-c');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#live-config-id-filter') as HTMLInputElement;
    input.value = 'filtered';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.idSearchQuery()).toBe('filtered');

    listLiveConfigIds.and.returnValue(of({ items: [{ id: 'y', has_upstreams: false, host_count: 0 }] }));
    fixture.componentRef.setInput('nodeId', 'node-reload-d');
    fixture.detectChanges();

    expect(component.idSearchQuery()).toBe('');
    expect(input.value).toBe('');
  });
});
