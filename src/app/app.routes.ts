import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { CrewArrComponent } from './pages/crew-arr/crew-arr.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { DgComponent } from './pages/dg/dg.component';
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'dg', component: DgComponent },
  { path: 'crew-arr', component: CrewArrComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' },
];
