import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./pages/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/nodes-page/nodes-page.component').then(m => m.NodesPageComponent)
      },
      {
        path: 'nodes/:id',
        loadComponent: () =>
          import('./pages/node-detail-page/node-detail-page.component').then(m => m.NodeDetailPageComponent)
      },
      {
        path: 'discovery',
        loadComponent: () =>
          import('./pages/discovery-page/discovery-page.component').then(m => m.DiscoveryPageComponent)
      },
      {
        path: 'admin/users',
        loadComponent: () =>
          import('./pages/users-admin-page/users-admin-page.component').then(m => m.UsersAdminPageComponent),
        canActivate: [adminGuard]
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
