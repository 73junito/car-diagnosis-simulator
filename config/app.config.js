import { ROUTES } from './routes.js';
import { API } from './api.js';

export const APP_CONFIG = Object.freeze({
  name: 'TorqueMind',
  productionUrl: 'https://app.autolearnpro.com',
  baseUrl: typeof window !== 'undefined'
    ? window.location.origin
    : 'https://app.autolearnpro.com',
  routes: ROUTES,
  api: API
});
