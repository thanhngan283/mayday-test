import { ENV } from '../src/config/env';

jest.setTimeout(ENV.API_TIMEOUT_MS + 15000);

beforeAll(() => {
  console.info('====================================================================');
  console.info('[DR.MAYDAY REAL API TEST SUITE] Zero-Mocking Mode Activated');
  console.info(`[BASE URLS] AUTH=${ENV.BASE_URLS.AUTH} | MEDREC=${ENV.BASE_URLS.MEDREC}`);
  console.info('====================================================================');
});
