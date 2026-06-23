import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import { authInterceptor } from '../auth.interceptor';
import {
  normalizeScheduledTaskLogs,
  normalizeScheduledTasks,
  ScheduledTasksApiService
} from './scheduled-tasks-api.service';

describe('ScheduledTasksApiService', () => {
  let service: ScheduledTasksApiService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['getAccessToken']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        ScheduledTasksApiService
      ]
    });
    service = TestBed.inject(ScheduledTasksApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('normalizeScheduledTasks reads items array', () => {
    const rows = normalizeScheduledTasks({ items: [{ id: 't1', name: 'Task 1' }] });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe('t1');
  });

  it('normalizeScheduledTaskLogs reads items array', () => {
    const rows = normalizeScheduledTaskLogs({ items: [{ id: 'l1', status: 'success' }] });
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('success');
  });

  it('lists scheduled tasks', done => {
    service.listScheduledTasks().subscribe({
      next: rows => {
        expect(rows.length).toBe(1);
        expect(rows[0].name).toBe('Discovery EU');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/scheduled-tasks`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 't1', name: 'Discovery EU', task_type: 'discovery_run', cron_expression: '*/30 * * * *' }] });
  });

  it('toggles scheduled task with enabled body', done => {
    service.toggleScheduledTask('t1', false).subscribe({
      next: row => {
        expect(row.enabled).toBe(false);
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/scheduled-tasks/t1/toggle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({ id: 't1', enabled: false });
  });

  it('runs scheduled task now', done => {
    service.runScheduledTaskNow('t1').subscribe({
      next: log => {
        expect(log.status).toBe('success');
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${apiBase}/scheduled-tasks/t1/run-now`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'l1', status: 'success' });
  });
});
