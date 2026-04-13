export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1',
  /** Tab-scoped tokens in dev reduce accidental long-lived XSS window. */
  authTokenStorage: 'sessionStorage' as const
};
