const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';
const PATIENT_ID = 8;
const DEFAULT_ADMIN_ID = 1;
const VALID_PASSWORD = 'abc123';

const catalog = {
    SGN: `01|1000|required fields and safe response
02|1000|optional gender
03|1000|all supported gender values
04|1000|all allowed VN phone prefixes
05|1000|Vietnamese full name
06|1000|login immediately after signup
07|1000|unknown extra field is ignored
08|1002|each required field omitted
09|1002|empty or missing body
10|1002|empty or null required values
11|1003|string fields sent as numbers
12|1003|array and object field values
13|1003|non-string gender
14|1004|phone length outside 10 digits
15|1004|unsupported VN phone prefixes
16|1004|phone includes letters or punctuation
17|1004|international phone format rejected
18|1000|six-character password boundary
19|1004|five-character password
20|1004|whitespace-only password
21|1004|password length limit
22|1004|gender outside enum
23|1004|whitespace-only name
24|1004|name length limit
25|1004|HTML and script in name rejected
26|1004|SQL-injection-shaped input is handled safely
27|9996|duplicate patient phone rejected
28|9996|phone already used by staff rejected
29|9996|phone of inactive account remains unique
30|9996|phone of soft-deleted account remains unique
31|1000|privilege fields cannot be mass-assigned
32|1000|concurrent duplicate signup is atomic
33|1003|malformed JSON rejected
34|1003|non-JSON content types rejected`,
    LGN: `01|1000|patient login response and token shape
02|1000|admin doctor and nurse roles can log in
03|1000|token authorizes profile request
04|1000|JWT contains a future exp claim
05|1002|required fields omitted individually
06|1002|empty or missing login body
07|1003|login field types rejected
08|1004|invalid phone formats rejected
09|9992|unregistered phone rejected
10|9995|wrong password rejected
11|9995|password comparison is case sensitive
12|9995|password whitespace is not trimmed
13|1009|inactive account cannot log in
14|9992|soft-deleted account cannot log in
15|1000|two independent login sessions
16|1000|concurrent valid logins
17|1004|SQL-injection-shaped credentials rejected safely
18|1009|repeated bad passwords trigger lockout
19|NA|error responses do not leak internals
20|1003|malformed login JSON rejected`,
    LGO: `01|1000|logout with a valid token
02|9998|token rejected after logout
03|9998|second logout of the same token rejected
04|1000|logging out one session preserves another
05|1000|login after logout creates a valid new session
06|9998|logout without Authorization header rejected
07|9998|malformed and unsupported Authorization values rejected
08|9998|expired token rejected
09|9998|logged-out token remains blacklisted`,
    FPW: `01|1000|registered phone receives OTP
02|1002|missing phone
03|1003|phone type validation
04|1004|phone format validation
05|9992|unknown phone rejected
06|1009|inactive account cannot request OTP
07|1009|sixth OTP request is rate limited
08|9993|new OTP invalidates previous OTP
09|9999|OTP provider error is surfaced
10|1004|SQL-injection-shaped phone rejected
11|1003|malformed request JSON rejected`,
    RPW: `01|1000|valid OTP resets password
02|1000|new password works and old password fails
03|1002|required fields omitted individually
04|1003|reset field types rejected
05|1004|five-character new password rejected
06|1000|six-character new password accepted
07|1004|OTP must be six digits
08|9993|incorrect OTP rejected
09|9993|expired OTP rejected
10|1000|OTP validity boundary
11|9993|used OTP cannot be reused
12|9993|OTP cannot be used for another phone
13|9993|reset without requesting OTP rejected
14|9992|unknown account reset rejected
15|9993|five failed OTP attempts invalidate OTP
16|9998|password reset revokes existing tokens
17|1003|malformed reset JSON rejected`,
    CPW: `01|1000|valid password change
02|1000|new password works and old password fails
03|1002|required fields omitted individually
04|1003|password field types rejected
05|1004|five-character new password rejected
06|1000|six-character new password accepted
07|1004|confirmation mismatch rejected
08|1004|whitespace-only new password rejected
09|9995|incorrect old password rejected
10|1004|new password must differ from old password
11|1004|confirmation validation occurs before old password check
12|9998|password change revokes old access token
13|1003|malformed change JSON rejected
14|9998|missing authorization rejected
15|9998|malformed authorization rejected
16|9998|expired authorization rejected
17|9998|logged-out authorization rejected`,
    CST: `01|1000|create staff with all fields
02|1000|create staff without room id
03|1000|null room id accepted
04|1000|optional gender omitted
05|1000|created staff can log in
06|1000|supported staff roles
07|1002|required staff fields omitted individually
08|1002|empty or missing staff body
09|1002|null or empty required values
10|1003|staff ID types rejected
11|1003|staff string field types rejected
12|1004|invalid staff phone rejected
13|1004|five-character staff password rejected
14|1000|six-character staff password accepted
15|1004|unsupported staff gender rejected
16|1004|non-positive staff IDs rejected
17|9992|unknown role rejected
18|9992|unknown branch rejected
19|9992|unknown department rejected
20|9992|unknown room rejected
21|1004|department must belong to selected branch
22|1004|room must belong to selected department
23|9992|deleted branch or department treated as missing
24|9996|existing patient and staff phones rejected
25|1004|patient and admin roles cannot be assigned as staff
26|9992|failed create does not leave an account
27|1000|concurrent duplicate staff creation is atomic
28|1000|staff privilege fields cannot be mass-assigned
29|1004|XSS rejected and SQL-like plain text handled safely
30|1003|malformed create staff JSON rejected
31|9998|missing authorization rejected
32|9998|malformed authorization rejected
33|9998|expired authorization rejected
34|9998|logged-out authorization rejected
35|1009|patient cannot create staff
36|1009|doctor cannot create staff`
};

function parseCatalog(prefix, text) {
    return text.split('\n').map(line => {
        const [number, expected, title] = line.trim().split('|');
        return {
            id: `W1-${prefix}-${number}`,
            expected,
            title
        };
    });
}

const groups = Object.entries(catalog).map(([prefix, text]) => ({
    prefix,
    cases: parseCatalog(prefix, text)
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 144 || new Set(allCases.map(item => item.id)).size !== 144) {
    throw new Error(`Week 1 workbook coverage must contain exactly 144 unique cases; found ${allCases.length}.`);
}

let fixture;
let roles;
let admin;
const casePhones = new Set();
const suitePhones = new Set();

function requiredAdapterMethod(name) {
    const method = adapter[name];
    if (typeof method !== 'function') {
        throw new Error(`The target adapter must implement ${name}().`);
    }
    return method.bind(adapter);
}

async function adapterCall(name, args = {}) {
    return requiredAdapterMethod(name)({
        ...args,
        expectedDatabaseName: config.databaseName
    });
}

function trackPhone(phone, scope = 'case') {
    if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) return;
    if (scope === 'suite') {
        suitePhones.add(phone);
    } else {
        casePhones.add(phone);
    }
}

function newPhone(prefix = '09') {
    return `${prefix}${crypto.randomInt(10000000, 100000000)}`;
}

function newPassword() {
    return `Mayday-${crypto.randomBytes(12).toString('hex')}`;
}

function expectCode(response, expected) {
    expect(String(response?.body?.code)).toBe(String(expected));
}

function isSafeError(response) {
    const message = String(response?.body?.message || '');
    expect(message).not.toMatch(/stack trace|select\s+.+\s+from|syntax error|node_modules|\.js:\d+|password_hash/i);
    expect(JSON.stringify(response?.body || {})).not.toMatch(/password_hash|stack trace|node_modules|\.js:\d+/i);
}

function jwtPayload(token) {
    const segments = String(token).split('.');
    expect(segments).toHaveLength(3);
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
}

async function api(method, endpoint, body, {
    token,
    authorization,
    contentType,
    trackScope = 'case'
} = {}) {
    if ((endpoint === '/api/auth/signup' || endpoint === '/api/auth/create-staff') && body) {
        trackPhone(body.phone, trackScope);
    }
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (contentType) call = call.set('Content-Type', contentType);
    if (body !== undefined) call = call.send(body);
    return call;
}

async function registerAccount({
    fullName = 'Mayday Automated Test',
    phone = newPhone(),
    password = newPassword(),
    gender,
    scope = 'case'
} = {}) {
    trackPhone(phone, scope);
    const payload = {
        full_name: fullName,
        phone,
        password
    };
    if (gender !== undefined) payload.gender = gender;
    const response = await api('post', '/api/auth/signup', payload, { trackScope: scope });
    expectCode(response, OK);
    return { full_name: fullName, phone, password, response };
}

async function login(account, password = account.password) {
    return api('post', '/api/auth/login', {
        phone: account.phone,
        password
    });
}

async function createRoleAccount(roleId) {
    const account = await registerAccount();
    const promotion = await adapterCall('promoteUser', { phone: account.phone, roleId });
    expect(Number(promotion?.roleId)).toBe(Number(roleId));
    return account;
}

async function makeStaffPayload(overrides = {}) {
    if (!fixture) fixture = await adapterCall('prepareStaffFixture');
    return {
        full_name: 'Mayday Test Staff',
        phone: newPhone(),
        password: newPassword(),
        role_id: roles.doctor,
        branch_id: fixture.branch_id,
        department_id: fixture.department_id,
        room_id: fixture.room_id,
        ...overrides
    };
}

async function createStaff(payload, token = admin.token) {
    trackPhone(payload.phone);
    return api('post', '/api/auth/create-staff', payload, { token });
}

async function requestOtp(account) {
    return api('post', '/api/auth/forgot-password', { phone: account.phone });
}

async function readOtp(account) {
    const otp = await adapterCall('getOtp', { phone: account.phone });
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
        throw new Error(`Adapter did not return a six-digit OTP for ${account.phone}.`);
    }
    return otp;
}

async function resetPassword(account, otp, new_password = newPassword()) {
    return api('post', '/api/auth/reset-password', {
        phone: account.phone,
        otp,
        new_password
    });
}

async function deletePhones(phones) {
    const errors = [];
    for (const phone of phones) {
        try {
            await adapterCall('deleteUser', { phone });
            phones.delete(phone);
        } catch (error) {
            errors.push(`${phone}: ${error.message}`);
        }
    }
    if (errors.length) {
        throw new Error(`Could not clean up suite-created accounts: ${errors.join('; ')}`);
    }
}

async function resetHooks() {
    await adapterCall('resetTestHooks');
}

async function createExpiredToken(account) {
    const result = await adapterCall('getExpiredToken', { phone: account.phone });
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error(`Adapter did not return an expired token for ${account.phone}.`);
    return token;
}

beforeAll(async () => {
    const database = await adapterCall('assertTestDatabase');
    if (database?.isTestDatabase !== true || database.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}". No API tests were run.`);
    }

    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    const roleKeys = ['admin', 'patient', 'doctor', 'nurse', 'technician'];
    for (const key of roleKeys) {
        if (!Number.isInteger(roles?.[key]) || roles[key] <= 0) {
            throw new Error(`Adapter getRoleIds() must return a positive integer "${key}" role ID.`);
        }
    }
    if (Number(roles.admin) !== DEFAULT_ADMIN_ID) {
        throw new Error(`The workbook specifies director/admin role ID ${DEFAULT_ADMIN_ID}; adapter returned ${roles.admin}.`);
    }

    fixture = await adapterCall('prepareStaffFixture');
    admin = await registerAccount({ fullName: 'Mayday Test Admin', scope: 'suite' });
    const promotion = await adapterCall('promoteUser', {
        phone: admin.phone,
        roleId: roles.admin
    });
    expect(Number(promotion?.roleId)).toBe(Number(roles.admin));
    const adminLogin = await login(admin);
    expectCode(adminLogin, OK);
    if (!adminLogin.body?.data?.token) {
        throw new Error('Admin login succeeded but did not return data.token.');
    }
    admin.token = adminLogin.body.data.token;
});

afterEach(async () => {
    const errors = [];
    try {
        await resetHooks();
    } catch (error) {
        errors.push(`test hooks: ${error.message}`);
    }
    try {
        await deletePhones(casePhones);
    } catch (error) {
        errors.push(`account cleanup: ${error.message}`);
    }
    if (errors.length) throw new Error(errors.join('; '));
});

afterAll(async () => {
    const errors = [];
    try {
        await resetHooks();
    } catch (error) {
        errors.push(`test hooks: ${error.message}`);
    }
    for (const [label, phones] of [['case accounts', casePhones], ['suite accounts', suitePhones]]) {
        try {
            await deletePhones(phones);
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (fixture) {
        try {
            await adapterCall('cleanupTestFixtures');
        } catch (error) {
            errors.push(`fixture cleanup: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
});

describe(`Target ${config.targetName} - Week 1`, () => {
    describe.each(groups)('Week 1 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            const response = await runCase(id);
            if (expected !== 'NA') expectCode(response, expected);
        });
    });
});

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    switch (prefix) {
        case 'SGN': return runSignup(number);
        case 'LGN': return runLogin(number);
        case 'LGO': return runLogout(number);
        case 'FPW': return runForgotPassword(number);
        case 'RPW': return runResetPassword(number);
        case 'CPW': return runChangePassword(number);
        case 'CST': return runCreateStaff(number);
        default: throw new Error(`Unknown Week 1 case ID: ${id}`);
    }
}

async function runSignup(number) {
    const base = { full_name: 'Mayday Test User', phone: newPhone(), password: VALID_PASSWORD };
    switch (number) {
        case 1: {
            const response = await api('post', '/api/auth/signup', {
                ...base, full_name: 'Nguyễn Văn An', gender: 'male'
            });
            trackPhone(base.phone);
            expect(Number.isInteger(response.body?.data?.user_id)).toBe(true);
            expect(Number(response.body?.data?.role_id)).toBe(roles.patient);
            expect(Number(response.body?.data?.is_active)).toBe(1);
            expect(Number.isNaN(Date.parse(response.body?.data?.created_at))).toBe(false);
            expect(response.body?.data).not.toHaveProperty('password');
            expect(response.body?.data).not.toHaveProperty('password_hash');
            return response;
        }
        case 2: {
            const response = await api('post', '/api/auth/signup', base);
            trackPhone(base.phone);
            expect(response.body?.data?.gender).toBeNull();
            return response;
        }
        case 3: {
            let last;
            for (const gender of ['male', 'female', 'other']) {
                const payload = { ...base, phone: newPhone(), gender };
                trackPhone(payload.phone);
                last = await api('post', '/api/auth/signup', payload);
                expectCode(last, OK);
                expect(last.body?.data?.gender).toBe(gender);
            }
            return last;
        }
        case 4: {
            let last;
            for (const prefix of ['03', '05', '07', '08', '09']) {
                const payload = { ...base, phone: newPhone(prefix) };
                trackPhone(payload.phone);
                last = await api('post', '/api/auth/signup', payload);
                expectCode(last, OK);
            }
            return last;
        }
        case 5: {
            const payload = { ...base, full_name: 'Trần Thị Bích Ngọc' };
            trackPhone(payload.phone);
            const response = await api('post', '/api/auth/signup', payload);
            expect(response.body?.data?.full_name).toBe(payload.full_name);
            return response;
        }
        case 6: {
            const response = await api('post', '/api/auth/signup', base);
            trackPhone(base.phone);
            expectCode(response, OK);
            return login({ phone: base.phone, password: base.password });
        }
        case 7: {
            const response = await api('post', '/api/auth/signup', { ...base, foo: 'bar' });
            trackPhone(base.phone);
            expect(response.body?.data).not.toHaveProperty('foo');
            return response;
        }
        case 8: {
            let last;
            for (const key of ['full_name', 'phone', 'password']) {
                const payload = { ...base };
                delete payload[key];
                last = await api('post', '/api/auth/signup', payload);
                expectCode(last, '1002');
            }
            return last;
        }
        case 9: {
            const empty = await api('post', '/api/auth/signup', {});
            expectCode(empty, '1002');
            return api('post', '/api/auth/signup');
        }
        case 10:
            return api('post', '/api/auth/signup', { full_name: '', phone: null, password: '' });
        case 11:
            return api('post', '/api/auth/signup', { full_name: 123, phone: 912345678, password: 123456 });
        case 12:
            return api('post', '/api/auth/signup', { full_name: ['a'], phone: base.phone, password: { a: 1 } });
        case 13: {
            const numeric = await api('post', '/api/auth/signup', { ...base, gender: 1 });
            expectCode(numeric, '1003');
            return api('post', '/api/auth/signup', { ...base, phone: newPhone(), gender: true });
        }
        case 14: {
            let last;
            for (const phone of ['091234567', '09123456789']) {
                last = await api('post', '/api/auth/signup', { ...base, phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 15: {
            let last;
            for (const phone of ['0112345678', '0412345678', '0612345678']) {
                last = await api('post', '/api/auth/signup', { ...base, phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 16: {
            let last;
            for (const phone of ['09123abcde', '0912 345 678', '0912-345-678']) {
                last = await api('post', '/api/auth/signup', { ...base, phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 17: {
            let last;
            for (const phone of ['+84912345678', '84912345678']) {
                last = await api('post', '/api/auth/signup', { ...base, phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 18: {
            const payload = { ...base, password: 'abc123' };
            trackPhone(payload.phone);
            return api('post', '/api/auth/signup', payload);
        }
        case 19: return api('post', '/api/auth/signup', { ...base, password: 'abc12' });
        case 20: return api('post', '/api/auth/signup', { ...base, password: '      ' });
        case 21: {
            const tooLong = await api('post', '/api/auth/signup', { ...base, password: 'x'.repeat(65) });
            expectCode(tooLong, '1004');
            return api('post', '/api/auth/signup', { ...base, phone: newPhone(), password: 'x'.repeat(10000) });
        }
        case 22: {
            let last;
            for (const gender of ['unknown', 'MALE', '', 'nam']) {
                last = await api('post', '/api/auth/signup', { ...base, phone: newPhone(), gender });
                expectCode(last, '1004');
            }
            return last;
        }
        case 23: return api('post', '/api/auth/signup', { ...base, full_name: '   ' });
        case 24: {
            const longName = await api('post', '/api/auth/signup', { ...base, full_name: 'A'.repeat(101) });
            expectCode(longName, '1004');
            return api('post', '/api/auth/signup', { ...base, phone: newPhone(), full_name: 'A'.repeat(10000) });
        }
        case 25:
            return api('post', '/api/auth/signup', { ...base, full_name: '<script>alert(1)</script>' });
        case 26: {
            const invalidPhone = await api('post', '/api/auth/signup', {
                ...base, phone: "' OR '1'='1", full_name: "x'); DROP TABLE users;--"
            });
            expectCode(invalidPhone, '1004');
            const safePhone = newPhone();
            trackPhone(safePhone);
            const plainText = "x'); DROP TABLE users;--";
            const injectionName = await api('post', '/api/auth/signup', {
                ...base, phone: safePhone, full_name: plainText
            });
            expectCode(injectionName, OK);
            expect(injectionName.body?.data?.full_name).toBe(plainText);
            return invalidPhone;
        }
        case 27: {
            const account = await registerAccount();
            return api('post', '/api/auth/signup', {
                ...base, phone: account.phone
            });
        }
        case 28: {
            const payload = await makeStaffPayload();
            const staff = await createStaff(payload);
            expectCode(staff, OK);
            return api('post', '/api/auth/signup', { ...base, phone: payload.phone });
        }
        case 29: {
            const account = await registerAccount();
            await adapterCall('setUserActive', { phone: account.phone, isActive: false });
            return api('post', '/api/auth/signup', { ...base, phone: account.phone });
        }
        case 30: {
            const account = await registerAccount();
            await adapterCall('softDeleteUser', { phone: account.phone });
            return api('post', '/api/auth/signup', { ...base, phone: account.phone });
        }
        case 31: {
            const response = await api('post', '/api/auth/signup', {
                ...base, role_id: roles.admin, is_active: 0, user_id: 1
            });
            trackPhone(base.phone);
            expect(Number(response.body?.data?.role_id)).toBe(roles.patient);
            expect(Number(response.body?.data?.is_active)).toBe(1);
            expect(Number(response.body?.data?.user_id)).not.toBe(1);
            return response;
        }
        case 32: {
            const phone = newPhone();
            trackPhone(phone);
            const responses = await Promise.all(Array.from({ length: 5 }, (_, index) =>
                api('post', '/api/auth/signup', {
                    ...base, phone, full_name: `Concurrent ${index}`
                })
            ));
            expect(responses.filter(item => String(item.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(item => String(item.body?.code) === '9996')).toHaveLength(4);
            expect(responses.some(item => item.status >= 500)).toBe(false);
            return responses.find(item => String(item.body?.code) === OK);
        }
        case 33:
            return api('post', '/api/auth/signup', '{full_name:', { contentType: 'application/json' });
        case 34: {
            const text = await api('post', '/api/auth/signup', 'full_name=Test', { contentType: 'text/plain' });
            expectCode(text, '1003');
            return api('post', '/api/auth/signup', 'full_name=Test', {
                contentType: 'application/x-www-form-urlencoded'
            });
        }
        default: throw new Error(`Unknown signup case ${number}`);
    }
}

async function runLogin(number) {
    const payload = { phone: newPhone(), password: VALID_PASSWORD };
    switch (number) {
        case 1: {
            const account = await registerAccount({ password: VALID_PASSWORD });
            const response = await login(account);
            const data = response.body?.data;
            expect(typeof data?.token).toBe('string');
            expect(data.token.split('.')).toHaveLength(3);
            expect(Number(data?.user_info?.user_id)).toBe(Number(account.response.body?.data?.user_id));
            expect(data?.user_info?.full_name).toBe(account.full_name);
            expect(data?.user_info?.phone).toBe(account.phone);
            expect(Number(data?.user_info?.role_id)).toBe(roles.patient);
            expect(data?.user_info).not.toHaveProperty('password');
            return response;
        }
        case 2: {
            let last;
            for (const roleId of [roles.admin, roles.doctor, roles.nurse]) {
                const account = roleId === roles.admin ? admin : await createRoleAccount(roleId);
                last = await login(account);
                expectCode(last, OK);
                expect(Number(last.body?.data?.user_info?.role_id)).toBe(roleId);
            }
            return last;
        }
        case 3: {
            const account = await registerAccount();
            const auth = await login(account);
            expectCode(auth, OK);
            return api('get', '/api/profile', undefined, { token: auth.body.data.token });
        }
        case 4: {
            const account = await registerAccount();
            const response = await login(account);
            expect(Number(jwtPayload(response.body?.data?.token).exp)).toBeGreaterThan(Math.floor(Date.now() / 1000));
            return response;
        }
        case 5: {
            let last;
            for (const body of [{ password: VALID_PASSWORD }, { phone: payload.phone }]) {
                last = await api('post', '/api/auth/login', body);
                expectCode(last, '1002');
            }
            return last;
        }
        case 6: {
            const empty = await api('post', '/api/auth/login', {});
            expectCode(empty, '1002');
            const emptyPhone = await api('post', '/api/auth/login', { phone: '', password: VALID_PASSWORD });
            expectCode(emptyPhone, '1002');
            return api('post', '/api/auth/login', { phone: payload.phone, password: null });
        }
        case 7: {
            const phoneNumber = await api('post', '/api/auth/login', { phone: 912345678, password: VALID_PASSWORD });
            expectCode(phoneNumber, '1003');
            const passwordNumber = await api('post', '/api/auth/login', { phone: payload.phone, password: 123456 });
            expectCode(passwordNumber, '1003');
            return api('post', '/api/auth/login', { phone: payload.phone, password: ['a'] });
        }
        case 8: {
            let last;
            for (const phone of ['0912345', 'abc', '0112345678']) {
                last = await api('post', '/api/auth/login', { ...payload, phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 9: return api('post', '/api/auth/login', payload);
        case 10:
        case 11:
        case 12: {
            const account = await registerAccount({ password: VALID_PASSWORD });
            const wrong = number === 10 ? 'wrong-password' : number === 11 ? 'ABC123' : ' abc123 ';
            return login(account, wrong);
        }
        case 13: {
            const account = await registerAccount();
            await adapterCall('setUserActive', { phone: account.phone, isActive: false });
            return login(account);
        }
        case 14: {
            const account = await registerAccount();
            await adapterCall('softDeleteUser', { phone: account.phone });
            return login(account);
        }
        case 15: {
            const account = await registerAccount();
            const first = await login(account);
            const second = await login(account);
            expectCode(await api('get', '/api/profile', undefined, { token: first.body.data.token }), OK);
            expectCode(await api('get', '/api/profile', undefined, { token: second.body.data.token }), OK);
            return second;
        }
        case 16: {
            const account = await registerAccount();
            const responses = await Promise.all(Array.from({ length: 10 }, () => login(account)));
            expect(responses.every(item => Number(item.status) < 500)).toBe(true);
            return responses[responses.length - 1];
        }
        case 17: {
            const injectedPhone = await api('post', '/api/auth/login', {
                phone: "' OR '1'='1", password: "' OR '1'='1"
            });
            expectCode(injectedPhone, '1004');
            const account = await registerAccount({ password: VALID_PASSWORD });
            expectCode(await login(account, "' OR '1'='1"), '9995');
            return injectedPhone;
        }
        case 18: {
            const account = await registerAccount({ password: VALID_PASSWORD });
            let last;
            for (let attempt = 0; attempt < 10; attempt += 1) {
                last = await login(account, 'wrong-password');
                if (attempt >= 4) expectCode(last, '1009');
            }
            return login(account, VALID_PASSWORD);
        }
        case 19: {
            const account = await registerAccount();
            const probes = [
                await login({ ...account, phone: newPhone() }),
                await login(account, 'wrong-password'),
                await api('post', '/api/auth/login', '{phone:', { contentType: 'application/json' })
            ];
            for (const response of probes) isSafeError(response);
            return { body: { code: 'NA' } };
        }
        case 20:
            return api('post', '/api/auth/login', '{phone:', { contentType: 'application/json' });
        default: throw new Error(`Unknown login case ${number}`);
    }
}

async function runLogout(number) {
    const account = await registerAccount();
    const auth = await login(account);
    expectCode(auth, OK);
    const token = auth.body.data.token;
    switch (number) {
        case 1: {
            const response = await api('post', '/api/auth/logout', {}, { token });
            expect(response.body?.data).toEqual({});
            return response;
        }
        case 2: {
            expectCode(await api('post', '/api/auth/logout', {}, { token }), OK);
            return api('get', '/api/profile', undefined, { token });
        }
        case 3: {
            expectCode(await api('post', '/api/auth/logout', {}, { token }), OK);
            return api('post', '/api/auth/logout', {}, { token });
        }
        case 4: {
            const second = await login(account);
            const logout = await api('post', '/api/auth/logout', {}, { token });
            expectCode(logout, OK);
            return api('get', '/api/profile', undefined, { token: second.body.data.token });
        }
        case 5: {
            expectCode(await api('post', '/api/auth/logout', {}, { token }), OK);
            const relogin = await login(account);
            expectCode(await api('get', '/api/profile', undefined, { token: relogin.body.data.token }), OK);
            const old = await api('get', '/api/profile', undefined, { token });
            expectCode(old, '9998');
            return relogin;
        }
        case 6: return api('post', '/api/auth/logout', {});
        case 7: {
            const tampered = token.split('.');
            tampered[2] = `${tampered[2][0] === 'a' ? 'b' : 'a'}${tampered[2].slice(1)}`;
            let last;
            for (const authorization of ['Bearer abc', `Bearer ${tampered.join('.')}`, token, 'Bearer ']) {
                last = await api('post', '/api/auth/logout', {}, { authorization });
                expectCode(last, '9998');
            }
            return last;
        }
        case 8: {
            const expired = await createExpiredToken(account);
            return api('post', '/api/auth/logout', {}, { token: expired });
        }
        case 9: {
            const logout = await api('post', '/api/auth/logout', {}, { token });
            expectCode(logout, OK);
            return api('get', '/api/profile', undefined, { token });
        }
        default: throw new Error(`Unknown logout case ${number}`);
    }
}

async function runForgotPassword(number) {
    const account = await registerAccount();
    const validPhone = account.phone;
    switch (number) {
        case 1: {
            const response = await requestOtp(account);
            expectCode(response, OK);
            await readOtp(account);
            expect(response.body).not.toHaveProperty('otp');
            return response;
        }
        case 2: {
            const empty = await api('post', '/api/auth/forgot-password', {});
            expectCode(empty, '1002');
            const missing = await api('post', '/api/auth/forgot-password');
            expectCode(missing, '1002');
            return api('post', '/api/auth/forgot-password', { phone: '' });
        }
        case 3: {
            const numberPhone = await api('post', '/api/auth/forgot-password', { phone: 912345678 });
            expectCode(numberPhone, '1003');
            return api('post', '/api/auth/forgot-password', { phone: [validPhone] });
        }
        case 4: {
            let last;
            for (const phone of ['abc', '091234', '0112345678']) {
                last = await api('post', '/api/auth/forgot-password', { phone });
                expectCode(last, '1004');
            }
            return last;
        }
        case 5: return api('post', '/api/auth/forgot-password', { phone: newPhone() });
        case 6: {
            await adapterCall('setUserActive', { phone: account.phone, isActive: false });
            return requestOtp(account);
        }
        case 7: {
            let last;
            for (let attempt = 0; attempt < 6; attempt += 1) {
                last = await requestOtp(account);
                expectCode(last, attempt < 5 ? OK : '1009');
            }
            return last;
        }
        case 8: {
            expectCode(await requestOtp(account), OK);
            const oldOtp = await readOtp(account);
            expectCode(await requestOtp(account), OK);
            return resetPassword(account, oldOtp);
        }
        case 9: {
            await adapterCall('setOtpServiceFailure', { enabled: true });
            return requestOtp(account);
        }
        case 10: return api('post', '/api/auth/forgot-password', { phone: "' OR '1'='1" });
        case 11:
            return api('post', '/api/auth/forgot-password', '{phone:', { contentType: 'application/json' });
        default: throw new Error(`Unknown forgot-password case ${number}`);
    }
}

async function runResetPassword(number) {
    const account = await registerAccount();
    switch (number) {
        case 1: {
            expectCode(await requestOtp(account), OK);
            return resetPassword(account, await readOtp(account), newPassword());
        }
        case 2: {
            expectCode(await requestOtp(account), OK);
            const nextPassword = newPassword();
            const reset = await resetPassword(account, await readOtp(account), nextPassword);
            expectCode(reset, OK);
            expectCode(await login(account, nextPassword), OK);
            expectCode(await login(account, account.password), '9995');
            return reset;
        }
        case 3: {
            expectCode(await api('post', '/api/auth/reset-password', { otp: '123456', new_password: newPassword() }), '1002');
            expectCode(await api('post', '/api/auth/reset-password', { phone: account.phone, new_password: newPassword() }), '1002');
            return api('post', '/api/auth/reset-password', { phone: account.phone, otp: '123456' });
        }
        case 4: {
            const numericOtp = await api('post', '/api/auth/reset-password', {
                phone: account.phone, otp: 123456, new_password: newPassword()
            });
            expectCode(numericOtp, '1003');
            return api('post', '/api/auth/reset-password', {
                phone: account.phone, otp: '123456', new_password: ['a']
            });
        }
        case 5:
            expectCode(await requestOtp(account), OK);
            return resetPassword(account, await readOtp(account), 'abc12');
        case 6:
            expectCode(await requestOtp(account), OK);
            return resetPassword(account, await readOtp(account), 'abc123');
        case 7: {
            let last;
            for (const otp of ['abcdef', '12345', '1234567']) {
                last = await resetPassword(account, otp);
                expectCode(last, '1004');
            }
            return last;
        }
        case 8: {
            expectCode(await requestOtp(account), OK);
            const otp = await readOtp(account);
            return resetPassword(account, otp === '000000' ? '000001' : '000000');
        }
        case 9: {
            expectCode(await requestOtp(account), OK);
            const otp = await readOtp(account);
            await adapterCall('advanceTestClock', { milliseconds: 10 * 60 * 1000 + 1000 });
            return resetPassword(account, otp);
        }
        case 10: {
            expectCode(await requestOtp(account), OK);
            const firstOtp = await readOtp(account);
            await adapterCall('advanceTestClock', { milliseconds: 9 * 60 * 1000 + 59 * 1000 });
            const valid = await resetPassword(account, firstOtp);
            expectCode(valid, OK);
            const second = await registerAccount();
            expectCode(await requestOtp(second), OK);
            const expiredOtp = await readOtp(second);
            await adapterCall('advanceTestClock', { milliseconds: 10 * 60 * 1000 + 1000 });
            expectCode(await resetPassword(second, expiredOtp), '9993');
            return valid;
        }
        case 11: {
            expectCode(await requestOtp(account), OK);
            const otp = await readOtp(account);
            expectCode(await resetPassword(account, otp), OK);
            return resetPassword(account, otp);
        }
        case 12: {
            const other = await registerAccount();
            expectCode(await requestOtp(account), OK);
            const otp = await readOtp(account);
            expectCode(await requestOtp(other), OK);
            return resetPassword(other, otp);
        }
        case 13: return resetPassword(account, '123456');
        case 14: return api('post', '/api/auth/reset-password', {
            phone: newPhone(), otp: '123456', new_password: newPassword()
        });
        case 15: {
            expectCode(await requestOtp(account), OK);
            const realOtp = await readOtp(account);
            let last;
            for (let i = 0; i < 5; i += 1) {
                last = await resetPassword(account, realOtp === '000000' ? '000001' : '000000');
                expectCode(last, '9993');
            }
            return resetPassword(account, realOtp);
        }
        case 16: {
            const auth = await login(account);
            expectCode(auth, OK);
            expectCode(await requestOtp(account), OK);
            const reset = await resetPassword(account, await readOtp(account));
            expectCode(reset, OK);
            const oldToken = auth.body.data.token;
            return api('get', '/api/profile', undefined, { token: oldToken });
        }
        case 17:
            return api('post', '/api/auth/reset-password', '{phone:', { contentType: 'application/json' });
        default: throw new Error(`Unknown reset-password case ${number}`);
    }
}

async function runChangePassword(number) {
    const account = await registerAccount();
    const auth = await login(account);
    expectCode(auth, OK);
    const token = auth.body.data.token;
    const new_password = newPassword();
    const valid = {
        old_password: account.password,
        new_password,
        confirm_password: new_password
    };
    switch (number) {
        case 1: return api('post', '/api/auth/change-password', valid, { token });
        case 2: {
            const changed = await api('post', '/api/auth/change-password', valid, { token });
            expectCode(changed, OK);
            expectCode(await login(account, new_password), OK);
            expectCode(await login(account, account.password), '9995');
            return changed;
        }
        case 3: {
            let last;
            for (const key of ['old_password', 'new_password', 'confirm_password']) {
                const body = { ...valid };
                delete body[key];
                last = await api('post', '/api/auth/change-password', body, { token });
                expectCode(last, '1002');
            }
            return last;
        }
        case 4: {
            const oldType = await api('post', '/api/auth/change-password', {
                ...valid, old_password: 123456
            }, { token });
            expectCode(oldType, '1003');
            return api('post', '/api/auth/change-password', {
                ...valid, new_password: ['a']
            }, { token });
        }
        case 5:
            return api('post', '/api/auth/change-password', {
                ...valid, new_password: 'abc12', confirm_password: 'abc12'
            }, { token });
        case 6:
            return api('post', '/api/auth/change-password', {
                ...valid, new_password: 'abc123', confirm_password: 'abc123'
            }, { token });
        case 7:
            return api('post', '/api/auth/change-password', {
                ...valid, confirm_password: 'different'
            }, { token });
        case 8:
            return api('post', '/api/auth/change-password', {
                ...valid, new_password: '      ', confirm_password: '      '
            }, { token });
        case 9:
            return api('post', '/api/auth/change-password', {
                ...valid, old_password: 'wrong-password'
            }, { token });
        case 10:
            return api('post', '/api/auth/change-password', {
                old_password: account.password,
                new_password: account.password,
                confirm_password: account.password
            }, { token });
        case 11:
            return api('post', '/api/auth/change-password', {
                ...valid, old_password: 'wrong-password', confirm_password: 'does-not-match'
            }, { token });
        case 12: {
            const changed = await api('post', '/api/auth/change-password', valid, { token });
            expectCode(changed, OK);
            return api('get', '/api/profile', undefined, { token });
        }
        case 13:
            return api('post', '/api/auth/change-password', '{old_password:', {
                token, contentType: 'application/json'
            });
        case 14:
            return api('post', '/api/auth/change-password', valid);
        case 15: {
            const tampered = token.split('.');
            tampered[2] = `${tampered[2][0] === 'a' ? 'b' : 'a'}${tampered[2].slice(1)}`;
            let last;
            for (const authorization of [
                'Bearer abc', `Bearer ${tampered.join('.')}`, token, 'Bearer '
            ]) {
                last = await api('post', '/api/auth/change-password', valid, { authorization });
                expectCode(last, '9998');
            }
            return last;
        }
        case 16:
            return api('post', '/api/auth/change-password', valid, {
                token: await createExpiredToken(account)
            });
        case 17: {
            expectCode(await api('post', '/api/auth/logout', {}, { token }), OK);
            return api('post', '/api/auth/change-password', valid, { token });
        }
        default: throw new Error(`Unknown change-password case ${number}`);
    }
}

async function runCreateStaff(number) {
    if (!fixture) fixture = await adapterCall('prepareStaffFixture');
    const payload = await makeStaffPayload();
    switch (number) {
        case 1: {
            const response = await createStaff(payload);
            expect(Number.isInteger(response.body?.data?.user_id)).toBe(true);
            expect(Number(response.body?.data?.role_id)).toBe(payload.role_id);
            expect(Number(response.body?.data?.branch_id)).toBe(payload.branch_id);
            expect(Number(response.body?.data?.department_id)).toBe(payload.department_id);
            expect(response.body?.data).not.toHaveProperty('password');
            return response;
        }
        case 2: {
            delete payload.room_id;
            return createStaff(payload);
        }
        case 3:
            return createStaff({ ...payload, room_id: null });
        case 4:
            delete payload.gender;
            return createStaff(payload);
        case 5: {
            const created = await createStaff(payload);
            expectCode(created, OK);
            return login(payload);
        }
        case 6: {
            let last;
            for (const role_id of [roles.doctor, roles.nurse, roles.technician]) {
                last = await createStaff({ ...payload, phone: newPhone(), role_id });
                expectCode(last, OK);
                expect(Number(last.body?.data?.role_id)).toBe(role_id);
            }
            return last;
        }
        case 7: {
            let last;
            for (const key of [
                'full_name', 'phone', 'password', 'role_id', 'branch_id', 'department_id'
            ]) {
                const body = { ...payload };
                delete body[key];
                last = await api('post', '/api/auth/create-staff', body, { token: admin.token });
                expectCode(last, '1002');
            }
            return last;
        }
        case 8: {
            const empty = await api('post', '/api/auth/create-staff', {}, { token: admin.token });
            expectCode(empty, '1002');
            return api('post', '/api/auth/create-staff', undefined, { token: admin.token });
        }
        case 9: {
            const emptyName = await api('post', '/api/auth/create-staff', {
                ...payload, full_name: ''
            }, { token: admin.token });
            expectCode(emptyName, '1002');
            return api('post', '/api/auth/create-staff', {
                ...payload, phone: null, role_id: null
            }, { token: admin.token });
        }
        case 10: {
            const roleType = await api('post', '/api/auth/create-staff', {
                ...payload, role_id: 'abc'
            }, { token: admin.token });
            expectCode(roleType, '1003');
            const branchType = await api('post', '/api/auth/create-staff', {
                ...payload, branch_id: 1.5
            }, { token: admin.token });
            expectCode(branchType, '1003');
            const departmentType = await api('post', '/api/auth/create-staff', {
                ...payload, department_id: '1'
            }, { token: admin.token });
            expectCode(departmentType, '1003');
            return api('post', '/api/auth/create-staff', {
                ...payload, room_id: 'x'
            }, { token: admin.token });
        }
        case 11: {
            const phoneType = await api('post', '/api/auth/create-staff', {
                ...payload, phone: 912345678
            }, { token: admin.token });
            expectCode(phoneType, '1003');
            const passwordType = await api('post', '/api/auth/create-staff', {
                ...payload, password: 123456
            }, { token: admin.token });
            expectCode(passwordType, '1003');
            return api('post', '/api/auth/create-staff', {
                ...payload, full_name: []
            }, { token: admin.token });
        }
        case 12: {
            let last;
            for (const phone of ['0112345678', '09123', '09123abcde']) {
                last = await api('post', '/api/auth/create-staff', {
                    ...payload, phone
                }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 13:
            return api('post', '/api/auth/create-staff', {
                ...payload, password: 'abc12'
            }, { token: admin.token });
        case 14:
            return createStaff({ ...payload, password: 'abc123' });
        case 15: {
            let last;
            for (const gender of ['unknown', 'MALE']) {
                last = await api('post', '/api/auth/create-staff', {
                    ...payload, phone: newPhone(), gender
                }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 16: {
            let last;
            for (const key of ['role_id', 'branch_id', 'department_id']) {
                for (const value of [0, -1]) {
                    last = await api('post', '/api/auth/create-staff', {
                        ...payload, [key]: value
                    }, { token: admin.token });
                    expectCode(last, '1004');
                }
            }
            return last;
        }
        case 17: return api('post', '/api/auth/create-staff', {
            ...payload, role_id: 999999
        }, { token: admin.token });
        case 18: return api('post', '/api/auth/create-staff', {
            ...payload, branch_id: 999999
        }, { token: admin.token });
        case 19: return api('post', '/api/auth/create-staff', {
            ...payload, department_id: 999999
        }, { token: admin.token });
        case 20: return api('post', '/api/auth/create-staff', {
            ...payload, room_id: 999999
        }, { token: admin.token });
        case 21: {
            const otherBranchDepartment = fixture.other_branch_department_id;
            if (!Number.isInteger(otherBranchDepartment)) {
                throw new Error('prepareStaffFixture() must return other_branch_department_id for W1-CST-21.');
            }
            return api('post', '/api/auth/create-staff', {
                ...payload, department_id: otherBranchDepartment
            }, { token: admin.token });
        }
        case 22: {
            const otherDepartmentRoom = fixture.other_department_room_id;
            if (!Number.isInteger(otherDepartmentRoom)) {
                throw new Error('prepareStaffFixture() must return other_department_room_id for W1-CST-22.');
            }
            return api('post', '/api/auth/create-staff', {
                ...payload, room_id: otherDepartmentRoom
            }, { token: admin.token });
        }
        case 23: {
            const deletedBranch = fixture.deleted_branch_id;
            const deletedDepartment = fixture.deleted_department_id;
            if (!Number.isInteger(deletedBranch) || !Number.isInteger(deletedDepartment)) {
                throw new Error('prepareStaffFixture() must return deleted_branch_id and deleted_department_id for W1-CST-23.');
            }
            const branchResponse = await api('post', '/api/auth/create-staff', {
                ...payload, branch_id: deletedBranch
            }, { token: admin.token });
            expectCode(branchResponse, '9992');
            return api('post', '/api/auth/create-staff', {
                ...payload, department_id: deletedDepartment
            }, { token: admin.token });
        }
        case 24: {
            const patient = await registerAccount();
            const duplicatePatient = await api('post', '/api/auth/create-staff', {
                ...payload, phone: patient.phone
            }, { token: admin.token });
            expectCode(duplicatePatient, '9996');
            const staffPayload = { ...payload, phone: newPhone() };
            const staff = await createStaff(staffPayload);
            expectCode(staff, OK);
            const duplicateStaff = await api('post', '/api/auth/create-staff', {
                ...payload, phone: staffPayload.phone
            }, { token: admin.token });
            return duplicateStaff;
        }
        case 25: {
            const patientRole = await api('post', '/api/auth/create-staff', {
                ...payload, role_id: roles.patient
            }, { token: admin.token });
            expectCode(patientRole, '1004');
            return api('post', '/api/auth/create-staff', {
                ...payload, phone: newPhone(), role_id: roles.admin
            }, { token: admin.token });
        }
        case 26: {
            const orphanPhone = payload.phone;
            const failed = await api('post', '/api/auth/create-staff', {
                ...payload, branch_id: 999999
            }, { token: admin.token });
            expectCode(failed, '9992');
            return api('post', '/api/auth/login', {
                phone: orphanPhone, password: payload.password
            });
        }
        case 27: {
            const phone = newPhone();
            trackPhone(phone);
            const responses = await Promise.all(Array.from({ length: 5 }, (_, index) =>
                api('post', '/api/auth/create-staff', {
                    ...payload, phone, full_name: `Concurrent Staff ${index}`
                }, { token: admin.token })
            ));
            expect(responses.filter(item => String(item.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(item => String(item.body?.code) === '9996')).toHaveLength(4);
            expect(responses.some(item => item.status >= 500)).toBe(false);
            return responses.find(item => String(item.body?.code) === OK);
        }
        case 28: {
            const response = await createStaff({
                ...payload, user_id: 1, is_active: 0
            });
            expect(Number(response.body?.data?.user_id)).not.toBe(1);
            expect(Number(response.body?.data?.is_active)).toBe(1);
            return response;
        }
        case 29: {
            const xss = await api('post', '/api/auth/create-staff', {
                ...payload, full_name: '<script>alert(1)</script>'
            }, { token: admin.token });
            expectCode(xss, '1004');
            const plainText = "x'); DROP TABLE users;--";
            const sqlLike = await createStaff({
                ...payload, phone: newPhone(), full_name: plainText
            });
            expectCode(sqlLike, OK);
            expect(sqlLike.body?.data?.full_name).toBe(plainText);
            return xss;
        }
        case 30:
            return api('post', '/api/auth/create-staff', '{full_name:', {
                token: admin.token, contentType: 'application/json'
            });
        case 31:
            return api('post', '/api/auth/create-staff', payload);
        case 32: {
            const token = admin.token;
            const tampered = token.split('.');
            tampered[2] = `${tampered[2][0] === 'a' ? 'b' : 'a'}${tampered[2].slice(1)}`;
            let last;
            for (const authorization of [
                'Bearer abc', `Bearer ${tampered.join('.')}`, token, 'Bearer '
            ]) {
                last = await api('post', '/api/auth/create-staff', payload, { authorization });
                expectCode(last, '9998');
            }
            return last;
        }
        case 33:
            return api('post', '/api/auth/create-staff', payload, {
                token: await createExpiredToken(admin)
            });
        case 34: {
            const isolatedAdmin = await createRoleAccount(roles.admin);
            const isolatedLogin = await login(isolatedAdmin);
            expectCode(isolatedLogin, OK);
            const isolatedToken = isolatedLogin.body.data.token;
            const logout = await api('post', '/api/auth/logout', {}, { token: isolatedToken });
            expectCode(logout, OK);
            return api('post', '/api/auth/create-staff', payload, { token: isolatedToken });
        }
        case 35: {
            const patient = await registerAccount();
            const auth = await login(patient);
            return api('post', '/api/auth/create-staff', payload, {
                token: auth.body.data.token
            });
        }
        case 36: {
            const doctor = await createRoleAccount(roles.doctor);
            const auth = await login(doctor);
            return api('post', '/api/auth/create-staff', payload, {
                token: auth.body.data.token
            });
        }
        default: throw new Error(`Unknown create-staff case ${number}`);
    }
}
