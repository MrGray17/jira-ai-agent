import 'zone.js'; 
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app'; // 1. Import the correct class name

bootstrapApplication(AppComponent, appConfig) // 2. Use the exact same name here
  .catch((err) => console.error(err));