/**
 * Angular 21 Frontend - Item Manager
 * Single-page app displaying items from the .NET backend API
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter([])
  ]
}).catch(err => console.error(err));
