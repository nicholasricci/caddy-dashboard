export const environment = {
  production: true,
  apiUrl: '/api/v1',
  /**
   * Token persistence: sessionStorage limits exposure to the tab lifetime; localStorage survives restarts.
   * Prefer HttpOnly cookies server-side for refresh tokens when the API supports it.
   */
  authTokenStorage: 'localStorage' as 'localStorage' | 'sessionStorage'
};
