import { ROUTES } from './routes.js';
import { API } from './api.js';

export const APP_CONFIG = Object.freeze({
  name: 'TorqueMind',
  productionUrl: 'https://car-diagnosis-simulator.vercel.app',
  baseUrl: typeof window !== 'undefined'
    ? window.location.origin
    : 'https://car-diagnosis-simulator.vercel.app',
  routes: ROUTES,
  api: API
});
