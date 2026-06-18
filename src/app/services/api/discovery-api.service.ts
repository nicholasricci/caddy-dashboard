import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_KEY_AUTHORIZATION } from '../../core/http-context.tokens';
import {
  DiscoveryConfigV1,
  RegisterDomainRequestV1,
  RegisterDomainResponseV1,
  RegisterUpstreamRequestV1,
  RegisterUpstreamResponseV1,
  SnapshotRecordV1
} from '../../models/api-v1.model';
import { normalizeSnapshotRows } from '../../core/api-list-normalize.util';
import { ApiBaseService } from './api-base.service';

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

  listDiscoverySnapshots(id: string): Observable<SnapshotRecordV1[]> {
    return this.http
      .get<unknown>(`${this.base}/discovery/${encodeURIComponent(id)}/snapshots`)
      .pipe(map(rows => normalizeSnapshotRows(rows)));
  }

  registerUpstream(
    discoveryId: string,
    apiKeySecret: string,
    body: RegisterUpstreamRequestV1
  ): Observable<RegisterUpstreamResponseV1> {
    return this.http.post<RegisterUpstreamResponseV1>(
      `${this.base}/discovery/${encodeURIComponent(discoveryId)}/register-upstream`,
      body,
      {
        context: new HttpContext().set(API_KEY_AUTHORIZATION, apiKeySecret.trim())
      }
    );
  }

  registerDomain(
    discoveryId: string,
    apiKeySecret: string,
    body: RegisterDomainRequestV1
  ): Observable<RegisterDomainResponseV1> {
    return this.http.post<RegisterDomainResponseV1>(
      `${this.base}/discovery/${encodeURIComponent(discoveryId)}/register-domain`,
      body,
      {
        context: new HttpContext().set(API_KEY_AUTHORIZATION, apiKeySecret.trim())
      }
    );
  }
}
