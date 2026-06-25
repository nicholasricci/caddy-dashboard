import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  CreateScheduledTaskRequestV1,
  ScheduledTaskListResponseV1,
  ScheduledTaskLogListFilterV1,
  ScheduledTaskLogListResultV1,
  ScheduledTaskLogV1,
  ScheduledTaskV1,
  UpdateScheduledTaskRequestV1
} from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

function toScheduledTaskLogListParams(filter?: ScheduledTaskLogListFilterV1): HttpParams {
  let params = new HttpParams();
  if (!filter) {
    return params;
  }

  if (filter.status) {
    params = params.set('status', filter.status);
  }
  if (filter.from) {
    params = params.set('from', filter.from);
  }
  if (filter.to) {
    params = params.set('to', filter.to);
  }
  if (filter.limit != null) {
    params = params.set('limit', String(filter.limit));
  }
  if (filter.offset != null) {
    params = params.set('offset', String(filter.offset));
  }

  return params;
}

export function normalizeScheduledTasks(body: unknown): ScheduledTaskV1[] {
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: ScheduledTaskV1[] }).items;
  }
  if (Array.isArray(body)) {
    return body as ScheduledTaskV1[];
  }
  return [];
}

export function normalizeScheduledTaskLogs(body: unknown): ScheduledTaskLogV1[] {
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: ScheduledTaskLogV1[] }).items;
  }
  if (Array.isArray(body)) {
    return body as ScheduledTaskLogV1[];
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class ScheduledTasksApiService extends ApiBaseService {
  listScheduledTasks(): Observable<ScheduledTaskV1[]> {
    return this.http
      .get<ScheduledTaskListResponseV1>(`${this.base}/scheduled-tasks`)
      .pipe(map(body => normalizeScheduledTasks(body)));
  }

  createScheduledTask(body: CreateScheduledTaskRequestV1): Observable<ScheduledTaskV1> {
    return this.http.post<ScheduledTaskV1>(`${this.base}/scheduled-tasks`, body);
  }

  updateScheduledTask(id: string, body: UpdateScheduledTaskRequestV1): Observable<ScheduledTaskV1> {
    return this.http.put<ScheduledTaskV1>(`${this.base}/scheduled-tasks/${encodeURIComponent(id)}`, body);
  }

  deleteScheduledTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/scheduled-tasks/${encodeURIComponent(id)}`);
  }

  toggleScheduledTask(id: string, enabled: boolean): Observable<ScheduledTaskV1> {
    return this.http.post<ScheduledTaskV1>(`${this.base}/scheduled-tasks/${encodeURIComponent(id)}/toggle`, {
      enabled
    });
  }

  runScheduledTaskNow(id: string): Observable<ScheduledTaskLogV1> {
    return this.http.post<ScheduledTaskLogV1>(
      `${this.base}/scheduled-tasks/${encodeURIComponent(id)}/run-now`,
      {}
    );
  }

  listScheduledTaskLogs(
    id: string,
    filter?: ScheduledTaskLogListFilterV1
  ): Observable<ScheduledTaskLogListResultV1> {
    return this.http.get<ScheduledTaskLogListResultV1>(
      `${this.base}/scheduled-tasks/${encodeURIComponent(id)}/logs`,
      { params: toScheduledTaskLogListParams(filter) }
    );
  }
}
