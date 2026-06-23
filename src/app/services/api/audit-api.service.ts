import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditListFilterV1, AuditLogListResultV1, AuditTypesResponseV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

function toAuditListParams(filter?: AuditListFilterV1): HttpParams {
  let params = new HttpParams();
  if (!filter) {
    return params;
  }

  if (filter.action) {
    params = params.set('action', filter.action);
  }
  if (filter.resource) {
    params = params.set('resource', filter.resource);
  }
  const actor = filter.actor?.trim();
  if (actor) {
    params = params.set('actor', actor);
  }
  if (filter.resource_id) {
    params = params.set('resource_id', filter.resource_id);
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

@Injectable({
  providedIn: 'root'
})
export class AuditApiService extends ApiBaseService {
  listAuditLogs(filter?: AuditListFilterV1): Observable<AuditLogListResultV1> {
    return this.http.get<AuditLogListResultV1>(`${this.base}/audit`, {
      params: toAuditListParams(filter)
    });
  }

  listAuditTypes(): Observable<AuditTypesResponseV1> {
    return this.http.get<AuditTypesResponseV1>(`${this.base}/audit/types`);
  }
}
