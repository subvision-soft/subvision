import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';
import "beercss";
import "material-dynamic-colors";

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
