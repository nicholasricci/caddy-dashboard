import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CaddyHandler } from './types';
import { HandleBlockComponent } from './handle-block.component';

describe('HandleBlockComponent', () => {
  let fixture: ComponentFixture<HandleBlockComponent>;
  let component: HandleBlockComponent;
  let lastValue: CaddyHandler | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HandleBlockComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(HandleBlockComponent);
    component = fixture.componentInstance;
    lastValue = null;
    component.valueChanged.subscribe(v => {
      lastValue = v;
    });
    fixture.componentRef.setInput('value', { handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:8080' }] });
    fixture.detectChanges();
  });

  it('switches handler kind to static_response', () => {
    component.changeKind('static_response');
    expect(lastValue).toEqual(jasmine.objectContaining({ handler: 'static_response' }));
  });

  it('accepts raw json for unknown handlers', () => {
    component.onRaw('{"handler":"my_handler","custom":true}');
    expect(lastValue).toEqual(jasmine.objectContaining({ handler: 'my_handler', custom: true }));
  });
});
