const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    SPM: `01|1000|create permission with name only
02|1000|create permission with description
03|1000|permission appears in list
04|1002|missing required name
05|1003|permission field types
06|1004|whitespace permission name
07|1004|permission name format
08|1004|permission name and description length
09|9996|duplicate permission name
10|1004|uppercase duplicate format validation
11|1004|XSS rejected and SQL-like description preserved
12|1000|concurrent duplicate permission creation
13|1003|malformed JSON
14|9998|missing authorization
15|9998|invalid authorization formats
16|9998|expired token
17|9998|logged-out token
18|1009|patient forbidden
19|1009|doctor forbidden
`,
    GLP: `01|1000|permission list response shape
02|1000|new permission appears in list
03|1000|permission timestamps are valid and ordered
04|1000|permission ids and names are unique
05|1000|deleted permission is absent
06|9998|missing authorization
07|9998|invalid authorization formats
08|9998|expired token
09|9998|logged-out token
10|1009|patient forbidden
11|1009|doctor forbidden
`,
    EPM: `01|1000|change permission name
02|1000|change permission description
03|1000|change name and description
04|1000|updated timestamp changes only
05|1000|renamed permission appears in role permission view
06|1000|same permission name is accepted
07|1002|empty permission update
08|1003|permission field types
09|1004|empty permission name
10|9996|name used by another permission
11|1003|invalid path ids
12|1004|out-of-range path ids
13|9992|unknown permission id
14|1003|malformed JSON
15|9998|missing authorization
16|9998|invalid authorization formats
17|9998|expired token
18|9998|logged-out token
19|1009|patient forbidden
20|1009|doctor forbidden
`,
    DPM: `01|1000|delete unassigned permission
02|1000|deleted permission disappears from list
03|9992|delete same permission twice
04|1000|delete assigned permission cascades links
05|1003|invalid path ids
06|1004|out-of-range path ids
07|9992|unknown permission id
08|9998|missing authorization
09|9998|invalid authorization formats
10|9998|expired token
11|9998|logged-out token
12|1009|patient forbidden
13|1009|doctor forbidden
`,
    SRP: `01|1000|assign multiple permissions
02|1000|assign one permission
03|1000|assigned permissions appear in role view
04|1002|required assignment fields
05|1004|empty permissions array
06|1003|role id type
07|1003|permissions container type
08|1003|permission id element types
09|1004|non-positive assignment ids
10|9992|unknown role id
11|9992|unknown permission id
12|9992|all-or-nothing validation
13|1000|repeated assignments are idempotent
14|1000|duplicate ids are deduplicated
15|1004|maximum assignment array size
16|1003|malformed JSON
17|9998|missing authorization
18|9998|invalid authorization formats
19|9998|expired token
20|9998|logged-out token
21|1009|patient forbidden
22|1009|doctor forbidden
`,
    GRP: `01|1000|assigned role permission fields
02|1000|new role starts with empty permission list
03|1000|revoked permission disappears
04|1000|permissions stay isolated between roles
05|1003|invalid role path ids
06|1004|out-of-range role path ids
07|9992|unknown role
08|9998|missing authorization
09|9998|invalid authorization formats
10|9998|expired token
11|9998|logged-out token
12|1009|patient forbidden
13|1009|doctor forbidden
`,
    DRP: `01|1000|revoke assigned role permission
02|1000|only selected permission is revoked
03|9992|unassigned permission cannot be revoked
04|9992|second revoke is not found
05|1003|invalid assignment path ids
06|1004|out-of-range assignment path ids
07|9992|unknown role
08|9992|unknown permission
09|1009|admin permissions are protected
10|9998|missing authorization
11|9998|invalid authorization formats
12|9998|expired token
13|9998|logged-out token
14|1009|patient forbidden
15|1009|doctor forbidden
`,
    SBR: `01|1000|create branch with required fields
02|1000|branch appears in list and detail
03|1002|required branch fields omitted
04|1002|empty branch body
05|1003|branch field types
06|1004|invalid mobile phone formats
07|1000|landline branch phone
08|1004|whitespace branch name or address
09|1004|branch field length limits
10|9996|duplicate branch name
11|1004|XSS rejected and SQL-like address preserved
12|1003|malformed JSON
13|9998|missing authorization
14|9998|invalid authorization formats
15|9998|expired token
16|9998|logged-out token
17|1009|patient forbidden
18|1009|doctor forbidden
`,
    GLB: `01|1000|branch list response fields
02|1000|any authenticated role can list branches
03|1000|new branch appears in list
04|1000|deleted branch is absent
05|9998|missing authorization
06|9998|invalid authorization formats
07|9998|expired token
08|9998|logged-out token
`,
    GBD: `01|1000|branch detail fields
02|1000|any authenticated role can read branch detail
03|1000|detail reflects branch update
04|1003|invalid branch path ids
05|1004|out-of-range branch path ids
06|9992|unknown branch
07|9992|deleted branch
08|9998|missing authorization
09|9998|invalid authorization formats
10|9998|expired token
11|9998|logged-out token
`,
    EBR: `01|1000|change branch name
02|1000|change branch address
03|1000|change branch phone
04|1000|change all branch fields
05|1000|branch timestamps after update
06|1000|same branch values accepted
07|1002|empty branch update
08|1003|branch field types
09|1004|invalid branch phone
10|1004|empty branch name or address
11|9996|branch name used by another branch
12|1003|invalid branch path ids
13|1004|out-of-range branch path ids
14|9992|unknown branch
15|9992|deleted branch
16|1000|branch id and created timestamp mass assignment ignored
17|1003|malformed JSON
18|9998|missing authorization
19|9998|invalid authorization formats
20|9998|expired token
21|9998|logged-out token
22|1009|patient forbidden
23|1009|doctor forbidden
`,
    DBR: `01|1000|delete branch without dependencies
02|9992|deleted branch detail and list
03|9992|delete branch twice
04|1009|branch with department cannot be deleted
05|1009|branch with active staff cannot be deleted
06|1003|invalid branch path ids
07|1004|out-of-range branch path ids
08|9992|unknown branch
09|9998|missing authorization
10|9998|invalid authorization formats
11|9998|expired token
12|9998|logged-out token
13|1009|patient forbidden
14|1009|doctor forbidden`
};

function parseCases(prefix, text) {
    return text.trim().split('\n').map(line => {
        const [number, expected, title] = line.trim().split('|');
        return { id: `W3-${prefix}-${number}`, expected, title };
    });
}

const groups = Object.entries(catalog).map(([prefix, text]) => ({
    prefix,
    cases: parseCases(prefix, text)
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 187 || new Set(allCases.map(item => item.id)).size !== 187) {
    throw new Error(`Week 3 workbook coverage must contain exactly 187 unique cases; found ${allCases.length}.`);
}

let roles;
let admin;
const casePhones = new Set();
const suitePhones = new Set();
const permissionIds = new Set();
const branchIds = new Set();
const roleIds = new Set();

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') throw new Error(`The target adapter must implement ${name}().`);
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({ ...values, expectedDatabaseName: config.databaseName });
}

function phone() {
    return `09${crypto.randomInt(10000000, 100000000)}`;
}

function password() {
    return `Mayday-${crypto.randomBytes(12).toString('hex')}`;
}

function uniqueName(prefix = 'qa') {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function trackPhone(value, suite = false) {
    if (typeof value !== 'string' || !/^\d{10}$/.test(value)) return;
    (suite ? suitePhones : casePhones).add(value);
}

function expectCode(response, expected) {
    expect(String(response?.body?.code)).toBe(String(expected));
}

async function api(method, endpoint, body, {
    token,
    authorization,
    contentType,
    trackSuite = false
} = {}) {
    if (endpoint === '/api/auth/signup' && body?.phone) trackPhone(body.phone, trackSuite);
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (contentType) call = call.set('Content-Type', contentType);
    if (body !== undefined) call = call.send(body);
    const response = await call;
    const id = response.body?.data?.id;
    if (Number.isInteger(id)) {
        if (method.toLowerCase() === 'post' && endpoint === '/api/permissions') permissionIds.add(id);
        if (method.toLowerCase() === 'post' && endpoint === '/api/branches') branchIds.add(id);
        if (method.toLowerCase() === 'post' && endpoint === '/api/roles') roleIds.add(id);
    }
    return response;
}

async function registerUser({ name = 'Mayday Week 3 User', phoneNumber = phone(), suite = false } = {}) {
    trackPhone(phoneNumber, suite);
    const account = { full_name: name, phone: phoneNumber, password: password() };
    const response = await api('post', '/api/auth/signup', account, { trackSuite: suite });
    expectCode(response, OK);
    account.response = response;
    return account;
}

function userId(account) {
    const id = Number(account?.response?.body?.data?.user_id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Signup did not return data.user_id.');
    return id;
}

async function login(account) {
    return api('post', '/api/auth/login', {
        phone: account.phone,
        password: account.password
    });
}

async function createStaff(roleId = roles.doctor) {
    const fixture = await adapterCall('prepareStaffFixture');
    const data = {
        full_name: 'Week 3 Test Staff',
        phone: phone(),
        password: password(),
        role_id: roleId,
        branch_id: fixture.branch_id,
        department_id: fixture.department_id,
        room_id: fixture.room_id
    };
    trackPhone(data.phone);
    const response = await api('post', '/api/auth/create-staff', data, { token: admin.token });
    expectCode(response, OK);
    return { ...data, response };
}

async function permission(body = {}) {
    const data = { name: uniqueName(), ...body };
    const response = await api('post', '/api/permissions', data, { token: admin.token });
    if (Number.isInteger(response.body?.data?.id)) permissionIds.add(response.body.data.id);
    return { ...data, response, id: response.body?.data?.id };
}

async function role(name = uniqueName('qa_role')) {
    const response = await api('post', '/api/roles', { name }, { token: admin.token });
    if (Number.isInteger(response.body?.data?.id)) roleIds.add(response.body.data.id);
    return { name, response, id: response.body?.data?.id };
}

async function branch(body = {}) {
    const data = {
        name: uniqueName('Clinic'),
        address: 'Test address',
        phone: phone(),
        ...body
    };
    const response = await api('post', '/api/branches', data, { token: admin.token });
    if (Number.isInteger(response.body?.data?.id)) branchIds.add(response.body.data.id);
    return { ...data, response, id: response.body?.data?.id };
}

async function authCase(kind, method, endpoint, body, account) {
    if (kind === 'missing') return api(method, endpoint, body);
    if (kind === 'invalid') {
        const auth = await login(account);
        const parts = auth.body.data.token.split('.');
        parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
        let last;
        for (const authorization of [
            'Bearer abc', `Bearer ${parts.join('.')}`, auth.body.data.token, 'Bearer '
        ]) {
            last = await api(method, endpoint, body, { authorization });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterMethod('getExpiredToken')({
            phone: account.phone,
            expectedDatabaseName: config.databaseName
        });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error(`Adapter did not return an expired token for ${account.phone}.`);
        return api(method, endpoint, body, { token });
    }
    if (kind === 'logout') {
        const auth = await login(account);
        expectCode(await api('post', '/api/auth/logout', {}, { token: auth.body.data.token }), OK);
        return api(method, endpoint, body, { token: auth.body.data.token });
    }
    throw new Error(`Unknown auth case ${kind}.`);
}

async function cleanupAccounts(set) {
    const errors = [];
    for (const phoneNumber of set) {
        try {
            await adapterMethod('deleteUser')({
                phone: phoneNumber,
                expectedDatabaseName: config.databaseName
            });
            set.delete(phoneNumber);
        } catch (error) {
            errors.push(`${phoneNumber}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
}

async function cleanupCase() {
    const errors = [];
    for (const [label, operation] of [
        ['test hooks', () => adapterCall('resetTestHooks')],
        ['test accounts', () => cleanupAccounts(casePhones)]
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (permissionIds.size || branchIds.size || roleIds.size) {
        try {
            await adapterCall('cleanupWeek3Resources', {
                permissionIds: [...permissionIds],
                branchIds: [...branchIds],
                roleIds: [...roleIds]
            });
            permissionIds.clear();
            branchIds.clear();
            roleIds.clear();
        } catch (error) {
            errors.push(`week 3 resources: ${error.message}`);
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
    admin = await registerUser({ name: 'Mayday Week 3 Test Admin', suite: true });
    const promoted = await adapterCall('promoteUser', { phone: admin.phone, roleId: roles.admin });
    if (Number(promoted?.roleId) !== roles.admin) throw new Error('Adapter failed to promote the suite admin.');
    const auth = await login(admin);
    expectCode(auth, OK);
    admin.token = auth.body.data.token;
});

afterEach(cleanupCase);

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['case cleanup', cleanupCase],
        ['suite account cleanup', () => cleanupAccounts(suitePhones)],
        ['test fixture cleanup', () => adapterCall('cleanupTestFixtures')]
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
});

describe(`Target ${config.targetName} - Week 3`, () => {
    describe.each(groups)('Week 3 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            expectCode(await runCase(id), expected);
        });
    });
});

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    switch (prefix) {
        case 'SPM': return runSetPermission(number);
        case 'GLP': return runGetListPermissions(number);
        case 'EPM': return runEditPermission(number);
        case 'DPM': return runDeletePermission(number);
        case 'SRP': return runSetRolePermissions(number);
        case 'GRP': return runGetRolePermissions(number);
        case 'DRP': return runDeleteRolePermission(number);
        case 'SBR': return runSetBranch(number);
        case 'GLB': return runGetListBranches(number);
        case 'GBD': return runGetBranchDetail(number);
        case 'EBR': return runEditBranch(number);
        case 'DBR': return runDeleteBranch(number);
        default: throw new Error(`Unknown Week 3 case ID ${id}`);
    }
}

async function runSetPermission(number) {
    const name = uniqueName();
    switch (number) {
        case 1: return (await permission({ name })).response;
        case 2: return (await permission({ name, description: 'Integration test permission' })).response;
        case 3: {
            const created = await permission({ name });
            expectCode(created.response, OK);
            const list = await api('get', '/api/permissions', undefined, { token: admin.token });
            expect(list.body.data.some(item => item.name === name)).toBe(true);
            return list;
        }
        case 4: {
            const empty = await api('post', '/api/permissions', {}, { token: admin.token });
            expectCode(empty, '1002');
            return api('post', '/api/permissions', { name: '' }, { token: admin.token });
        }
        case 5: {
            const badName = await api('post', '/api/permissions', { name: 123 }, { token: admin.token });
            expectCode(badName, '1003');
            return api('post', '/api/permissions', { name, description: ['a'] }, { token: admin.token });
        }
        case 6: return api('post', '/api/permissions', { name: '   ' }, { token: admin.token });
        case 7: {
            const space = await api('post', '/api/permissions', { name: 'tạo bệnh án' }, { token: admin.token });
            expectCode(space, '1004');
            const embedded = await api('post', '/api/permissions', { name: 'a b' }, { token: admin.token });
            expectCode(embedded, '1004');
            return api('post', '/api/permissions', { name: 'a-b!' }, { token: admin.token });
        }
        case 8: {
            const longName = await api('post', '/api/permissions', { name: `a${'x'.repeat(255)}` }, { token: admin.token });
            expectCode(longName, '1004');
            return api('post', '/api/permissions', {
                name, description: 'x'.repeat(501)
            }, { token: admin.token });
        }
        case 9: {
            const first = await permission({ name });
            expectCode(first.response, OK);
            return api('post', '/api/permissions', { name }, { token: admin.token });
        }
        case 10: return api('post', '/api/permissions', { name: 'Manage_Users' }, { token: admin.token });
        case 11: {
            const xss = await api('post', '/api/permissions', {
                name, description: '<script>alert(1)</script>'
            }, { token: admin.token });
            expectCode(xss, '1004');
            const plain = "x'; DROP TABLE permissions;--";
            const safe = await permission({ name: uniqueName(), description: plain });
            expect(safe.response.body?.data?.description).toBe(plain);
            return xss;
        }
        case 12: {
            const responses = await Promise.all(Array.from({ length: 5 }, () =>
                api('post', '/api/permissions', { name }, { token: admin.token })
            ));
            const success = responses.filter(item => String(item.body?.code) === OK);
            expect(success).toHaveLength(1);
            expect(responses.filter(item => String(item.body?.code) === '9996')).toHaveLength(4);
            expect(responses.some(item => item.status >= 500)).toBe(false);
            if (Number.isInteger(success[0].body?.data?.id)) permissionIds.add(success[0].body.data.id);
            return success[0];
        }
        case 13:
            return api('post', '/api/permissions', '{name:', {
                token: admin.token, contentType: 'application/json'
            });
        case 14: return authCase('missing', 'post', '/api/permissions', { name }, admin);
        case 15: return authCase('invalid', 'post', '/api/permissions', { name }, admin);
        case 16: return authCase('expired', 'post', '/api/permissions', { name }, admin);
        case 17: return authCase('logout', 'post', '/api/permissions', { name }, admin);
        case 18: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('post', '/api/permissions', { name }, { token: auth.body.data.token });
        }
        case 19: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('post', '/api/permissions', { name }, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown set-permission case ${number}`);
    }
}

async function runGetListPermissions(number) {
    switch (number) {
        case 1: {
            const response = await api('get', '/api/permissions', undefined, { token: admin.token });
            expect(Array.isArray(response.body?.data)).toBe(true);
            for (const item of response.body.data) {
                for (const key of ['id', 'name', 'created_at', 'updated_at']) expect(item).toHaveProperty(key);
                expect(Number.isNaN(Date.parse(item.created_at))).toBe(false);
                expect(Number.isNaN(Date.parse(item.updated_at))).toBe(false);
            }
            return response;
        }
        case 2: {
            const created = await permission();
            expectCode(created.response, OK);
            const list = await api('get', '/api/permissions', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(created.id))).toBe(true);
            return list;
        }
        case 3: {
            const response = await api('get', '/api/permissions', undefined, { token: admin.token });
            for (const item of response.body.data) {
                expect(Date.parse(item.created_at)).toBeLessThanOrEqual(Date.parse(item.updated_at));
            }
            return response;
        }
        case 4: {
            const response = await api('get', '/api/permissions', undefined, { token: admin.token });
            const ids = response.body.data.map(item => item.id);
            const names = response.body.data.map(item => item.name);
            expect(new Set(ids).size).toBe(ids.length);
            expect(new Set(names.map(item => item.toLowerCase())).size).toBe(names.length);
            return response;
        }
        case 5: {
            const created = await permission();
            expectCode(created.response, OK);
            expectCode(await api('delete', `/api/permissions/${created.id}`, undefined, { token: admin.token }), OK);
            const list = await api('get', '/api/permissions', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(created.id))).toBe(false);
            return list;
        }
        case 6: return authCase('missing', 'get', '/api/permissions', undefined, admin);
        case 7: return authCase('invalid', 'get', '/api/permissions', undefined, admin);
        case 8: return authCase('expired', 'get', '/api/permissions', undefined, admin);
        case 9: return authCase('logout', 'get', '/api/permissions', undefined, admin);
        case 10: {
            const user = await registerUser();
            const auth = await login(user);
            return api('get', '/api/permissions', undefined, { token: auth.body.data.token });
        }
        case 11: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('get', '/api/permissions', undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown get-list-permissions case ${number}`);
    }
}

async function runEditPermission(number) {
    const created = await permission();
    const id = created.id;
    switch (number) {
        case 1: return api('put', `/api/permissions/${id}`, { name: uniqueName('manage') }, { token: admin.token });
        case 2: return api('put', `/api/permissions/${id}`, { description: 'Updated permission description' }, { token: admin.token });
        case 3: return api('put', `/api/permissions/${id}`, {
            name: uniqueName('manage'), description: 'Updated both fields'
        }, { token: admin.token });
        case 4: {
            const before = created.response.body.data;
            await new Promise(resolve => setTimeout(resolve, 1100));
            const response = await api('put', `/api/permissions/${id}`, { description: 'Timestamp update' }, { token: admin.token });
            expect(response.body?.data?.created_at).toBe(before.created_at);
            expect(Date.parse(response.body?.data?.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
            return response;
        }
        case 5: {
            const customRole = await role();
            const assigned = await api('post', '/api/role_permissions', {
                role_id: customRole.id, permissions: [id]
            }, { token: admin.token });
            expectCode(assigned, OK);
            const name = uniqueName('renamed');
            const update = await api('put', `/api/permissions/${id}`, { name }, { token: admin.token });
            expectCode(update, OK);
            const list = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(list.body.data.some(item => item.name === name)).toBe(true);
            return update;
        }
        case 6: return api('put', `/api/permissions/${id}`, { name: created.name }, { token: admin.token });
        case 7: return api('put', `/api/permissions/${id}`, {}, { token: admin.token });
        case 8: {
            const badName = await api('put', `/api/permissions/${id}`, { name: 123 }, { token: admin.token });
            expectCode(badName, '1003');
            return api('put', `/api/permissions/${id}`, { description: ['a'] }, { token: admin.token });
        }
        case 9: {
            const empty = await api('put', `/api/permissions/${id}`, { name: '' }, { token: admin.token });
            expectCode(empty, '1004');
            return api('put', `/api/permissions/${id}`, { name: '   ' }, { token: admin.token });
        }
        case 10: {
            const other = await permission();
            expectCode(other.response, OK);
            return api('put', `/api/permissions/${id}`, { name: other.name }, { token: admin.token });
        }
        case 11: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('put', `/api/permissions/${encodeURIComponent(badId)}`, { name: uniqueName() }, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 12: {
            const zero = await api('put', '/api/permissions/0', { name: uniqueName() }, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('put', '/api/permissions/-1', { name: uniqueName() }, { token: admin.token });
            expectCode(negative, '1004');
            return api('put', '/api/permissions/99999999999999999999', { name: uniqueName() }, { token: admin.token });
        }
        case 13: {
            expectCode(await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token }), OK);
            return api('put', `/api/permissions/${id}`, { name: uniqueName() }, { token: admin.token });
        }
        case 14: return api('put', `/api/permissions/${id}`, '{name:', {
            token: admin.token, contentType: 'application/json'
        });
        case 15: return authCase('missing', 'put', `/api/permissions/${id}`, { name: uniqueName() }, admin);
        case 16: return authCase('invalid', 'put', `/api/permissions/${id}`, { name: uniqueName() }, admin);
        case 17: return authCase('expired', 'put', `/api/permissions/${id}`, { name: uniqueName() }, admin);
        case 18: return authCase('logout', 'put', `/api/permissions/${id}`, { name: uniqueName() }, admin);
        case 19: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('put', `/api/permissions/${id}`, { name: uniqueName() }, { token: auth.body.data.token });
        }
        case 20: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('put', `/api/permissions/${id}`, { name: uniqueName() }, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown edit-permission case ${number}`);
    }
}

async function runDeletePermission(number) {
    const created = await permission();
    const id = created.id;
    switch (number) {
        case 1: {
            const response = await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token });
            expect(response.body?.data).toEqual({});
            return response;
        }
        case 2: {
            expectCode(await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token }), OK);
            const list = await api('get', '/api/permissions', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(id))).toBe(false);
            return list;
        }
        case 3: {
            expectCode(await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token }), OK);
            return api('delete', `/api/permissions/${id}`, undefined, { token: admin.token });
        }
        case 4: {
            const customRole = await role();
            expectCode(await api('post', '/api/role_permissions', {
                role_id: customRole.id, permissions: [id]
            }, { token: admin.token }), OK);
            const deleted = await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token });
            expectCode(deleted, OK);
            const list = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(list.body.data).toEqual([]);
            return deleted;
        }
        case 5: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('delete', `/api/permissions/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 6: {
            const zero = await api('delete', '/api/permissions/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('delete', '/api/permissions/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('delete', '/api/permissions/99999999999999999999', undefined, { token: admin.token });
        }
        case 7: {
            expectCode(await api('delete', `/api/permissions/${id}`, undefined, { token: admin.token }), OK);
            return api('delete', `/api/permissions/${id}`, undefined, { token: admin.token });
        }
        case 8: return authCase('missing', 'delete', `/api/permissions/${id}`, undefined, admin);
        case 9: return authCase('invalid', 'delete', `/api/permissions/${id}`, undefined, admin);
        case 10: return authCase('expired', 'delete', `/api/permissions/${id}`, undefined, admin);
        case 11: return authCase('logout', 'delete', `/api/permissions/${id}`, undefined, admin);
        case 12: {
            const user = await registerUser();
            const auth = await login(user);
            return api('delete', `/api/permissions/${id}`, undefined, { token: auth.body.data.token });
        }
        case 13: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('delete', `/api/permissions/${id}`, undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown delete-permission case ${number}`);
    }
}

async function runSetRolePermissions(number) {
    const customRole = await role();
    const first = await permission();
    const second = await permission();
    const third = await permission();
    const route = '/api/role_permissions';
    switch (number) {
        case 1: return api('post', route, {
            role_id: customRole.id, permissions: [first.id, second.id, third.id]
        }, { token: admin.token });
        case 2: return api('post', route, {
            role_id: customRole.id, permissions: [first.id]
        }, { token: admin.token });
        case 3: {
            const assigned = await api('post', route, {
                role_id: customRole.id, permissions: [first.id, second.id]
            }, { token: admin.token });
            expectCode(assigned, OK);
            const list = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(list.body.data.map(item => Number(item.permission_id))).toEqual(
                expect.arrayContaining([first.id, second.id])
            );
            expect(list.body.data.every(item => item.assigned_at)).toBe(true);
            return assigned;
        }
        case 4: {
            const missingRole = await api('post', route, { permissions: [first.id] }, { token: admin.token });
            expectCode(missingRole, '1002');
            return api('post', route, { role_id: customRole.id }, { token: admin.token });
        }
        case 5: return api('post', route, { role_id: customRole.id, permissions: [] }, { token: admin.token });
        case 6: {
            const text = await api('post', route, { role_id: 'abc', permissions: [first.id] }, { token: admin.token });
            expectCode(text, '1003');
            return api('post', route, { role_id: 1.5, permissions: [first.id] }, { token: admin.token });
        }
        case 7: {
            const numberValue = await api('post', route, { role_id: customRole.id, permissions: 1 }, { token: admin.token });
            expectCode(numberValue, '1003');
            const textValue = await api('post', route, { role_id: customRole.id, permissions: 'abc' }, { token: admin.token });
            expectCode(textValue, '1003');
            return api('post', route, { role_id: customRole.id, permissions: { a: 1 } }, { token: admin.token });
        }
        case 8: {
            let last;
            for (const permissions of [['a'], [null], [1.5], [[1]]]) {
                last = await api('post', route, { role_id: customRole.id, permissions }, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 9: {
            const zeroRole = await api('post', route, { role_id: 0, permissions: [first.id] }, { token: admin.token });
            expectCode(zeroRole, '1004');
            const zeroPermission = await api('post', route, { role_id: customRole.id, permissions: [0] }, { token: admin.token });
            expectCode(zeroPermission, '1004');
            return api('post', route, { role_id: customRole.id, permissions: [-1] }, { token: admin.token });
        }
        case 10: return api('post', route, { role_id: 999999, permissions: [first.id] }, { token: admin.token });
        case 11: return api('post', route, { role_id: customRole.id, permissions: [999999] }, { token: admin.token });
        case 12: {
            const response = await api('post', route, {
                role_id: customRole.id, permissions: [first.id, 999999]
            }, { token: admin.token });
            expectCode(response, '9992');
            const list = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(list.body.data).toEqual([]);
            return response;
        }
        case 13: {
            const body = { role_id: customRole.id, permissions: [first.id, second.id] };
            const firstAssign = await api('post', route, body, { token: admin.token });
            expectCode(firstAssign, OK);
            return api('post', route, body, { token: admin.token });
        }
        case 14: return api('post', route, {
            role_id: customRole.id, permissions: [first.id, first.id, second.id]
        }, { token: admin.token });
        case 15: return api('post', route, {
            role_id: customRole.id, permissions: Array.from({ length: 101 }, (_, index) => index + 1)
        }, { token: admin.token });
        case 16: return api('post', route, '{role_id:', {
            token: admin.token, contentType: 'application/json'
        });
        case 17: return authCase('missing', 'post', route, { role_id: customRole.id, permissions: [first.id] }, admin);
        case 18: return authCase('invalid', 'post', route, { role_id: customRole.id, permissions: [first.id] }, admin);
        case 19: return authCase('expired', 'post', route, { role_id: customRole.id, permissions: [first.id] }, admin);
        case 20: return authCase('logout', 'post', route, { role_id: customRole.id, permissions: [first.id] }, admin);
        case 21: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('post', route, { role_id: customRole.id, permissions: [first.id] }, { token: auth.body.data.token });
        }
        case 22: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('post', route, { role_id: customRole.id, permissions: [first.id] }, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown set-role-permissions case ${number}`);
    }
}

async function runGetRolePermissions(number) {
    const customRole = await role();
    const first = await permission();
    const second = await permission();
    switch (number) {
        case 1: {
            expectCode(await api('post', '/api/role_permissions', {
                role_id: customRole.id, permissions: [first.id]
            }, { token: admin.token }), OK);
            const response = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(response.body.data).toEqual(expect.arrayContaining([
                expect.objectContaining({ permission_id: first.id, name: first.name })
            ]));
            expect(response.body.data[0]).toHaveProperty('role_permission_id');
            expect(response.body.data[0]).toHaveProperty('assigned_at');
            return response;
        }
        case 2: {
            const response = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(response.body.data).toEqual([]);
            return response;
        }
        case 3: {
            expectCode(await api('post', '/api/role_permissions', {
                role_id: customRole.id, permissions: [first.id]
            }, { token: admin.token }), OK);
            expectCode(await api('delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, { token: admin.token }), OK);
            const response = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(response.body.data).toEqual([]);
            return response;
        }
        case 4: {
            expectCode(await api('post', '/api/role_permissions', {
                role_id: customRole.id, permissions: [first.id]
            }, { token: admin.token }), OK);
            const other = await role();
            expectCode(await api('post', '/api/role_permissions', {
                role_id: other.id, permissions: [second.id]
            }, { token: admin.token }), OK);
            const response = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(response.body.data.map(item => item.name)).toEqual([first.name]);
            return response;
        }
        case 5: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('get', `/api/role_permissions/role/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 6: {
            const zero = await api('get', '/api/role_permissions/role/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('get', '/api/role_permissions/role/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('get', '/api/role_permissions/role/99999999999999999999', undefined, { token: admin.token });
        }
        case 7: return api('get', '/api/role_permissions/role/999999', undefined, { token: admin.token });
        case 8: return authCase('missing', 'get', `/api/role_permissions/role/${customRole.id}`, undefined, admin);
        case 9: return authCase('invalid', 'get', `/api/role_permissions/role/${customRole.id}`, undefined, admin);
        case 10: return authCase('expired', 'get', `/api/role_permissions/role/${customRole.id}`, undefined, admin);
        case 11: return authCase('logout', 'get', `/api/role_permissions/role/${customRole.id}`, undefined, admin);
        case 12: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: auth.body.data.token });
        }
        case 13: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown get-role-permissions case ${number}`);
    }
}

async function runDeleteRolePermission(number) {
    const customRole = await role();
    const first = await permission();
    const second = await permission();
    const third = await permission();
    const assign = ids => api('post', '/api/role_permissions', {
        role_id: customRole.id, permissions: ids
    }, { token: admin.token });
    const remove = (roleId, permissionId) => api('delete',
        `/api/role_permissions/role/${roleId}/permission/${permissionId}`, undefined, { token: admin.token });
    switch (number) {
        case 1: {
            expectCode(await assign([first.id]), OK);
            const response = await remove(customRole.id, first.id);
            expect(response.body?.data).toEqual({});
            return response;
        }
        case 2: {
            expectCode(await assign([first.id, second.id, third.id]), OK);
            const removed = await remove(customRole.id, second.id);
            expectCode(removed, OK);
            const list = await api('get', `/api/role_permissions/role/${customRole.id}`, undefined, { token: admin.token });
            expect(list.body.data.map(item => item.permission_id)).toEqual(expect.arrayContaining([first.id, third.id]));
            expect(list.body.data.some(item => item.permission_id === second.id)).toBe(false);
            return removed;
        }
        case 3: {
            const other = await role();
            expectCode(await assign([first.id]), OK);
            return remove(other.id, second.id);
        }
        case 4: {
            expectCode(await assign([first.id]), OK);
            expectCode(await remove(customRole.id, first.id), OK);
            return remove(customRole.id, first.id);
        }
        case 5: {
            const badRole = await remove('abc', first.id);
            expectCode(badRole, '1003');
            const badPermission = await remove(customRole.id, '1.5');
            expectCode(badPermission, '1003');
            return remove('1;DROP TABLE users', first.id);
        }
        case 6: {
            const zero = await remove(0, first.id);
            expectCode(zero, '1004');
            const negative = await remove(customRole.id, -1);
            expectCode(negative, '1004');
            return remove(customRole.id, 0);
        }
        case 7: return remove(999999, first.id);
        case 8: return remove(customRole.id, 999999);
        case 9: {
            const response = await api('get', '/api/role_permissions/role/1', undefined, { token: admin.token });
            const permissionId = response.body?.data?.[0]?.permission_id;
            if (!Number.isInteger(permissionId)) {
                throw new Error('Week 3 fixture requires at least one permission assigned to the admin role.');
            }
            const deleted = await remove(roles.admin, permissionId);
            const current = await api('get', `/api/role_permissions/role/${roles.admin}`, undefined, { token: admin.token });
            expectCode(current, OK);
            const remainsAssigned = current.body.data.some(item =>
                Number(item.permission_id) === permissionId);
            if (!remainsAssigned) {
                await adapterCall('restoreRolePermission', {
                    roleId: roles.admin,
                    permissionId
                });
            }
            return deleted;
        }
        case 10: return authCase('missing', 'delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, admin);
        case 11: return authCase('invalid', 'delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, admin);
        case 12: return authCase('expired', 'delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, admin);
        case 13: return authCase('logout', 'delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, admin);
        case 14: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, { token: auth.body.data.token });
        }
        case 15: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('delete', `/api/role_permissions/role/${customRole.id}/permission/${first.id}`, undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown delete-role-permission case ${number}`);
    }
}

async function runSetBranch(number) {
    const payload = { name: uniqueName('Clinic'), address: 'Test address', phone: phone() };
    switch (number) {
        case 1: {
            const created = await branch(payload);
            expect(created.response.body?.data).toMatchObject(payload);
            expect(Number.isNaN(Date.parse(created.response.body?.data?.created_at))).toBe(false);
            expect(created.response.body?.data?.updated_at).toBe(created.response.body?.data?.created_at);
            return created.response;
        }
        case 2: {
            const created = await branch(payload);
            expectCode(created.response, OK);
            const detail = await api('get', `/api/branches/${created.id}`, undefined, { token: admin.token });
            expect(detail.body?.data?.name).toBe(payload.name);
            const list = await api('get', '/api/branches', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(created.id))).toBe(true);
            return list;
        }
        case 3: {
            let last;
            for (const key of ['name', 'address', 'phone']) {
                const body = { ...payload };
                delete body[key];
                last = await api('post', '/api/branches', body, { token: admin.token });
                expectCode(last, '1002');
            }
            return last;
        }
        case 4: {
            const empty = await api('post', '/api/branches', {}, { token: admin.token });
            expectCode(empty, '1002');
            return api('post', '/api/branches', null, { token: admin.token });
        }
        case 5: {
            const name = await api('post', '/api/branches', { ...payload, name: 123 }, { token: admin.token });
            expectCode(name, '1003');
            const address = await api('post', '/api/branches', { ...payload, address: ['a'] }, { token: admin.token });
            expectCode(address, '1003');
            return api('post', '/api/branches', { ...payload, phone: 912345678 }, { token: admin.token });
        }
        case 6: {
            let last;
            for (const value of ['abc', '09123', '0112345678']) {
                last = await api('post', '/api/branches', { ...payload, phone: value }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 7: return (await branch({ ...payload, phone: '02438681234' })).response;
        case 8: {
            const name = await api('post', '/api/branches', { ...payload, name: '   ' }, { token: admin.token });
            expectCode(name, '1004');
            return api('post', '/api/branches', { ...payload, address: '   ' }, { token: admin.token });
        }
        case 9: {
            const longName = await api('post', '/api/branches', { ...payload, name: 'x'.repeat(101) }, { token: admin.token });
            expectCode(longName, '1004');
            return api('post', '/api/branches', { ...payload, address: 'x'.repeat(256) }, { token: admin.token });
        }
        case 10: {
            const first = await branch(payload);
            expectCode(first.response, OK);
            return api('post', '/api/branches', { ...payload, phone: phone() }, { token: admin.token });
        }
        case 11: {
            const xss = await api('post', '/api/branches', {
                ...payload, name: '<script>alert(1)</script>'
            }, { token: admin.token });
            expectCode(xss, '1004');
            const address = "x'; DROP TABLE branches;--";
            const safe = await branch({ ...payload, name: uniqueName('clinic'), address });
            expect(safe.response.body?.data?.address).toBe(address);
            return xss;
        }
        case 12: return api('post', '/api/branches', '{name:', {
            token: admin.token, contentType: 'application/json'
        });
        case 13: return authCase('missing', 'post', '/api/branches', payload, admin);
        case 14: return authCase('invalid', 'post', '/api/branches', payload, admin);
        case 15: return authCase('expired', 'post', '/api/branches', payload, admin);
        case 16: return authCase('logout', 'post', '/api/branches', payload, admin);
        case 17: {
            const patient = await registerUser();
            const auth = await login(patient);
            return api('post', '/api/branches', payload, { token: auth.body.data.token });
        }
        case 18: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('post', '/api/branches', payload, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown set-branch case ${number}`);
    }
}

async function runGetListBranches(number) {
    switch (number) {
        case 1: {
            const response = await api('get', '/api/branches', undefined, { token: admin.token });
            expect(Array.isArray(response.body?.data)).toBe(true);
            for (const item of response.body.data) {
                for (const key of ['id', 'name', 'address', 'phone']) expect(item).toHaveProperty(key);
            }
            return response;
        }
        case 2: {
            const patient = await registerUser();
            const patientAuth = await login(patient);
            expectCode(await api('get', '/api/branches', undefined, { token: patientAuth.body.data.token }), OK);
            const doctor = await createStaff();
            const doctorAuth = await login(doctor);
            return api('get', '/api/branches', undefined, { token: doctorAuth.body.data.token });
        }
        case 3: {
            const created = await branch();
            const list = await api('get', '/api/branches', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(created.id))).toBe(true);
            return list;
        }
        case 4: {
            const created = await branch();
            expectCode(await api('delete', `/api/branches/${created.id}`, undefined, { token: admin.token }), OK);
            const list = await api('get', '/api/branches', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(created.id))).toBe(false);
            return list;
        }
        case 5: return authCase('missing', 'get', '/api/branches', undefined, admin);
        case 6: return authCase('invalid', 'get', '/api/branches', undefined, admin);
        case 7: return authCase('expired', 'get', '/api/branches', undefined, admin);
        case 8: return authCase('logout', 'get', '/api/branches', undefined, admin);
        default: throw new Error(`Unknown get-list-branches case ${number}`);
    }
}

async function runGetBranchDetail(number) {
    const created = await branch();
    const id = created.id;
    switch (number) {
        case 1: {
            const response = await api('get', `/api/branches/${id}`, undefined, { token: admin.token });
            for (const key of ['id', 'name', 'address', 'phone', 'created_at', 'updated_at']) {
                expect(response.body?.data).toHaveProperty(key);
            }
            return response;
        }
        case 2: {
            const patient = await registerUser();
            const patientAuth = await login(patient);
            expectCode(await api('get', `/api/branches/${id}`, undefined, { token: patientAuth.body.data.token }), OK);
            const doctor = await createStaff();
            const doctorAuth = await login(doctor);
            return api('get', `/api/branches/${id}`, undefined, { token: doctorAuth.body.data.token });
        }
        case 3: {
            const edit = await api('put', `/api/branches/${id}`, { name: 'Updated Branch' }, { token: admin.token });
            expectCode(edit, OK);
            const detail = await api('get', `/api/branches/${id}`, undefined, { token: admin.token });
            expect(detail.body?.data?.name).toBe('Updated Branch');
            return detail;
        }
        case 4: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('get', `/api/branches/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 5: {
            const zero = await api('get', '/api/branches/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('get', '/api/branches/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('get', '/api/branches/99999999999999999999', undefined, { token: admin.token });
        }
        case 6: return api('get', '/api/branches/999999', undefined, { token: admin.token });
        case 7: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            return api('get', `/api/branches/${id}`, undefined, { token: admin.token });
        }
        case 8: return authCase('missing', 'get', `/api/branches/${id}`, undefined, admin);
        case 9: return authCase('invalid', 'get', `/api/branches/${id}`, undefined, admin);
        case 10: return authCase('expired', 'get', `/api/branches/${id}`, undefined, admin);
        case 11: return authCase('logout', 'get', `/api/branches/${id}`, undefined, admin);
        default: throw new Error(`Unknown get-branch-detail case ${number}`);
    }
}

async function runEditBranch(number) {
    const created = await branch();
    const id = created.id;
    switch (number) {
        case 1: return api('put', `/api/branches/${id}`, { name: uniqueName('updated') }, { token: admin.token });
        case 2: return api('put', `/api/branches/${id}`, { address: 'Updated address' }, { token: admin.token });
        case 3: return api('put', `/api/branches/${id}`, { phone: phone() }, { token: admin.token });
        case 4: return api('put', `/api/branches/${id}`, {
            name: uniqueName('updated'), address: 'Updated address', phone: phone()
        }, { token: admin.token });
        case 5: {
            const before = created.response.body.data;
            await new Promise(resolve => setTimeout(resolve, 1100));
            const response = await api('put', `/api/branches/${id}`, { address: 'Timestamp update' }, { token: admin.token });
            expect(response.body?.data?.created_at).toBe(before.created_at);
            expect(Date.parse(response.body?.data?.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
            return response;
        }
        case 6: return api('put', `/api/branches/${id}`, { name: created.name }, { token: admin.token });
        case 7: return api('put', `/api/branches/${id}`, {}, { token: admin.token });
        case 8: {
            const name = await api('put', `/api/branches/${id}`, { name: 123 }, { token: admin.token });
            expectCode(name, '1003');
            return api('put', `/api/branches/${id}`, { phone: 912345678 }, { token: admin.token });
        }
        case 9: {
            const bad = await api('put', `/api/branches/${id}`, { phone: 'abc' }, { token: admin.token });
            expectCode(bad, '1004');
            return api('put', `/api/branches/${id}`, { phone: '09123' }, { token: admin.token });
        }
        case 10: {
            const name = await api('put', `/api/branches/${id}`, { name: '' }, { token: admin.token });
            expectCode(name, '1004');
            return api('put', `/api/branches/${id}`, { address: '   ' }, { token: admin.token });
        }
        case 11: {
            const other = await branch();
            return api('put', `/api/branches/${id}`, { name: other.name }, { token: admin.token });
        }
        case 12: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('put', `/api/branches/${encodeURIComponent(badId)}`, { name: uniqueName() }, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 13: {
            const zero = await api('put', '/api/branches/0', { name: uniqueName() }, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('put', '/api/branches/-1', { name: uniqueName() }, { token: admin.token });
            expectCode(negative, '1004');
            return api('put', '/api/branches/99999999999999999999', { name: uniqueName() }, { token: admin.token });
        }
        case 14: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            return api('put', `/api/branches/${id}`, { name: uniqueName() }, { token: admin.token });
        }
        case 15: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            return api('put', `/api/branches/${id}`, { name: uniqueName() }, { token: admin.token });
        }
        case 16: {
            const response = await api('put', `/api/branches/${id}`, {
                address: 'Mass assignment test', id: 1, created_at: '2000-01-01T00:00:00Z'
            }, { token: admin.token });
            expect(Number(response.body?.data?.id)).toBe(Number(id));
            expect(response.body?.data?.created_at).toBe(created.response.body.data.created_at);
            return response;
        }
        case 17: return api('put', `/api/branches/${id}`, '{name:', {
            token: admin.token, contentType: 'application/json'
        });
        case 18: return authCase('missing', 'put', `/api/branches/${id}`, { name: uniqueName() }, admin);
        case 19: return authCase('invalid', 'put', `/api/branches/${id}`, { name: uniqueName() }, admin);
        case 20: return authCase('expired', 'put', `/api/branches/${id}`, { name: uniqueName() }, admin);
        case 21: return authCase('logout', 'put', `/api/branches/${id}`, { name: uniqueName() }, admin);
        case 22: {
            const user = await registerUser();
            const auth = await login(user);
            return api('put', `/api/branches/${id}`, { name: uniqueName() }, { token: auth.body.data.token });
        }
        case 23: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('put', `/api/branches/${id}`, { name: uniqueName() }, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown edit-branch case ${number}`);
    }
}

async function prepareBranchDepartment(branchId, withStaff = false) {
    return adapterMethod('prepareBranchDependencies')({
        branchId,
        withStaff,
        expectedDatabaseName: config.databaseName
    });
}

async function runDeleteBranch(number) {
    const created = await branch();
    const id = created.id;
    switch (number) {
        case 1: {
            const response = await api('delete', `/api/branches/${id}`, undefined, { token: admin.token });
            expect(response.body?.data).toEqual({});
            return response;
        }
        case 2: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            const detail = await api('get', `/api/branches/${id}`, undefined, { token: admin.token });
            expectCode(detail, '9992');
            const list = await api('get', '/api/branches', undefined, { token: admin.token });
            expect(list.body.data.some(item => Number(item.id) === Number(id))).toBe(false);
            return detail;
        }
        case 3: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            return api('delete', `/api/branches/${id}`, undefined, { token: admin.token });
        }
        case 4: {
            await prepareBranchDepartment(id);
            return api('delete', `/api/branches/${id}`, undefined, { token: admin.token });
        }
        case 5: {
            const department = await prepareBranchDepartment(id, true);
            const staff = {
                full_name: 'Branch dependency staff',
                phone: phone(),
                password: password(),
                role_id: roles.doctor,
                branch_id: id,
                department_id: department.department_id,
                room_id: department.room_id ?? null
            };
            trackPhone(staff.phone);
            expectCode(await api('post', '/api/auth/create-staff', staff, { token: admin.token }), OK);
            return api('delete', `/api/branches/${id}`, undefined, { token: admin.token });
        }
        case 6: {
            let last;
            for (const badId of ['abc', '1.5', '1;DROP TABLE users']) {
                last = await api('delete', `/api/branches/${encodeURIComponent(badId)}`, undefined, { token: admin.token });
                expectCode(last, '1003');
            }
            return last;
        }
        case 7: {
            const zero = await api('delete', '/api/branches/0', undefined, { token: admin.token });
            expectCode(zero, '1004');
            const negative = await api('delete', '/api/branches/-1', undefined, { token: admin.token });
            expectCode(negative, '1004');
            return api('delete', '/api/branches/99999999999999999999', undefined, { token: admin.token });
        }
        case 8: {
            expectCode(await api('delete', `/api/branches/${id}`, undefined, { token: admin.token }), OK);
            return api('delete', `/api/branches/${id}`, undefined, { token: admin.token });
        }
        case 9: return authCase('missing', 'delete', `/api/branches/${id}`, undefined, admin);
        case 10: return authCase('invalid', 'delete', `/api/branches/${id}`, undefined, admin);
        case 11: return authCase('expired', 'delete', `/api/branches/${id}`, undefined, admin);
        case 12: return authCase('logout', 'delete', `/api/branches/${id}`, undefined, admin);
        case 13: {
            const user = await registerUser();
            const auth = await login(user);
            return api('delete', `/api/branches/${id}`, undefined, { token: auth.body.data.token });
        }
        case 14: {
            const doctor = await createStaff();
            const auth = await login(doctor);
            return api('delete', `/api/branches/${id}`, undefined, { token: auth.body.data.token });
        }
        default: throw new Error(`Unknown delete-branch case ${number}`);
    }
}
