const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    GUI: `01|1000|patient profile fields and privacy
02|1000|optional profile fields remain null
03|1000|profile reflects a previous update
04|1000|profile date and datetime formats
05|1000|doctor and admin use the profile endpoint
06|1000|query cannot expose another user's profile
07|9998|tampered JWT user id is rejected
08|9998|deleted account invalidates its token
09|1009|inactive account invalidates its token
10|9998|missing authorization
11|9998|invalid authorization formats
12|9998|expired token
13|9998|logged-out token
`,
    SUI: `01|1000|update one profile field
02|1000|update all profile fields
03|1000|partial update preserves other values
04|1000|repeat identical update
05|1000|Vietnamese profile values
06|1002|empty profile update
07|1002|unknown fields only
08|1003|year of birth type validation
09|1003|string fields type validation
10|1004|gender enum validation
11|1004|unreasonable year of birth
12|1000|year of birth boundary values
13|1004|health insurance date validation
14|1004|next of kin phone validation
15|1004|empty full name validation
16|1004|string length boundaries
17|1000|null clears optional field
18|1000|protected fields mass assignment
19|1004|XSS rejected and SQL-like text preserved
20|1003|malformed JSON
21|1003|non-JSON content type
22|9998|missing authorization
23|9998|invalid authorization formats
24|9998|expired token
25|9998|logged-out token
`,
    SUR: `01|1000|create patient account
02|1000|optional gender and active defaults
03|1000|create inactive user
04|1000|create users with multiple roles
05|1000|new user can log in
06|1002|required fields omitted individually
07|1002|empty body
08|1003|input type validation
09|1004|phone format validation
10|1004|password length boundaries
11|1004|gender validation
12|1004|active flag validation
13|1004|role id positive validation
14|9992|unknown role
15|9996|duplicate phone
16|1004|admin role cannot be assigned
17|1000|concurrent duplicate creation
18|1000|user id cannot be mass-assigned
19|1003|malformed JSON
20|9998|missing authorization
21|9998|invalid authorization formats
22|9998|expired token
23|9998|logged-out token
24|1009|patient forbidden
25|1009|doctor forbidden
`,
    GLU: `01|1000|default pagination and safe user fields
02|1000|pagination has no duplicates or omissions
03|1000|filter by role
04|1000|valid role with no users
05|1000|total agrees with all pages
06|1000|list reflects create and delete
07|1000|stable ascending order
08|1000|limit one
09|1004|maximum limit
10|1000|page beyond last page
11|1004|zero and negative page values
12|1003|non-integer query values
13|1004|non-positive role id
14|1000|unknown role returns empty list
15|1003|query injection rejected
16|9998|missing authorization
17|9998|invalid authorization formats
18|9998|expired token
19|9998|logged-out token
20|1009|patient forbidden
21|1009|doctor forbidden
`,
    GUD: `01|1000|get patient detail
02|1000|detail reflects previous update
03|1000|get staff and admin details
04|1003|non-integer path ids
05|1004|out-of-range path ids
06|9992|unknown user id
07|9992|deleted user id
08|9998|missing authorization
09|9998|invalid authorization formats
10|9998|expired token
11|9998|logged-out token
12|1009|patient forbidden
13|1009|doctor forbidden
`,
    EUR: `01|1000|change full name
02|1000|change gender
03|1000|change staff role
04|1000|lock account
05|1000|unlock account
06|1000|patient and staff response shapes
07|1000|update multiple fields
08|1002|empty update
09|1003|field type validation
10|1004|gender validation
11|1004|active flag validation
12|1004|empty name validation
13|9992|unknown role
14|1003|non-integer path ids
15|1004|out-of-range path ids
16|9992|unknown user id
17|9992|deleted user id
18|1009|admin cannot disable or demote self
19|1004|role group transition restrictions
20|1009|locked user token is rejected
21|1000|protected fields mass assignment
22|1003|malformed JSON
23|9998|missing authorization
24|9998|invalid authorization formats
25|9998|expired authorization
26|9998|logged-out authorization
27|1009|patient forbidden
28|1009|doctor forbidden
`,
    DUR: `01|1000|delete existing patient
02|9992|deleted user detail is missing
03|9992|deleted user cannot log in
04|1000|deleted user disappears from listing
05|9992|delete same user twice
06|1003|non-integer path ids
07|1004|out-of-range path ids
08|9992|unknown user id
09|1009|admin cannot delete self
10|1009|last admin cannot be deleted
11|1000|delete account with related data
12|9998|deleted user's token is invalid
13|9996|deleted account phone stays reserved
14|9998|missing authorization
15|9998|invalid authorization formats
16|9998|expired authorization
17|9998|logged-out authorization
18|1009|patient forbidden
19|1009|doctor forbidden
`,
    SRL: `01|1000|create role with name only
02|1000|create role with optional fields
03|1000|new role appears in list
04|1002|required role name
05|1003|role field types
06|1004|whitespace role name
07|1004|role name length limit
08|1004|role name format
09|1004|non-positive parent role
10|9996|duplicate role name
11|1004|uppercase duplicate role name
12|9996|reserved system role names
13|9992|unknown parent role
14|1000|concurrent duplicate role creation
15|1003|malformed JSON
16|9998|missing authorization
17|9998|invalid authorization formats
18|9998|expired authorization
19|9998|logged-out token
20|1009|patient forbidden
21|1009|doctor forbidden
`,
    GLR: `01|1000|role list item shape
02|1000|system roles exist
03|1000|new role appears in list
04|1000|role ids are unique
05|1000|list ignores unsupported pagination
06|9998|missing authorization
07|9998|invalid authorization formats
08|9998|expired authorization
09|9998|logged-out authorization
10|1009|patient forbidden
11|1009|doctor forbidden`
};

function parseCases(prefix, text) {
    return text.trim().split('\n').map(line => {
        const [number, expected, title] = line.trim().split('|');
        return { id: `W2-${prefix}-${number}`, expected, title };
    });
}

const groups = Object.entries(catalog).map(([prefix, text]) => ({
    prefix,
    cases: parseCases(prefix, text)
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 176 || new Set(allCases.map(item => item.id)).size !== 176) {
    throw new Error(`Week 2 workbook coverage must contain exactly 176 unique cases; found ${allCases.length}.`);
}

const profileFields = [
    'full_name', 'gender', 'year_of_birth', 'career', 'ethnic', 'hamlet_address',
    'commune_address', 'city_address', 'work_place', 'health_insurance_number',
    'health_insurance_validate', 'next_of_kin_name', 'next_of_kin_phone'
];
let roles;
let admin;
let staffFixture;
const casePhones = new Set();
const suitePhones = new Set();
const caseRoleNames = new Set();
const suiteRoleNames = new Set();

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') {
        throw new Error(`The target adapter must implement ${name}().`);
    }
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({
        ...values,
        expectedDatabaseName: config.databaseName
    });
}

function trackPhone(phone, scope = 'case') {
    if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) return;
    (scope === 'suite' ? suitePhones : casePhones).add(phone);
}

function trackRole(name, scope = 'case') {
    (scope === 'suite' ? suiteRoleNames : caseRoleNames).add(name);
}

function phone() {
    return `09${crypto.randomInt(10000000, 100000000)}`;
}

function password() {
    return `Mayday-${crypto.randomBytes(12).toString('hex')}`;
}

function roleName() {
    return `qa_${crypto.randomBytes(6).toString('hex')}`;
}

function expectCode(response, expected) {
    expect(String(response?.body?.code)).toBe(String(expected));
}

async function api(method, endpoint, body, {
    token,
    authorization,
    contentType,
    trackScope = 'case'
} = {}) {
    if ((endpoint.startsWith('/api/auth/signup') ||
        endpoint === '/api/auth/create-staff' ||
        endpoint === '/api/admin/users') && body) {
        trackPhone(body.phone, trackScope);
    }
    if (endpoint === '/api/roles' && body?.name && body.name.startsWith('qa_')) {
        trackRole(body.name, trackScope);
    }
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (contentType) call = call.set('Content-Type', contentType);
    if (body !== undefined) call = call.send(body);
    return call;
}

function userId(account) {
    const id = Number(account?.response?.body?.data?.user_id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Signup did not return data.user_id.');
    return id;
}

async function registerUser({ fullName = 'Mayday Week 2 User', phoneNumber = phone(), scope = 'case' } = {}) {
    const account = {
        full_name: fullName,
        phone: phoneNumber,
        password: password()
    };
    trackPhone(account.phone, scope);
    const response = await api('post', '/api/auth/signup', {
        full_name: account.full_name,
        phone: account.phone,
        password: account.password
    }, { trackScope: scope });
    expectCode(response, OK);
    account.response = response;
    return account;
}

async function login(account, passwordValue = account.password) {
    return api('post', '/api/auth/login', {
        phone: account.phone,
        password: passwordValue
    });
}

async function createAdminUser({
    fullName = 'Mayday Admin API User',
    phoneNumber = phone(),
    roleId = roles.patient,
    isActive = 1,
    passwordValue = password()
} = {}) {
    const response = await api('post', '/api/admin/users', {
        full_name: fullName,
        phone: phoneNumber,
        password: passwordValue,
        role_id: roleId,
        is_active: isActive
    }, { token: admin.token });
    const account = {
        full_name: fullName,
        phone: phoneNumber,
        password: passwordValue,
        response
    };
    return account;
}

async function createStaffUser({ roleId = roles.doctor } = {}) {
    if (!staffFixture) staffFixture = await adapterCall('prepareStaffFixture');
    const account = {
        full_name: 'Mayday Week 2 Staff',
        phone: phone(),
        password: password()
    };
    const response = await api('post', '/api/auth/create-staff', {
        ...account,
        role_id: roleId,
        branch_id: staffFixture.branch_id,
        department_id: staffFixture.department_id,
        room_id: staffFixture.room_id
    }, { token: admin.token });
    expectCode(response, OK);
    account.response = response;
    return account;
}

async function editUser(id, body, token = admin.token) {
    return api('put', `/api/admin/users/${id}`, body, { token });
}

async function deleteUser(id, token = admin.token) {
    return api('delete', `/api/admin/users/${id}`, undefined, { token });
}

async function profile(token, query = '') {
    return api('get', `/api/profile${query}`, undefined, { token });
}

async function listUsers(params = {}, token = admin.token) {
    const query = new URLSearchParams(params).toString();
    return api('get', `/api/admin/users${query ? `?${query}` : ''}`, undefined, { token });
}

async function listRoles(token = admin.token) {
    return api('get', '/api/roles', undefined, { token });
}

async function createRole({ name = roleName(), description, parent_role_id } = {}) {
    const body = { name };
    if (description !== undefined) body.description = description;
    if (parent_role_id !== undefined) body.parent_role_id = parent_role_id;
    const response = await api('post', '/api/roles', body, { token: admin.token });
    return { name, response };
}

function tamperSignature(token) {
    const parts = token.split('.');
    parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
    return parts.join('.');
}

async function expiredToken(account) {
    const result = await adapterMethod('getExpiredToken')({
        phone: account.phone,
        expectedDatabaseName: config.databaseName
    });
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error(`Adapter did not return an expired token for ${account.phone}.`);
    return token;
}

async function authCase(kind, method, endpoint, body, account) {
    if (kind === 'missing') return api(method, endpoint, body);
    if (kind === 'invalid') {
        const auth = await login(account);
        const bad = [
            'Bearer abc',
            `Bearer ${tamperSignature(auth.body?.data?.token)}`,
            auth.body?.data?.token,
            'Bearer '
        ];
        let last;
        for (const authorization of bad) {
            last = await api(method, endpoint, body, { authorization });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        return api(method, endpoint, body, { token: await expiredToken(account) });
    }
    if (kind === 'logout') {
        const auth = await login(account);
        expectCode(await api('post', '/api/auth/logout', {}, { token: auth.body.data.token }), OK);
        return api(method, endpoint, body, { token: auth.body.data.token });
    }
    throw new Error(`Unknown auth test kind ${kind}`);
}

async function cleanupAccounts(accounts) {
    const failures = [];
    for (const phoneNumber of accounts) {
        try {
            await adapterCall('deleteUser', { phone: phoneNumber });
            accounts.delete(phoneNumber);
        } catch (error) {
            failures.push(`${phoneNumber}: ${error.message}`);
        }
    }
    if (failures.length) throw new Error(`Account cleanup failed: ${failures.join('; ')}`);
}

async function cleanupRoles(names) {
    const failures = [];
    for (const name of names) {
        try {
            await adapterCall('deleteTestRole', { name });
            names.delete(name);
        } catch (error) {
            failures.push(`${name}: ${error.message}`);
        }
    }
    if (failures.length) throw new Error(`Role cleanup failed: ${failures.join('; ')}`);
}

async function cleanupSetups() {
    const errors = [];
    for (const [label, operation] of [
        ['test hooks', () => adapterCall('resetTestHooks')],
        ['case accounts', () => cleanupAccounts(casePhones)],
        ['case roles', () => cleanupRoles(caseRoleNames)]
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
}

beforeAll(async () => {
    const db = await adapterCall('assertTestDatabase');
    if (db?.isTestDatabase !== true || db.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}".`);
    }
    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    for (const key of ['admin', 'patient', 'doctor', 'nurse', 'technician']) {
        if (!Number.isInteger(roles?.[key]) || roles[key] <= 0) {
            throw new Error(`Adapter getRoleIds() must return a positive integer "${key}" role ID.`);
        }
    }
    if (roles.admin !== 1) throw new Error('The workbook specifies director/admin role ID 1.');
    staffFixture = await adapterCall('prepareStaffFixture');
    admin = await registerUser({ fullName: 'Mayday Week 2 Test Admin', scope: 'suite' });
    const promotion = await adapterCall('promoteUser', { phone: admin.phone, roleId: roles.admin });
    if (Number(promotion?.roleId) !== roles.admin) throw new Error('Adapter failed to promote the suite admin.');
    const auth = await login(admin);
    expectCode(auth, OK);
    if (!auth.body?.data?.token) throw new Error('Suite admin login did not return data.token.');
    admin.token = auth.body.data.token;
});

afterEach(cleanupSetups);

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['case cleanup', cleanupSetups],
        ['suite account cleanup', () => cleanupAccounts(suitePhones)],
        ['suite role cleanup', () => cleanupRoles(suiteRoleNames)],
        ['fixture cleanup', () => staffFixture ? adapterCall('cleanupTestFixtures') : Promise.resolve()]
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
});

describe(`Target ${config.targetName} - Week 2`, () => {
    describe.each(groups)('Week 2 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            const response = await runCase(id);
            expectCode(response, expected);
        });
    });
});

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    switch (prefix) {
        case 'GUI': return runGetUserInfo(number);
        case 'SUI': return runSetUserInfo(number);
        case 'SUR': return runSetUser(number);
        case 'GLU': return runGetListUsers(number);
        case 'GUD': return runGetUserDetail(number);
        case 'EUR': return runEditUser(number);
        case 'DUR': return runDeleteUser(number);
        case 'SRL': return runSetRole(number);
        case 'GLR': return runGetListRoles(number);
        default: throw new Error(`Unknown Week 2 case ID: ${id}`);
    }
}

async function runGetUserInfo(number) {
    const user = await registerUser();
    const auth = await login(user);
    const token = auth.body?.data?.token;
    switch (number) {
        case 1: {
            const response = await profile(token);
            const data = response.body?.data;
            for (const key of ['user_id', 'full_name', 'phone', 'role_id']) {
                expect(data).toHaveProperty(key);
            }
            expect(Number(data.user_id)).toBe(userId(user));
            expect(data).not.toHaveProperty('password');
            expect(data).not.toHaveProperty('password_hash');
            return response;
        }
        case 2: {
            const data = (await profile(token)).body?.data;
            for (const key of profileFields.slice(1)) {
                expect(data).toHaveProperty(key);
            }
            expect(data.career).toBeNull();
            expect(data.year_of_birth).toBeNull();
            return { body: { code: OK } };
        }
        case 3: {
            const update = await api('put', '/api/profile', { career: 'Giáo viên' }, { token });
            expectCode(update, OK);
            const response = await profile(token);
            expect(response.body?.data?.career).toBe('Giáo viên');
            return response;
        }
        case 4: {
            const update = await api('put', '/api/profile', {
                health_insurance_validate: '2030-12-31'
            }, { token });
            expectCode(update, OK);
            const data = (await profile(token)).body?.data;
            expect(Number.isNaN(Date.parse(data.first_visit))).toBe(false);
            expect(data.health_insurance_validate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            return { body: { code: OK } };
        }
        case 5: {
            const doctor = await createStaffUser();
            const doctorAuth = await login(doctor);
            const doctorProfile = await profile(doctorAuth.body.data.token);
            expect(Number(doctorProfile.body?.data?.role_id)).toBe(roles.doctor);
            const adminProfile = await profile(admin.token);
            expect(Number(adminProfile.body?.data?.role_id)).toBe(roles.admin);
            return adminProfile;
        }
        case 6: {
            const response = await api('get', `/api/profile?user_id=${userId(admin)}&id=${userId(admin)}`, undefined, { token });
            if (String(response.body?.code) === '1009') return response;
            expect(Number(response.body?.data?.user_id)).toBe(userId(user));
            return response;
        }
        case 7: {
            const parts = token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            payload.user_id = userId(admin);
            parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
            return profile(parts.join('.'));
        }
        case 8: {
            const deleted = await deleteUser(userId(user));
            expectCode(deleted, OK);
            return profile(token);
        }
        case 9: {
            const locked = await editUser(userId(user), { is_active: 0 });
            expectCode(locked, OK);
            return profile(token);
        }
        case 10: return authCase('missing', 'get', '/api/profile', undefined, user);
        case 11: return authCase('invalid', 'get', '/api/profile', undefined, user);
        case 12: return authCase('expired', 'get', '/api/profile', undefined, user);
        case 13: return authCase('logout', 'get', '/api/profile', undefined, user);
        default: throw new Error(`Unknown get-user-info case ${number}`);
    }
}

function fullProfileUpdate() {
    return {
        full_name: 'Nguyễn Thị Bình',
        gender: 'female',
        year_of_birth: 1992,
        career: 'Bác sĩ',
        ethnic: 'Kinh',
        hamlet_address: 'Thôn 1',
        commune_address: 'Xã An Bình',
        city_address: 'Hà Nội',
        work_place: 'Phòng khám Mayday',
        health_insurance_number: 'TEST-123456',
        health_insurance_validate: '2030-12-31',
        next_of_kin_name: 'Nguyễn Văn An',
        next_of_kin_phone: '0912345678'
    };
}

async function runSetUserInfo(number) {
    const user = await registerUser();
    const auth = await login(user);
    const token = auth.body?.data?.token;
    const allFields = fullProfileUpdate();
    switch (number) {
        case 1: {
            const response = await api('put', '/api/profile', { career: 'Giáo viên' }, { token });
            expectCode(response, OK);
            expect((await profile(token)).body?.data?.career).toBe('Giáo viên');
            return response;
        }
        case 2: {
            const response = await api('put', '/api/profile', allFields, { token });
            expectCode(response, OK);
            for (const [key, value] of Object.entries(allFields)) {
                expect(response.body?.data?.[key]).toBe(value);
            }
            return response;
        }
        case 3: {
            const first = await api('put', '/api/profile', { year_of_birth: 1990 }, { token });
            expectCode(first, OK);
            const second = await api('put', '/api/profile', { career: 'Giáo viên' }, { token });
            expectCode(second, OK);
            expect((await profile(token)).body?.data?.year_of_birth).toBe(1990);
            return second;
        }
        case 4: {
            const first = await api('put', '/api/profile', { career: 'Giáo viên' }, { token });
            expectCode(first, OK);
            return api('put', '/api/profile', { career: 'Giáo viên' }, { token });
        }
        case 5: {
            const values = { career: 'Nông dân', ethnic: 'Kinh' };
            const response = await api('put', '/api/profile', values, { token });
            expect(response.body?.data?.career).toBe(values.career);
            expect(response.body?.data?.ethnic).toBe(values.ethnic);
            return response;
        }
        case 6: return api('put', '/api/profile', {}, { token });
        case 7: return api('put', '/api/profile', { foo: 'bar' }, { token });
        case 8: {
            const stringYear = await api('put', '/api/profile', { year_of_birth: '1999' }, { token });
            expectCode(stringYear, '1003');
            const floatYear = await api('put', '/api/profile', { year_of_birth: 1999.5 }, { token });
            expectCode(floatYear, '1003');
            return api('put', '/api/profile', { year_of_birth: true }, { token });
        }
        case 9: {
            const career = await api('put', '/api/profile', { career: 123 }, { token });
            expectCode(career, '1003');
            return api('put', '/api/profile', { ethnic: ['a'] }, { token });
        }
        case 10: {
            let last;
            for (const gender of ['unknown', 'MALE']) {
                last = await api('put', '/api/profile', { gender }, { token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 11: {
            let last;
            for (const year_of_birth of [0, -1, 1800, new Date().getFullYear() + 1]) {
                last = await api('put', '/api/profile', { year_of_birth }, { token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 12: {
            const lower = await api('put', '/api/profile', { year_of_birth: 1900 }, { token });
            expectCode(lower, OK);
            return api('put', '/api/profile', { year_of_birth: new Date().getFullYear() }, { token });
        }
        case 13: {
            let last;
            for (const health_insurance_validate of ['31/12/2030', '2030-13-40', 'abc']) {
                last = await api('put', '/api/profile', { health_insurance_validate }, { token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 14: {
            let last;
            for (const next_of_kin_phone of ['123', '0112345678']) {
                last = await api('put', '/api/profile', { next_of_kin_phone }, { token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 15: {
            const empty = await api('put', '/api/profile', { full_name: '' }, { token });
            expectCode(empty, '1004');
            return api('put', '/api/profile', { full_name: '   ' }, { token });
        }
        case 16: {
            let last;
            for (const [field, length] of Object.entries({
                full_name: 101, gender: 256, career: 256, ethnic: 256,
                hamlet_address: 256, commune_address: 256, city_address: 256,
                work_place: 256, health_insurance_number: 256,
                next_of_kin_name: 256, next_of_kin_phone: 256
            })) {
                last = await api('put', '/api/profile', { [field]: 'x'.repeat(length) }, { token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 17: {
            const response = await api('put', '/api/profile', { career: 'Giáo viên' }, { token });
            expectCode(response, OK);
            const cleared = await api('put', '/api/profile', { career: null }, { token });
            expect(cleared.body?.data?.career).toBeNull();
            return cleared;
        }
        case 18: {
            const before = (await profile(token)).body.data;
            const mass = await api('put', '/api/profile', {
                career: 'Tester',
                phone: '0911111111',
                role_id: roles.admin,
                user_id: 1,
                is_active: 0,
                first_visit: '2000-01-01T00:00:00Z'
            }, { token });
            expect(Number(mass.body?.data?.user_id)).toBe(Number(before.user_id));
            expect(mass.body?.data?.phone).toBe(before.phone);
            expect(Number(mass.body?.data?.role_id)).toBe(Number(before.role_id));
            expectCode(await api('put', '/api/profile', {
                phone: '0911111111', role_id: roles.admin, user_id: 1, is_active: 0
            }, { token }), '1002');
            return mass;
        }
        case 19: {
            const xss = await api('put', '/api/profile', { career: '<script>alert(1)</script>' }, { token });
            expectCode(xss, '1004');
            const plain = "x'; DROP TABLE users;--";
            const safe = await api('put', '/api/profile', { work_place: plain }, { token });
            expect(safe.body?.data?.work_place).toBe(plain);
            return xss;
        }
        case 20:
            return api('put', '/api/profile', '{career:', { token, contentType: 'application/json' });
        case 21:
            return api('put', '/api/profile', 'career=test', { token, contentType: 'text/plain' });
        case 22: return authCase('missing', 'put', '/api/profile', { career: 'Tester' }, user);
        case 23: return authCase('invalid', 'put', '/api/profile', { career: 'Tester' }, user);
        case 24: return authCase('expired', 'put', '/api/profile', { career: 'Tester' }, user);
        case 25: return authCase('logout', 'put', '/api/profile', { career: 'Tester' }, user);
        default: throw new Error(`Unknown set-user-info case ${number}`);
    }
}

function newAdminUserPayload(overrides = {}) {
    return {
        full_name: 'Mayday Admin Created User',
        phone: phone(),
        password: password(),
        gender: 'male',
        role_id: roles.patient,
        is_active: 1,
        ...overrides
    };
}

async function runSetUser(number) {
    const payload = newAdminUserPayload();
    switch (number) {
        case 1: {
            const response = await api('post', '/api/admin/users', payload, { token: admin.token });
            for (const key of ['user_id', 'full_name', 'phone', 'role_id', 'is_active']) {
                expect(response.body?.data).toHaveProperty(key);
            }
            expect(response.body?.data).not.toHaveProperty('password');
            return response;
        }
        case 2: {
            delete payload.gender;
            delete payload.is_active;
            return api('post', '/api/admin/users', payload, { token: admin.token });
        }
        case 3:
            return api('post', '/api/admin/users', { ...payload, is_active: 0 }, { token: admin.token });
        case 4: {
            let last;
            for (const role_id of [roles.patient, roles.doctor, roles.nurse]) {
                last = await api('post', '/api/admin/users', {
                    ...payload, phone: phone(), role_id
                }, { token: admin.token });
                expectCode(last, OK);
            }
            return last;
        }
        case 5: {
            const created = await api('post', '/api/admin/users', payload, { token: admin.token });
            expectCode(created, OK);
            return login({ phone: payload.phone, password: payload.password });
        }
        case 6: {
            let last;
            for (const key of ['full_name', 'phone', 'password', 'role_id']) {
                const body = { ...payload };
                delete body[key];
                last = await api('post', '/api/admin/users', body, { token: admin.token });
                expectCode(last, '1002');
            }
            return last;
        }
        case 7: {
            const empty = await api('post', '/api/admin/users', {}, { token: admin.token });
            expectCode(empty, '1002');
            const nullBody = await api('post', '/api/admin/users', null, { token: admin.token });
            expectCode(nullBody, '1002');
            return api('post', '/api/admin/users', '', { token: admin.token });
        }
        case 8: {
            const roleType = await api('post', '/api/admin/users', { ...payload, role_id: 'abc' }, { token: admin.token });
            expectCode(roleType, '1003');
            const activeType = await api('post', '/api/admin/users', { ...payload, is_active: 'yes' }, { token: admin.token });
            expectCode(activeType, '1003');
            const phoneType = await api('post', '/api/admin/users', { ...payload, phone: 912345678 }, { token: admin.token });
            expectCode(phoneType, '1003');
            return api('post', '/api/admin/users', { ...payload, password: 123456 }, { token: admin.token });
        }
        case 9: {
            const invalidPhone = await api('post', '/api/admin/users', { ...payload, phone: '0112345678' }, { token: admin.token });
            expectCode(invalidPhone, '1004');
            return api('post', '/api/admin/users', { ...payload, phone: '09123' }, { token: admin.token });
        }
        case 10: {
            const short = await api('post', '/api/admin/users', { ...payload, password: 'abc12' }, { token: admin.token });
            expectCode(short, '1004');
            expectCode(await api('post', '/api/admin/users', {
                ...payload, phone: phone(), password: 'abc123'
            }, { token: admin.token }), OK);
            return short;
        }
        case 11: return api('post', '/api/admin/users', { ...payload, gender: 'unknown' }, { token: admin.token });
        case 12: {
            const high = await api('post', '/api/admin/users', { ...payload, is_active: 2 }, { token: admin.token });
            expectCode(high, '1004');
            return api('post', '/api/admin/users', { ...payload, is_active: -1 }, { token: admin.token });
        }
        case 13: {
            const zero = await api('post', '/api/admin/users', { ...payload, role_id: 0 }, { token: admin.token });
            expectCode(zero, '1004');
            return api('post', '/api/admin/users', { ...payload, role_id: -1 }, { token: admin.token });
        }
        case 14: return api('post', '/api/admin/users', { ...payload, role_id: 999999 }, { token: admin.token });
        case 15: {
            const existing = await registerUser();
            return api('post', '/api/admin/users', { ...payload, phone: existing.phone }, { token: admin.token });
        }
        case 16: return api('post', '/api/admin/users', { ...payload, role_id: roles.admin }, { token: admin.token });
        case 17: {
            const phoneNumber = phone();
            const responses = await Promise.all(Array.from({ length: 5 }, (_, index) =>
                api('post', '/api/admin/users', {
                    ...payload, phone: phoneNumber, full_name: `Concurrent ${index}`
                }, { token: admin.token })
            ));
            expect(responses.filter(item => String(item.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(item => String(item.body?.code) === '9996')).toHaveLength(4);
            expect(responses.some(item => item.status >= 500)).toBe(false);
            return responses.find(item => String(item.body?.code) === OK);
        }
        case 18: {
            const response = await api('post', '/api/admin/users', { ...payload, user_id: 1 }, { token: admin.token });
            expect(Number(response.body?.data?.user_id)).not.toBe(1);
            return response;
        }
        case 19:
            return api('post', '/api/admin/users', '{full_name:', {
                token: admin.token, contentType: 'application/json'
            });
        case 20: return authCase('missing', 'post', '/api/admin/users', payload, admin);
        case 21: return authCase('invalid', 'post', '/api/admin/users', payload, admin);
        case 22: return authCase('expired', 'post', '/api/admin/users', payload, admin);
        case 23: return authCase('logout', 'post', '/api/admin/users', payload, admin);
        case 24: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('post', '/api/admin/users', payload, { token: auth.body.data.token });
        }
        case 25: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return api('post', '/api/admin/users', payload, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown set-user case ${number}`);
    }
}

async function runGetListUsers(number) {
    switch (number) {
        case 1: {
            const response = await listUsers();
            expect(Array.isArray(response.body?.data)).toBe(true);
            expect(response.body.data.length).toBeLessThanOrEqual(20);
            expect(Number.isInteger(response.body?.total)).toBe(true);
            for (const user of response.body.data) {
                for (const key of ['user_id', 'full_name', 'phone', 'role_id', 'is_active']) {
                    expect(user).toHaveProperty(key);
                }
                expect(user).not.toHaveProperty('password');
            }
            return response;
        }
        case 2: {
            const role = await createRole();
            expectCode(role.response, OK);
            const scopedRoleId = Number(role.response.body?.data?.id);
            const created = [];
            for (let i = 0; i < 6; i += 1) {
                created.push(await createAdminUser({ roleId: scopedRoleId }));
            }
            const first = await listUsers({ page: 1, limit: 5 });
            const second = await listUsers({ page: 2, limit: 5 });
            const ids = [...first.body.data, ...second.body.data].map(item => item.user_id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(new Set(ids)).toEqual(new Set(created.map(userId)));
            expect(first.body.data.length).toBeLessThanOrEqual(5);
            expect(second.body.data.length).toBeLessThanOrEqual(5);
            return first;
        }
        case 3: {
            await createAdminUser({ roleId: roles.patient });
            const response = await listUsers({ role_id: roles.patient, limit: 100 });
            expect(response.body.data.every(item => Number(item.role_id) === roles.patient)).toBe(true);
            expect(Number(response.body.total)).toBe(response.body.data.length);
            return response;
        }
        case 4: {
            const role = await createRole();
            expectCode(role.response, OK);
            return listUsers({ role_id: role.response.body.data.id, limit: 100 });
        }
        case 5: {
            const first = await listUsers({ page: 1, limit: 100 });
            const total = Number(first.body.total);
            expect(total).toBeGreaterThanOrEqual(first.body.data.length);
            const pages = Math.ceil(total / 100);
            const allIds = [];
            for (let page = 1; page <= pages; page += 1) {
                const response = await listUsers({ page, limit: 100 });
                allIds.push(...response.body.data.map(item => item.user_id));
            }
            expect(allIds.length).toBe(total);
            return first;
        }
        case 6: {
            const baseline = await listUsers({ role_id: roles.patient, limit: 100 });
            const created = await createAdminUser({ roleId: roles.patient });
            const afterCreate = await listUsers({ role_id: roles.patient, limit: 100 });
            expect(Number(afterCreate.body.total)).toBe(Number(baseline.body.total) + 1);
            const removed = await deleteUser(userId(created));
            expectCode(removed, OK);
            return listUsers({ role_id: roles.patient, limit: 100 });
        }
        case 7: {
            const params = { page: 1, limit: 100 };
            const first = await listUsers(params);
            const second = await listUsers(params);
            expect(first.body.data.map(item => item.user_id)).toEqual(second.body.data.map(item => item.user_id));
            expect(first.body.data.map(item => item.user_id)).toEqual(
                [...first.body.data].map(item => item.user_id).sort((a, b) => a - b)
            );
            return first;
        }
        case 8: {
            const response = await listUsers({ limit: 1 });
            expect(response.body.data).toHaveLength(1);
            return response;
        }
        case 9: {
            const overLimit = await listUsers({ limit: 101 });
            expectCode(overLimit, '1004');
            return listUsers({ limit: 1000 });
        }
        case 10: {
            const response = await listUsers({ page: 9999, limit: 20 });
            expect(response.body.data).toEqual([]);
            return response;
        }
        case 11: {
            const zeroPage = await listUsers({ page: 0 });
            expectCode(zeroPage, '1004');
            const negativePage = await listUsers({ page: -1 });
            expectCode(negativePage, '1004');
            const zeroLimit = await listUsers({ limit: 0 });
            expectCode(zeroLimit, '1004');
            return listUsers({ limit: -5 });
        }
        case 12: {
            const badPage = await listUsers({ page: 'abc' });
            expectCode(badPage, '1003');
            const badLimit = await listUsers({ limit: 1.5 });
            expectCode(badLimit, '1003');
            return listUsers({ role_id: 'x' });
        }
        case 13: {
            const zero = await listUsers({ role_id: 0 });
            expectCode(zero, '1004');
            return listUsers({ role_id: -1 });
        }
        case 14: {
            const response = await listUsers({ role_id: 999999 });
            expect(response.body.data).toEqual([]);
            expect(Number(response.body.total)).toBe(0);
            return response;
        }
        case 15: {
            const response = await listUsers({ role_id: '1 OR 1=1', page: '1;DROP TABLE users' });
            return response;
        }
        case 16: return authCase('missing', 'get', '/api/admin/users', undefined, admin);
        case 17: return authCase('invalid', 'get', '/api/admin/users', undefined, admin);
        case 18: return authCase('expired', 'get', '/api/admin/users', undefined, admin);
        case 19: return authCase('logout', 'get', '/api/admin/users', undefined, admin);
        case 20: {
            const patient = await registerUser();
            const auth = await login(patient);
            return listUsers({}, auth.body.data.token);
        }
        case 21: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return listUsers({}, auth.body.data.token);
        }
        default: throw new Error(`Unknown get-list-users case ${number}`);
    }
}

async function runGetUserDetail(number) {
    const patient = await createAdminUser({ roleId: roles.patient });
    const id = userId(patient);
    switch (number) {
        case 1: {
            const response = await api('get', `/api/admin/users/${id}`, undefined, { token: admin.token });
            expect(Number(response.body?.data?.user_id)).toBe(id);
            expect(response.body?.data).not.toHaveProperty('password');
            return response;
        }
        case 2: {
            await editUser(id, { full_name: 'Updated Detail User' });
            const response = await api('get', `/api/admin/users/${id}`, undefined, { token: admin.token });
            expect(response.body?.data?.full_name).toBe('Updated Detail User');
            return response;
        }
        case 3: {
            const doctor = await createStaffUser();
            const staff = await api('get', `/api/admin/users/${userId(doctor)}`, undefined, { token: admin.token });
            expect(Number(staff.body?.data?.role_id)).toBe(roles.doctor);
            const adminDetail = await api('get', `/api/admin/users/${userId(admin)}`, undefined, { token: admin.token });
            expect(Number(adminDetail.body?.data?.role_id)).toBe(roles.admin);
            return adminDetail;
        }
        case 4: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('get', `/api/admin/users/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 5: {
            const zero = await api('get', '/api/admin/users/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('get', '/api/admin/users/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('get', '/api/admin/users/99999999999999999999', undefined, { token: admin.token });
        }
        case 6: return api('get', '/api/admin/users/999999', undefined, { token: admin.token });
        case 7: {
            expectCode(await deleteUser(id), OK);
            return api('get', `/api/admin/users/${id}`, undefined, { token: admin.token });
        }
        case 8: return authCase('missing', 'get', `/api/admin/users/${id}`, undefined, admin);
        case 9: return authCase('invalid', 'get', `/api/admin/users/${id}`, undefined, admin);
        case 10: return authCase('expired', 'get', `/api/admin/users/${id}`, undefined, admin);
        case 11: return authCase('logout', 'get', `/api/admin/users/${id}`, undefined, admin);
        case 12: {
            const user = await registerUser();
            const auth = await login(user);
            return api('get', `/api/admin/users/${id}`, undefined, { token: auth.body.data.token });
        }
        case 13: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return api('get', `/api/admin/users/${id}`, undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown get-user-detail case ${number}`);
    }
}

async function runEditUser(number) {
    const patient = await createAdminUser({ roleId: roles.patient });
    const id = userId(patient);
    switch (number) {
        case 1: return editUser(id, { full_name: 'Tên mới' });
        case 2: return editUser(id, { gender: 'female' });
        case 3: {
            const staff = await createStaffUser();
            return editUser(userId(staff), { role_id: roles.nurse });
        }
        case 4: return editUser(id, { is_active: 0 });
        case 5: {
            const first = await editUser(id, { is_active: 0 });
            expectCode(first, OK);
            const second = await editUser(id, { is_active: 1 });
            expectCode(second, OK);
            return login(patient);
        }
        case 6: {
            const patientResponse = await editUser(id, { full_name: 'Patient Updated' });
            expect(Number(patientResponse.body?.data?.role_id)).toBe(roles.patient);
            const staff = await createStaffUser();
            const staffResponse = await editUser(userId(staff), { full_name: 'Staff Updated' });
            expect(Number(staffResponse.body?.data?.role_id)).toBe(roles.doctor);
            return staffResponse;
        }
        case 7:
            return editUser(id, { full_name: 'Multi Updated', gender: 'female', role_id: roles.patient, is_active: 1 });
        case 8: return editUser(id, {});
        case 9: {
            const roleType = await editUser(id, { role_id: 'abc' });
            expectCode(roleType, '1003');
            const activeType = await editUser(id, { is_active: 'yes' });
            expectCode(activeType, '1003');
            return editUser(id, { full_name: 123 });
        }
        case 10: return editUser(id, { gender: 'unknown' });
        case 11: {
            const high = await editUser(id, { is_active: 2 });
            expectCode(high, '1004');
            return editUser(id, { is_active: -1 });
        }
        case 12: {
            const empty = await editUser(id, { full_name: '' });
            expectCode(empty, '1004');
            return editUser(id, { full_name: '   ' });
        }
        case 13: return editUser(id, { role_id: 999999 });
        case 14: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('put', `/api/admin/users/${encodeURIComponent(badId)}`, { full_name: 'X' }, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 15: {
            const zero = await api('put', '/api/admin/users/0', { full_name: 'X' }, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('put', '/api/admin/users/-1', { full_name: 'X' }, { token: admin.token });
            expectCode(negative, '1004');
            return api('put', '/api/admin/users/99999999999999999999', { full_name: 'X' }, { token: admin.token });
        }
        case 16: {
            expectCode(await deleteUser(id), OK);
            return editUser(id, { full_name: 'Deleted unknown user' });
        }
        case 17: {
            expectCode(await deleteUser(id), OK);
            return editUser(id, { full_name: 'Deleted' });
        }
        case 18: {
            const disabled = await editUser(userId(admin), { is_active: 0 });
            expectCode(disabled, '1009');
            return editUser(userId(admin), { role_id: roles.nurse });
        }
        case 19: {
            const patientToDoctor = await editUser(id, { role_id: roles.doctor });
            expectCode(patientToDoctor, '1004');
            const staff = await createStaffUser();
            const staffToPatient = await editUser(userId(staff), { role_id: roles.patient });
            expectCode(staffToPatient, '1004');
            return editUser(id, { role_id: roles.admin });
        }
        case 20: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            expectCode(await editUser(userId(doctor), { is_active: 0 }), OK);
            return profile(auth.body.data.token);
        }
        case 21: {
            const before = (await api('get', `/api/admin/users/${id}`, undefined, { token: admin.token })).body.data;
            const response = await editUser(id, {
                full_name: 'Mass Assignment',
                phone: '0912345678',
                password: 'Changed-Password',
                user_id: 1
            });
            expect(Number(response.body?.data?.user_id)).toBe(Number(before.user_id));
            expect(response.body?.data?.phone).toBe(before.phone);
            return response;
        }
        case 22:
            return api('put', `/api/admin/users/${id}`, '{full_name:', {
                token: admin.token, contentType: 'application/json'
            });
        case 23: return authCase('missing', 'put', `/api/admin/users/${id}`, { full_name: 'X' }, admin);
        case 24: return authCase('invalid', 'put', `/api/admin/users/${id}`, { full_name: 'X' }, admin);
        case 25: return authCase('expired', 'put', `/api/admin/users/${id}`, { full_name: 'X' }, admin);
        case 26: return authCase('logout', 'put', `/api/admin/users/${id}`, { full_name: 'X' }, admin);
        case 27: {
            const user = await registerUser();
            const auth = await login(user);
            return editUser(id, { full_name: 'Forbidden' }, auth.body.data.token);
        }
        case 28: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return editUser(id, { full_name: 'Forbidden' }, auth.body.data.token);
        }
        default: throw new Error(`Unknown edit-user case ${number}`);
    }
}

async function runDeleteUser(number) {
    const patient = await createAdminUser({ roleId: roles.patient });
    const id = userId(patient);
    switch (number) {
        case 1: {
            const response = await deleteUser(id);
            expect(response.body?.data).toEqual({});
            return response;
        }
        case 2: {
            expectCode(await deleteUser(id), OK);
            return api('get', `/api/admin/users/${id}`, undefined, { token: admin.token });
        }
        case 3: {
            expectCode(await deleteUser(id), OK);
            return login(patient);
        }
        case 4: {
            const before = await listUsers({ role_id: roles.patient, limit: 100 });
            expectCode(await deleteUser(id), OK);
            const after = await listUsers({ role_id: roles.patient, limit: 100 });
            expect(Number(after.body.total)).toBe(Number(before.body.total) - 1);
            expect(after.body.data.some(item => Number(item.user_id) === id)).toBe(false);
            return after;
        }
        case 5: {
            expectCode(await deleteUser(id), OK);
            return deleteUser(id);
        }
        case 6: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('delete', `/api/admin/users/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 7: {
            const zero = await api('delete', '/api/admin/users/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('delete', '/api/admin/users/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('delete', '/api/admin/users/99999999999999999999', undefined, { token: admin.token });
        }
        case 8: {
            expectCode(await deleteUser(id), OK);
            return deleteUser(id);
        }
        case 9: return deleteUser(userId(admin));
        case 10: return deleteUser(userId(admin));
        case 11: {
            await adapterCall('prepareUserWithLinkedData', { phone: patient.phone });
            return deleteUser(id);
        }
        case 12: {
            const auth = await login(patient);
            expectCode(await deleteUser(id), OK);
            return profile(auth.body.data.token);
        }
        case 13: {
            expectCode(await deleteUser(id), OK);
            return api('post', '/api/auth/signup', {
                full_name: 'Reserved Phone',
                phone: patient.phone,
                password: password()
            });
        }
        case 14: return authCase('missing', 'delete', `/api/admin/users/${id}`, undefined, admin);
        case 15: return authCase('invalid', 'delete', `/api/admin/users/${id}`, undefined, admin);
        case 16: return authCase('expired', 'delete', `/api/admin/users/${id}`, undefined, admin);
        case 17: return authCase('logout', 'delete', `/api/admin/users/${id}`, undefined, admin);
        case 18: {
            const user = await registerUser();
            const auth = await login(user);
            return deleteUser(id, auth.body.data.token);
        }
        case 19: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return deleteUser(id, auth.body.data.token);
        }
        default: throw new Error(`Unknown delete-user case ${number}`);
    }
}

async function runSetRole(number) {
    const name = roleName();
    switch (number) {
        case 1: {
            const role = await createRole({ name });
            expect(role.response.body?.data).toMatchObject({
                name,
                description: null,
                parent_role_id: null
            });
            return role.response;
        }
        case 2:
            return (await createRole({
                name,
                description: 'Role created for integration tests',
                parent_role_id: roles.admin
            })).response;
        case 3: {
            const role = await createRole({ name });
            expectCode(role.response, OK);
            const list = await listRoles();
            expect(list.body.data.some(item => item.name === name)).toBe(true);
            return list;
        }
        case 4: {
            const empty = await api('post', '/api/roles', {}, { token: admin.token });
            expectCode(empty, '1002');
            return api('post', '/api/roles', { name: '' }, { token: admin.token });
        }
        case 5: {
            const numberName = await api('post', '/api/roles', { name: 123 }, { token: admin.token });
            expectCode(numberName, '1003');
            const numberDescription = await api('post', '/api/roles', { name, description: 123 }, { token: admin.token });
            expectCode(numberDescription, '1003');
            return api('post', '/api/roles', { name, parent_role_id: 'abc' }, { token: admin.token });
        }
        case 6: return api('post', '/api/roles', { name: '   ' }, { token: admin.token });
        case 7: return api('post', '/api/roles', { name: 'a'.repeat(51) }, { token: admin.token });
        case 8: {
            const space = await api('post', '/api/roles', { name: 'sub admin!' }, { token: admin.token });
            expectCode(space, '1004');
            return api('post', '/api/roles', { name: '<script>' }, { token: admin.token });
        }
        case 9: {
            const zero = await api('post', '/api/roles', { name, parent_role_id: 0 }, { token: admin.token });
            expectCode(zero, '1004');
            return api('post', '/api/roles', { name, parent_role_id: -1 }, { token: admin.token });
        }
        case 10: {
            const first = await createRole({ name });
            expectCode(first.response, OK);
            return api('post', '/api/roles', { name }, { token: admin.token });
        }
        case 11: return api('post', '/api/roles', { name: 'Admin' }, { token: admin.token });
        case 12: {
            let last;
            for (const reserved of ['admin', 'doctor', 'patient']) {
                last = await api('post', '/api/roles', { name: reserved }, { token: admin.token });
                expectCode(last, '9996');
            }
            return last;
        }
        case 13: return api('post', '/api/roles', { name, parent_role_id: 999999 }, { token: admin.token });
        case 14: {
            const responses = await Promise.all(Array.from({ length: 5 }, () =>
                api('post', '/api/roles', { name }, { token: admin.token })
            ));
            expect(responses.filter(item => String(item.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(item => String(item.body?.code) === '9996')).toHaveLength(4);
            expect(responses.some(item => item.status >= 500)).toBe(false);
            return responses.find(item => String(item.body?.code) === OK);
        }
        case 15:
            return api('post', '/api/roles', '{name:', {
                token: admin.token, contentType: 'application/json'
            });
        case 16: return authCase('missing', 'post', '/api/roles', { name }, admin);
        case 17: return authCase('invalid', 'post', '/api/roles', { name }, admin);
        case 18: return authCase('expired', 'post', '/api/roles', { name }, admin);
        case 19: return authCase('logout', 'post', '/api/roles', { name }, admin);
        case 20: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('post', '/api/roles', { name }, { token: auth.body.data.token });
        }
        case 21: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return api('post', '/api/roles', { name }, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown set-role case ${number}`);
    }
}

async function runGetListRoles(number) {
    switch (number) {
        case 1: {
            const response = await listRoles();
            expect(Array.isArray(response.body?.data)).toBe(true);
            for (const role of response.body.data) {
                for (const key of ['id', 'name']) expect(role).toHaveProperty(key);
                expect(role).toHaveProperty('description');
                expect(role).toHaveProperty('parent_role_id');
            }
            return response;
        }
        case 2: {
            const response = await listRoles();
            const names = response.body.data.map(item => item.name);
            for (const expected of ['admin', 'doctor', 'patient']) expect(names).toContain(expected);
            return response;
        }
        case 3: {
            const role = await createRole();
            expectCode(role.response, OK);
            const list = await listRoles();
            expect(list.body.data.some(item => item.name === role.name)).toBe(true);
            return list;
        }
        case 4: {
            const response = await listRoles();
            const ids = response.body.data.map(item => Number(item.id));
            expect(new Set(ids).size).toBe(ids.length);
            return response;
        }
        case 5: {
            const created = [];
            for (let i = 0; i < 6; i += 1) {
                const role = await createRole();
                expectCode(role.response, OK);
                created.push(role.name);
            }
            const first = await listRoles();
            const withPagination = await api('get', '/api/roles?page=1&limit=1', undefined, { token: admin.token });
            expect(withPagination.body.data).toEqual(first.body.data);
            return first;
        }
        case 6: return authCase('missing', 'get', '/api/roles', undefined, admin);
        case 7: return authCase('invalid', 'get', '/api/roles', undefined, admin);
        case 8: return authCase('expired', 'get', '/api/roles', undefined, admin);
        case 9: return authCase('logout', 'get', '/api/roles', undefined, admin);
        case 10: {
            const patient = await registerUser();
            const auth = await login(patient);
            return listRoles(auth.body.data.token);
        }
        case 11: {
            const doctor = await createStaffUser();
            const auth = await login(doctor);
            return listRoles(auth.body.data.token);
        }
        default: throw new Error(`Unknown get-list-roles case ${number}`);
    }
}
