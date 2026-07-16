// Suppress TS error when type declarations for zone.js are missing
// @ts-ignore: Ignore missing module or type declarations for side-effect import
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app'; // 1. Import the correct class name

bootstrapApplication(AppComponent, appConfig) // 2. Use the exact same name here
  .catch((err) => console.error(err));