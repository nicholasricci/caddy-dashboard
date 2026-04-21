import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { LiveConfigIdDialogComponent } from './live-config-id-dialog.component';

describe('LiveConfigIdDialogComponent', () => {
  let fixture: ComponentFixture<LiveConfigIdDialogComponent>;
  let component: LiveConfigIdDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveConfigIdDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DashboardApiService,
          useValue: {
            listLiveConfigIds: () => of({ items: [] }),
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
});
