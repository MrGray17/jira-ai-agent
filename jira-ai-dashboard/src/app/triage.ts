import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TriageLog {
  ticketKey: string;
  summary: string;
  aiResponse: {
    category: 'BUG' | 'FEATURE_REQUEST' | 'SECURITY_ALERT';
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    justification: string;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class TriageService { // This will now sit perfectly inside triage.ts
  private http = inject(HttpClient);
  private apiUrl = 'http://192.168.1.99:3000/api/triage-logs';

  getTriageLogs(): Observable<TriageLog[]> {
    return this.http.get<TriageLog[]>(this.apiUrl);
  }
}