import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BackfillSnapshotsResponseV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class AdminApiService extends ApiBaseService {
  /** Admin-only: re-run snapshot discovery backfill. */
  backfillSnapshots(): Observable<BackfillSnapshotsResponseV1> {
    return this.http.post<BackfillSnapshotsResponseV1>(`${this.base}/snapshots/backfill`, {});
  }
}
