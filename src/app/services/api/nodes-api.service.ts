import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CaddyConfigHostsResponseV1,
  ApplyConfigRequestV1,
  CaddyConfigIdsResponseV1,
  CaddyConfigUpstreamsResponseV1,
  CaddyNodeV1,
  CreateNodeRequestV1,
  MutateDomainsRequestV1,
  MutateDomainsResponseV1,
  MutateUpstreamsRequestV1,
  MutateUpstreamsResponseV1,
  PropagateConfigResponseV1,
  SnapshotRecordV1,
  UpdateNodeRequestV1
} from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';
import { normalizeSnapshotRows } from '../../core/api-list-normalize.util';

@Injectable({
  providedIn: 'root'
})
export class NodesApiService extends ApiBaseService {
  listNodes(): Observable<CaddyNodeV1[]> {
    return this.http.get<CaddyNodeV1[]>(`${this.base}/nodes`);
  }

  getNode(id: string): Observable<CaddyNodeV1> {
    return this.http.get<CaddyNodeV1>(`${this.base}/nodes/${encodeURIComponent(id)}`);
  }

  createNode(body: CreateNodeRequestV1): Observable<CaddyNodeV1> {
    return this.http.post<CaddyNodeV1>(`${this.base}/nodes`, body);
  }

  updateNode(id: string, body: UpdateNodeRequestV1): Observable<CaddyNodeV1> {
    return this.http.put<CaddyNodeV1>(`${this.base}/nodes/${encodeURIComponent(id)}`, body);
  }

  deleteNode(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/nodes/${encodeURIComponent(id)}`);
  }

  applyConfig(id: string, body: ApplyConfigRequestV1): Observable<Record<string, string>> {
    return this.http.post<Record<string, string>>(`${this.base}/nodes/${encodeURIComponent(id)}/apply`, body);
  }

  reloadCaddy(id: string): Observable<Record<string, string>> {
    return this.http.post<Record<string, string>>(`${this.base}/nodes/${encodeURIComponent(id)}/reload`, {});
  }

  getLiveNodeConfig(id: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/nodes/${encodeURIComponent(id)}/config/live`);
  }

  listLiveConfigIds(id: string): Observable<CaddyConfigIdsResponseV1> {
    return this.http.get<CaddyConfigIdsResponseV1>(`${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids`);
  }

  getLiveConfigById(id: string, configId: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}`
    );
  }

  getLiveConfigUpstreams(id: string, configId: string): Observable<CaddyConfigUpstreamsResponseV1> {
    return this.http.get<CaddyConfigUpstreamsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}/upstreams`
    );
  }

  getLiveConfigHosts(id: string, configId: string): Observable<CaddyConfigHostsResponseV1> {
    return this.http.get<CaddyConfigHostsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/live/ids/${encodeURIComponent(configId)}/hosts`
    );
  }

  syncConfig(id: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/nodes/${encodeURIComponent(id)}/sync`, {});
  }

  listSnapshots(id: string): Observable<SnapshotRecordV1[]> {
    return this.http
      .get<unknown>(`${this.base}/nodes/${encodeURIComponent(id)}/snapshots`)
      .pipe(map(rows => normalizeSnapshotRows(rows)));
  }

  mutateDomains(id: string, body: MutateDomainsRequestV1): Observable<MutateDomainsResponseV1> {
    return this.http.post<MutateDomainsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/mutate/domains`,
      body
    );
  }

  mutateUpstreams(id: string, body: MutateUpstreamsRequestV1): Observable<MutateUpstreamsResponseV1> {
    return this.http.post<MutateUpstreamsResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/mutate/upstreams`,
      body
    );
  }

  propagateConfig(id: string): Observable<PropagateConfigResponseV1> {
    return this.http.post<PropagateConfigResponseV1>(
      `${this.base}/nodes/${encodeURIComponent(id)}/config/propagate`,
      {}
    );
  }
}

