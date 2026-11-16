const path = require('node:path');

function loadIntegrationConfig(env = process.env) {
    if (!env.MAYDAY_TEST_BASE_URL) {
        throw new Error('Set MAYDAY_TEST_BASE_URL to the backend under test.');
    }

    if (env.MAYDAY_TEST_ENV !== '1' || env.MAYDAY_TEST_DB !== '1') {
        throw new Error('Refusing to run: set MAYDAY_TEST_ENV=1 and MAYDAY_TEST_DB=1 only for an isolated test deployment.');
    }

    if (!env.MAYDAY_TEST_DB_NAME || !/test/i.test(env.MAYDAY_TEST_DB_NAME)) {
        throw new Error('MAYDAY_TEST_DB_NAME must identify an isolated test database whose name contains "test".');
    }

    if (!env.MAYDAY_TEST_ADAPTER || !path.isAbsolute(env.MAYDAY_TEST_ADAPTER)) {
        throw new Error('MAYDAY_TEST_ADAPTER must be an absolute path to the backend-specific test adapter.');
    }

    let url;
    try {
        url = new URL(env.MAYDAY_TEST_BASE_URL);
    } catch {
        throw new Error('MAYDAY_TEST_BASE_URL must be a valid URL.');
    }

    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!isLoopback && url.protocol !== 'https:') ||
        (isLoopback && !['http:', 'https:'].includes(url.protocol))) {
        throw new Error('Deployment targets must use HTTPS; local loopback targets may use HTTP or HTTPS.');
    }

    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
        throw new Error('MAYDAY_TEST_BASE_URL must contain only the origin, without credentials, path, query, or fragment.');
    }

    if (env.MAYDAY_TEST_CONFIRM_HOST !== url.hostname) {
        throw new Error('Set MAYDAY_TEST_CONFIRM_HOST to the exact MAYDAY_TEST_BASE_URL hostname before sending requests.');
    }

    return {
        baseUrl: url.origin,
        databaseName: env.MAYDAY_TEST_DB_NAME,
        targetName: env.MAYDAY_TEST_TARGET_NAME || url.hostname,
        adapterPath: path.resolve(env.MAYDAY_TEST_ADAPTER)
    };
}

module.exports = { loadIntegrationConfig };
