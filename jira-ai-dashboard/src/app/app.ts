import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TriageService, TriageLog } from './triage';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  private triageService = inject(TriageService);

  // App UI State array holding our triage cards
  logs: TriageLog[] = [];

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.triageService.getTriageLogs().subscribe({
      next: (data) => {
        this.logs = data;
        console.log('Successfully pulled triage logs:', data);
      },
      error: (err) => {
        console.error('Failed to reach Taha\'s backend engine:', err);
      }
    });
  }
}