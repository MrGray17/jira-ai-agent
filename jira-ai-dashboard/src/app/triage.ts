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
export class TriageService {
  private http = inject(HttpClient);
  
  // Use relative URL for same-origin, or configure via environment
  private apiUrl = 'http://localhost:3000/api/triage-logs';

  getTriageLogs(): Observable<TriageLog[]> {
    return this.http.get<TriageLog[]>(this.apiUrl);
  }
}