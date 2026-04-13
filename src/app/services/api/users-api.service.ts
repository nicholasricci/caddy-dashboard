import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserRequestV1, UpdateUserRequestV1, UserV1 } from '../../models/api-v1.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root'
})
export class UsersApiService extends ApiBaseService {
  listUsers(): Observable<UserV1[]> {
    return this.http.get<UserV1[]>(`${this.base}/users`);
  }

  getUser(id: string): Observable<UserV1> {
    return this.http.get<UserV1>(`${this.base}/users/${encodeURIComponent(id)}`);
  }

  createUser(body: CreateUserRequestV1): Observable<UserV1> {
    return this.http.post<UserV1>(`${this.base}/users`, body);
  }

  updateUser(id: string, body: UpdateUserRequestV1): Observable<UserV1> {
    return this.http.put<UserV1>(`${this.base}/users/${encodeURIComponent(id)}`, body);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${encodeURIComponent(id)}`);
  }
}
