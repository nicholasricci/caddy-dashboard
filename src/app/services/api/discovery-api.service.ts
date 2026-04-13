import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DiscoveryConfigV1 } from '../../models/api-v1.model';
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
}
