import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DiscoveryConfigV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

function normalizeSnapshotRows(rows: unknown): Record<string, unknown>[] {
  if (Array.isArray(rows)) {
    return rows as Record<string, unknown>[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }

  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['snapshots'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as Record<string, unknown>[];
    }
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class DiscoveryApiService extends ApiBaseService {
  listDiscovery(): Observable<DiscoveryConfigV1[]> {
    return this.http.get<DiscoveryConfigV1[]>(`${this.base}/discovery`);
  }

  getDiscovery(id: string): Observable<DiscoveryConfigV1> {
    return this.http.get<DiscoveryConfigV1>(`${this.base}/discovery/${encodeURIComponent(id)}`);
  }

  createDiscovery(body: DiscoveryConfigV1): Observable<DiscoveryConfigV1> {
    return this.http.post<DiscoveryConfigV1>(`${this.base}/discovery`, body);
  }

  updateDiscovery(id: string, body: DiscoveryConfigV1): Observable<DiscoveryConfigV1> {
    return this.http.put<DiscoveryConfigV1>(`${this.base}/discovery/${encodeURIComponent(id)}`, body);
  }

  deleteDiscovery(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/discovery/${encodeURIComponent(id)}`);
  }

  runDiscovery(id: string): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/discovery/${encodeURIComponent(id)}/run`, {});
  }

  listDiscoverySnapshots(id: string): Observable<Record<string, unknown>[]> {
    return this.http
      .get<unknown>(`${this.base}/discovery/${encodeURIComponent(id)}/snapshots`)
      .pipe(map(rows => normalizeSnapshotRows(rows)));
  }
}
