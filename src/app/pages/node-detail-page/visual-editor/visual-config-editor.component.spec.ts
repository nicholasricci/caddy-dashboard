import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigEditStore } from './config-edit.store';
import { VisualConfigEditorComponent } from './visual-config-editor.component';

describe('VisualConfigEditorComponent', () => {
  let fixture: ComponentFixture<VisualConfigEditorComponent>;
  let component: VisualConfigEditorComponent;
  let store: ConfigEditStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualConfigEditorComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(VisualConfigEditorComponent);
    component = fixture.componentInstance;
    store = new ConfigEditStore();
    store.setConfig({
      apps: {
        http: {
          servers: {
            srv0: {
              listen: [':443'],
              routes: [{ handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] }] }]
            }
          }
        }
      }
    });
    fixture.componentRef.setInput('store', store);
    fixture.detectChanges();
  });

  it('renders existing server names', () => {
    expect(component.serverNames()).toEqual(['srv0']);
  });

  it('adds a server and updates config', () => {
    component.addServer();
    const servers = store.readAt(['apps', 'http', 'servers']) as Record<string, unknown>;
    expect(Object.keys(servers).length).toBe(2);
  });

  it('patches server values through setServer', () => {
    component.setServer('srv0', { listen: [':8443'], routes: [] });
    expect(store.readAt(['apps', 'http', 'servers', 'srv0', 'listen', 0])).toBe(':8443');
  });
});
