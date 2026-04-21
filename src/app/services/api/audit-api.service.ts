import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogListResultV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class AuditApiService extends ApiBaseService {
  listAuditLogs(): Observable<AuditLogListResultV1> {
    return this.http.get<AuditLogListResultV1>(`${this.base}/audit`);
  }
}
