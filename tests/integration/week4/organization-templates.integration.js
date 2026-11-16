const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    DST: `1000,1000,1000,1000,1000,1002,1002,1003,1004,1004,1004,1004,9992,9992,9996,1000,1003,9998,9998,9998,9998,1009,1009`,
    DLS: `1000,1000,1000,1000,1000,1003,1004,9998,9998,9998,9998`,
    DGT: `1000,1000,1000,1003,1004,9992,9992,9998,9998,9998,9998`,
    DED: `1000,1000,1000,1000,1000,1000,1000,1002,1003,1004,1004,9992,9996,9996,1003,1004,9992,9992,1000,1003,9998,9998,9998,9998,1009,1009`,
    DDL: `1000,9992,9992,1000,1000,1003,1004,9992,9998,9998,9998,9998,1009,1009`,
    RST: `1000,1000,1000,1000,1002,1002,1003,1004,1004,1004,1004,9992,9996,1000,1003,9998,9998,9998,9998,1009,1009`,
    RLS: `1000,1000,1000,1000,1000,1003,1004,9998,9998,9998,9998`,
    RGT: `1000,1000,1003,1004,9992,9992,9998,9998,9998,9998`,
    RED: `1000,1000,1000,1000,1000,1002,1003,1004,1004,9992,9996,1003,1004,9992,9992,1000,1003,9998,9998,9998,9998,1009,1009`,
    RDL: `1000,9992,9992,1000,1003,1004,9992,9998,9998,9998,9998,1009,1009`,
    TST: `1000,1000,1000,1000,1002,1002,1003,1004,1004,1004,1004,1004,9996,1000,1003,9998,9998,9998,9998,1009,1009`,
    TLS: `1000,1000,1000,1000,1000,1000,1004,1004,1003,9998,9998,9998,9998`,
    TGT: `1000,1000,1000,1000,1000,1004,9992,9992,9998,9998,9998,9998`,
    TED: `1000,1000,1000,1000,1002,1003,1004,1004,1004,9992,9992,1000,1003,9998,9998,9998,9998,1009,1009`,
    TDL: `1000,9992,9992,9992,1010,1004,9992,9998,9998,9998,9998,1009,1009`
};

const groups = Object.entries(catalog).map(([prefix, codes]) => ({
    prefix,
    cases: codes.split(',').map((expected, index) => ({
        id: `W4-${prefix}-${String(index + 1).padStart(2, '0')}`,
        expected,
        title: `case ${String(index + 1).padStart(2, '0')}`
    }))
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 241 || new Set(allCases.map(item => item.id)).size !== 241) {
    throw new Error(`Week 4 workbook coverage must contain exactly 241 unique cases; found ${allCases.length}.`);
}

const resources = {
    branches: new Set(),
    departments: new Set(),
    rooms: new Set(),
    templates: new Set(),
    dependencies: new Set()
};
const accountPhones = new Set();
let roles;
let admin;
let patient;
let doctor;
let baseBranch;

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') {
        throw new Error(`The target adapter must implement ${name}().`);
    }
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({ ...values, expectedDatabaseName: config.databaseName });
}

function uniqueName(prefix = 'week4') {
    return `${prefix}_${crypto.randomBytes(7).toString('hex')}`;
}

function phone() {
    return `09${crypto.randomInt(10000000, 100000000)}`;
}

function password() {
    return `Mayday-${crypto.randomBytes(12).toString('hex')}`;
}

function expectCode(response, expected) {
    expect(String(response?.body?.code)).toBe(String(expected));
}

function dataOf(response) {
    return response?.body?.data;
}

function itemsOf(response) {
    const data = dataOf(response);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
}

async function api(method, endpoint, body, {
    token,
    authorization,
    contentType
} = {}) {
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (contentType) call = call.set('Content-Type', contentType);
    if (body !== undefined) call = call.send(body);
    const response = await call;
    const data = dataOf(response);
    if (method.toLowerCase() === 'post' && endpoint === '/api/branches' && Number.isInteger(data?.id)) {
        resources.branches.add(data.id);
    }
    if (method.toLowerCase() === 'post' && endpoint === '/api/departments' && Number.isInteger(data?.id)) {
        resources.departments.add(data.id);
    }
    if (method.toLowerCase() === 'post' && endpoint === '/api/rooms' && Number.isInteger(data?.id)) {
        resources.rooms.add(data.id);
    }
    if (method.toLowerCase() === 'post' && endpoint === '/api/templates' &&
        String(response?.body?.code) === OK && body?.code_template) {
        resources.templates.add(body.code_template);
    }
    return response;
}

async function registerAccount(roleName, roleId) {
    const account = {
        full_name: `Mayday Week 4 ${roleName}`,
        phone: phone(),
        password: password()
    };
    accountPhones.add(account.phone);
    const signup = await api('post', '/api/auth/signup', account);
    expectCode(signup, OK);
    const promoted = await adapterCall('promoteUser', { phone: account.phone, roleId });
    if (Number(promoted?.roleId) !== roleId) {
        throw new Error(`Adapter failed to promote the Week 4 ${roleName} account.`);
    }
    const login = await api('post', '/api/auth/login', {
        phone: account.phone,
        password: account.password
    });
    expectCode(login, OK);
    account.token = dataOf(login)?.token;
    if (!account.token) throw new Error(`Week 4 ${roleName} login did not return data.token.`);
    return account;
}

async function createBranch() {
    const body = {
        name: uniqueName('Clinic'),
        address: 'Week 4 integration fixture',
        phone: phone()
    };
    const response = await api('post', '/api/branches', body, { token: admin.token });
    expectCode(response, OK);
    const id = Number(dataOf(response)?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Branch creation did not return a positive data.id.');
    return { ...body, id, response };
}

async function createDepartment(branchId = baseBranch.id, body = {}) {
    const payload = {
        name: uniqueName('Department'),
        description: 'Week 4 department fixture',
        branch_id: branchId,
        ...body
    };
    const response = await api('post', '/api/departments', payload, { token: admin.token });
    expectCode(response, OK);
    const id = Number(dataOf(response)?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Department creation did not return a positive data.id.');
    return { ...payload, id, response };
}

async function createRoom(departmentId, body = {}) {
    const payload = {
        name: uniqueName('Room'),
        description: 'Week 4 room fixture',
        department_id: departmentId,
        ...body
    };
    const response = await api('post', '/api/rooms', payload, { token: admin.token });
    expectCode(response, OK);
    const id = Number(dataOf(response)?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Room creation did not return a positive data.id.');
    return { ...payload, id, response };
}

async function createTemplate(body = {}) {
    const payload = {
        code_template: `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`,
        name: uniqueName('Template'),
        version: '1.0',
        is_active: '1',
        ...body
    };
    const response = await api('post', '/api/templates', payload, { token: admin.token });
    expectCode(response, OK);
    return { ...payload, response };
}

async function cleanupSet(set, method, routeFor) {
    const errors = [];
    for (const value of [...set]) {
        try {
            const response = await api(method, routeFor(value), undefined, { token: admin.token });
            const code = String(response?.body?.code);
            if (![OK, '9992'].includes(code)) {
                throw new Error(`cleanup returned code ${code}`);
            }
            set.delete(value);
        } catch (error) {
            errors.push(`${value}: ${error.message}`);
        }
    }
    return errors;
}

async function cleanupCase() {
    const errors = [];
    if (resources.dependencies.size) {
        try {
            // cleanupWeek4OrganizationDependencies({ fixtureIds, expectedDatabaseName })
            // may remove only the opaque fixture IDs created by this suite's setup hook.
            await adapterCall('cleanupWeek4OrganizationDependencies', {
                fixtureIds: [...resources.dependencies]
            });
            resources.dependencies.clear();
        } catch (error) {
            errors.push(`Week 4 dependency fixtures: ${error.message}`);
        }
    }
    for (const [label, set, method, route] of [
        ['rooms', resources.rooms, 'delete', id => `/api/rooms/${id}`],
        ['departments', resources.departments, 'delete', id => `/api/departments/${id}`],
        ['templates', resources.templates, 'delete', code => `/api/templates/${encodeURIComponent(code)}`],
        ['branches', resources.branches, 'delete', id => `/api/branches/${id}`]
    ]) {
        errors.push(...(await cleanupSet(set, method, route)).map(error => `${label}: ${error}`));
    }
    if (errors.length) throw new Error(errors.join('; '));
}

async function cleanupBaseBranch() {
    if (!baseBranch?.id) return;
    const response = await api('delete', `/api/branches/${baseBranch.id}`, undefined, { token: admin.token });
    if (!['1000', '9992'].includes(String(response?.body?.code))) {
        throw new Error(`Base branch cleanup returned code ${response?.body?.code}.`);
    }
}

async function cleanupAccounts() {
    const errors = [];
    for (const value of [...accountPhones]) {
        try {
            await adapterCall('deleteUser', { phone: value });
            accountPhones.delete(value);
        } catch (error) {
            errors.push(`${value}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
}

async function authCase(kind, method, endpoint, body) {
    if (kind === 'missing') return api(method, endpoint, body);
    if (kind === 'invalid') {
        const login = await api('post', '/api/auth/login', {
            phone: admin.phone,
            password: admin.password
        });
        expectCode(login, OK);
        const parts = dataOf(login).token.split('.');
        parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
        let last;
        for (const authorization of [
            'Bearer abc',
            `Bearer ${parts.join('.')}`,
            dataOf(login).token,
            'Bearer '
        ]) {
            last = await api(method, endpoint, body, { authorization });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterMethod('getExpiredToken')({
            phone: admin.phone,
            expectedDatabaseName: config.databaseName
        });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error('Adapter getExpiredToken() must return a token string or { token }.');
        return api(method, endpoint, body, { token });
    }
    if (kind === 'logout') {
        const login = await api('post', '/api/auth/login', {
            phone: admin.phone,
            password: admin.password
        });
        expectCode(login, OK);
        const token = dataOf(login).token;
        expectCode(await api('post', '/api/auth/logout', {}, { token }), OK);
        return api(method, endpoint, body, { token });
    }
    if (kind === 'patient') return api(method, endpoint, body, { token: patient.token });
    if (kind === 'doctor') return api(method, endpoint, body, { token: doctor.token });
    throw new Error(`Unknown Week 4 authorization case ${kind}.`);
}

const authStart = {
    DST: 18, DLS: 8, DGT: 8, DED: 21, DDL: 9,
    RST: 16, RLS: 8, RGT: 7, RED: 18, RDL: 8,
    TST: 16, TLS: 10, TGT: 9, TED: 14, TDL: 8
};

function authKind(prefix, number) {
    const offset = number - authStart[prefix];
    return ['missing', 'invalid', 'expired', 'logout', 'patient', 'doctor'][offset];
}

function templateBody(code) {
    return {
        code_template: code,
        name: uniqueName('AuthTemplate'),
        version: '1.0',
        is_active: '1'
    };
}

function endpointFor(prefix, number) {
    const methodByPrefix = {
        DST: 'post', DLS: 'get', DGT: 'get', DED: 'put', DDL: 'delete',
        RST: 'post', RLS: 'get', RGT: 'get', RED: 'put', RDL: 'delete',
        TST: 'post', TLS: 'get', TGT: 'get', TED: 'put', TDL: 'delete'
    };
    const method = methodByPrefix[prefix];
    let endpoint;
    let body;
    if (prefix[0] === 'D') {
        endpoint = prefix === 'DLS' ? '/api/departments'
            : prefix === 'DST' ? '/api/departments'
                : `/api/departments/${number >= 15 && number <= 18 ? 999999 : 999999}`;
        body = prefix === 'DST'
            ? { name: uniqueName(), branch_id: baseBranch.id }
            : { name: uniqueName() };
    } else if (prefix[0] === 'R') {
        endpoint = prefix === 'RLS' ? '/api/rooms'
            : prefix === 'RST' ? '/api/rooms'
                : `/api/rooms/${999999}`;
        body = prefix === 'RST'
            ? { name: uniqueName(), department_id: 1 }
            : { name: uniqueName() };
    } else {
        const code = `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
        endpoint = prefix === 'TLS' ? '/api/templates/all'
            : prefix === 'TST' ? '/api/templates'
                : `/api/templates/${code}`;
        body = prefix === 'TST' ? templateBody(code) : { name: uniqueName() };
    }
    if (method === 'get' || method === 'delete') body = undefined;
    return { method, endpoint, body };
}

async function runAuthCase(prefix, number) {
    const { method, endpoint: initialEndpoint, body } = endpointFor(prefix, number);
    let endpoint = initialEndpoint;
    if (method === 'put' || method === 'delete') {
        if (prefix === 'DED' || prefix === 'DDL') {
            const department = await createDepartment();
            endpoint = `/api/departments/${department.id}`;
        } else if (prefix === 'RED' || prefix === 'RDL') {
            const department = await createDepartment();
            const room = await createRoom(department.id);
            endpoint = `/api/rooms/${room.id}`;
        } else if (prefix === 'TED' || prefix === 'TDL') {
            const template = await createTemplate();
            endpoint = `/api/templates/${encodeURIComponent(template.code_template)}`;
        }
    }
    const response = await authCase(authKind(prefix, number), method, endpoint, body);
    expectCode(response, authKind(prefix, number) === 'patient' || authKind(prefix, number) === 'doctor' ? '1009' : '9998');
    return response;
}

function assertEntityShape(data, requiredFields) {
    expect(data).toBeTruthy();
    for (const field of requiredFields) expect(data).toHaveProperty(field);
}

async function deleteMissingEntity(endpoint) {
    const detail = await api('get', endpoint, undefined, { token: admin.token });
    expectCode(detail, '9992');
    return api('delete', endpoint, undefined, { token: admin.token });
}

async function updateMissingEntity(endpoint, body) {
    const detail = await api('get', endpoint, undefined, { token: admin.token });
    expectCode(detail, '9992');
    return api('put', endpoint, body, { token: admin.token });
}

async function departmentCase(prefix, number) {
    const createPrefix = prefix === 'DST';
    const listPrefix = prefix === 'DLS';
    const detailPrefix = prefix === 'DGT';
    const editPrefix = prefix === 'DED';
    const deletePrefix = prefix === 'DDL';
    const isAuth = number >= authStart[prefix];
    if (isAuth) return runAuthCase(prefix, number);

    if (createPrefix) {
        const branch = await createBranch();
        const name = uniqueName('Dept');
        const good = { name, description: 'department description', branch_id: branch.id };
        switch (number) {
            case 1: {
                const res = await api('post', '/api/departments', good, { token: admin.token });
                expectCode(res, OK);
                assertEntityShape(dataOf(res), ['id', 'name', 'branch_id', 'description', 'created_at']);
                expect(dataOf(res).name).toBe(name);
                return res;
            }
            case 2: {
                const res = await api('post', '/api/departments', { name, branch_id: branch.id }, { token: admin.token });
                expectCode(res, OK);
                expect(dataOf(res).description == null).toBe(true);
                return res;
            }
            case 3: {
                const created = await createDepartment(branch.id, { name });
                const list = await api('get', '/api/departments', undefined, { token: admin.token });
                expect(itemsOf(list).some(item => item.id === created.id)).toBe(true);
                const detail = await api('get', `/api/departments/${created.id}`, undefined, { token: admin.token });
                expectCode(detail, OK);
                expect(dataOf(detail).name).toBe(name);
                return list;
            }
            case 4: {
                const other = await createBranch();
                const nameSame = uniqueName('SameDept');
                const a = await api('post', '/api/departments', { name: nameSame, branch_id: branch.id }, { token: admin.token });
                expectCode(a, OK);
                return api('post', '/api/departments', { name: nameSame, branch_id: other.id }, { token: admin.token });
            }
            case 5:
                return api('post', '/api/departments', {
                    ...good,
                    name: 'Khoa Da liễu – Dị ứng'
                }, { token: admin.token });
            case 6: {
                const missingName = await api('post', '/api/departments', { branch_id: branch.id }, { token: admin.token });
                const missingBranch = await api('post', '/api/departments', { name }, { token: admin.token });
                expectCode(missingName, '1002');
                return missingBranch;
            }
            case 7: {
                for (const body of [{}, { name: '' }, { name: null }, { name, branch_id: null }]) {
                    expectCode(await api('post', '/api/departments', body, { token: admin.token }), '1002');
                }
                return api('post', '/api/departments', {}, { token: admin.token });
            }
            case 8: {
                let last;
                for (const body of [
                    { ...good, name: 123 },
                    { ...good, description: 123 },
                    { ...good, branch_id: 'abc' },
                    { ...good, branch_id: 1.5 },
                    { ...good, branch_id: String(branch.id) }
                ]) {
                    last = await api('post', '/api/departments', body, { token: admin.token });
                    expectCode(last, '1003');
                }
                return last;
            }
            case 9: return api('post', '/api/departments', { ...good, name: '   ' }, { token: admin.token });
            case 10: {
                const longName = await api('post', '/api/departments', { ...good, name: 'x'.repeat(101) }, { token: admin.token });
                expectCode(longName, '1004');
                return api('post', '/api/departments', { ...good, description: 'x'.repeat(501) }, { token: admin.token });
            }
            case 11: {
                expectCode(await api('post', '/api/departments', { ...good, branch_id: 0 }, { token: admin.token }), '1004');
                return api('post', '/api/departments', { ...good, branch_id: -1 }, { token: admin.token });
            }
            case 12: {
                const xss = await api('post', '/api/departments', { ...good, name: '<script>alert(1)</script>' }, { token: admin.token });
                expectCode(xss, '1004');
                const description = "O'Reilly; SELECT * FROM departments --";
                const sqlText = await api('post', '/api/departments', { ...good, description }, { token: admin.token });
                expectCode(sqlText, OK);
                expect(dataOf(sqlText).description).toBe(description);
                return xss;
            }
            case 13: return api('post', '/api/departments', { ...good, branch_id: 999999999 }, { token: admin.token });
            case 14: {
                const deletedBranch = await createBranch();
                expectCode(await api('delete', `/api/branches/${deletedBranch.id}`, undefined, { token: admin.token }), OK);
                return api('post', '/api/departments', { ...good, branch_id: deletedBranch.id }, { token: admin.token });
            }
            case 15: {
                const duplicate = uniqueName('DeptDuplicate');
                expectCode(await api('post', '/api/departments', { ...good, name: duplicate }, { token: admin.token }), OK);
                return api('post', '/api/departments', { ...good, name: `  ${duplicate.toUpperCase()} ` }, { token: admin.token });
            }
            case 16: {
                const same = uniqueName('ConcurrentDept');
                const responses = await Promise.all(Array.from({ length: 5 }, () =>
                    api('post', '/api/departments', { ...good, name: same }, { token: admin.token })));
                expect(responses.filter(res => String(res.body?.code) === OK)).toHaveLength(1);
                expect(responses.filter(res => String(res.body?.code) === '9996')).toHaveLength(4);
                return responses.find(res => String(res.body?.code) === OK);
            }
            case 17:
                return api('post', '/api/departments', '{"name":', { token: admin.token, contentType: 'application/json' });
        }
    }

    if (listPrefix) {
        switch (number) {
            case 1: {
                const res = await api('get', '/api/departments', undefined, { token: admin.token });
                expect(Array.isArray(dataOf(res))).toBe(true);
                for (const item of itemsOf(res)) assertEntityShape(item, ['id', 'name', 'branch_id', 'description', 'created_at']);
                return res;
            }
            case 2: {
                const created = await createDepartment();
                const res = await api('get', '/api/departments', undefined, { token: admin.token });
                expect(itemsOf(res).some(item => item.id === created.id)).toBe(true);
                return res;
            }
            case 3: {
                const created = await createDepartment();
                const res = await api('get', `/api/departments?branch_id=${created.branch_id}`, undefined, { token: admin.token });
                expect(itemsOf(res).length).toBeGreaterThan(0);
                expect(itemsOf(res).every(item => Number(item.branch_id) === created.branch_id)).toBe(true);
                return res;
            }
            case 4: {
                const emptyBranch = await createBranch();
                const empty = await api('get', `/api/departments?branch_id=${emptyBranch.id}`, undefined, { token: admin.token });
                expect(itemsOf(empty)).toEqual([]);
                const missing = await api('get', '/api/departments?branch_id=999999999', undefined, { token: admin.token });
                expect(itemsOf(missing)).toEqual([]);
                return missing;
            }
            case 5: {
                for (const token of [patient.token, doctor.token, admin.token]) {
                    expectCode(await api('get', '/api/departments', undefined, { token }), OK);
                }
                return api('get', '/api/departments', undefined, { token: admin.token });
            }
            case 6: {
                let last;
                for (const value of ['abc', '1.5', '1 OR 1=1']) {
                    last = await api('get', `/api/departments?branch_id=${encodeURIComponent(value)}`, undefined, { token: admin.token });
                    expectCode(last, '1003');
                }
                return last;
            }
            case 7: {
                expectCode(await api('get', '/api/departments?branch_id=0', undefined, { token: admin.token }), '1004');
                return api('get', '/api/departments?branch_id=-1', undefined, { token: admin.token });
            }
        }
    }

    if (detailPrefix) {
        if (number === 1 || number === 2 || number === 3) {
            const entity = await createDepartment();
            if (number === 3) {
                const name = uniqueName('EditedDept');
                expectCode(await api('put', `/api/departments/${entity.id}`, { name }, { token: admin.token }), OK);
                const detail = await api('get', `/api/departments/${entity.id}`, undefined, { token: admin.token });
                expect(dataOf(detail).name).toBe(name);
                return detail;
            }
            const token = number === 2 ? patient.token : admin.token;
            const res = await api('get', `/api/departments/${entity.id}`, undefined, { token });
            assertEntityShape(dataOf(res), ['id', 'name', 'description', 'branch_id', 'created_at', 'updated_at']);
            expect(Number.isInteger(dataOf(res).id)).toBe(true);
            expect(Number.isInteger(dataOf(res).branch_id)).toBe(true);
            return res;
        }
        if (number === 4) return tryPaths('get', '/api/departments/', ['abc', '1.5', '1;DROP TABLE users'], undefined);
        if (number === 5) return tryPaths('get', '/api/departments/', ['0', '-1', '99999999999999999999'], undefined);
        if (number === 6) return api('get', '/api/departments/999999', undefined, { token: admin.token });
        if (number === 7) {
            const entity = await createDepartment();
            expectCode(await api('delete', `/api/departments/${entity.id}`, undefined, { token: admin.token }), OK);
            return api('get', `/api/departments/${entity.id}`, undefined, { token: admin.token });
        }
    }

    if (editPrefix) return editDepartment(number);
    if (deletePrefix) return deleteDepartment(number);
    throw new Error(`Unhandled Week 4 department case ${prefix}-${number}.`);
}

async function tryPaths(method, base, paths, body) {
    let last;
    for (const path of paths) {
        last = await api(method, `${base}${encodeURIComponent(path)}`, body, { token: admin.token });
        expectCode(last, path === '0' || path === '-1' || /^\d{11,}$/.test(path) ? '1004' : '1003');
    }
    return last;
}

async function editDepartment(number) {
    if (number >= authStart.DED) return runAuthCase('DED', number);
    if ([15, 16, 17, 18].includes(number)) {
        if (number === 15) return tryPaths('put', '/api/departments/', ['abc', '1.5', '1;DROP TABLE users'], { name: 'Updated' });
        if (number === 16) return tryPaths('put', '/api/departments/', ['0', '-1', '99999999999999999999'], { name: 'Updated' });
        if (number === 17) return updateMissingEntity('/api/departments/999999', { name: 'Updated' });
        const old = await createDepartment();
        expectCode(await api('delete', `/api/departments/${old.id}`, undefined, { token: admin.token }), OK);
        return api('put', `/api/departments/${old.id}`, { name: 'Updated' }, { token: admin.token });
    }
    const original = await createDepartment();
    const path = `/api/departments/${original.id}`;
    const otherBranch = await createBranch();
    const otherDepartment = number === 13 ? await createDepartment(original.branch_id) : null;
    const destinationDepartment = number === 14 ? await createDepartment(otherBranch.id, { name: original.name }) : null;
    const oldDetail = number === 6 ? dataOf(await api('get', path, undefined, { token: admin.token })) : null;
    let body;
    switch (number) {
        case 1: body = { name: uniqueName('RenamedDept') }; break;
        case 2: body = { description: 'updated description' }; break;
        case 3: body = { description: null }; break;
        case 4: body = { branch_id: otherBranch.id }; break;
        case 5: body = { name: uniqueName('NewDept'), branch_id: otherBranch.id, description: 'updated all' }; break;
        case 6: body = { description: 'timestamp update' }; break;
        case 7: body = { name: original.name }; break;
        case 8: return api('put', path, {}, { token: admin.token });
        case 9: {
            expectCode(await api('put', path, { name: 123 }, { token: admin.token }), '1003');
            return api('put', path, { branch_id: 'abc' }, { token: admin.token });
        }
        case 10: {
            let last;
            for (const name of ['', '   ', 'x'.repeat(101), '<b>']) {
                last = await api('put', path, { name }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 11: {
            expectCode(await api('put', path, { branch_id: 0 }, { token: admin.token }), '1004');
            return api('put', path, { branch_id: -1 }, { token: admin.token });
        }
        case 12: return api('put', path, { branch_id: 999999999 }, { token: admin.token });
        case 13: return api('put', path, { name: otherDepartment.name }, { token: admin.token });
        case 14: return api('put', path, { branch_id: destinationDepartment.branch_id }, { token: admin.token });
        case 19: {
            const res = await api('put', path, { name: uniqueName('MassAssigned'), id: 123456, created_at: '2000-01-01' }, { token: admin.token });
            expectCode(res, OK);
            const updated = dataOf(await api('get', path, undefined, { token: admin.token }));
            expect(updated.id).toBe(original.id);
            expect(updated.created_at).toBe(oldDetail.created_at);
            return res;
        }
        case 20: return api('put', path, '{"name":', { token: admin.token, contentType: 'application/json' });
        default: throw new Error(`Unhandled department edit case ${number}.`);
    }
    const res = await api('put', path, body, { token: admin.token });
    if (number <= 7) {
        expectCode(res, OK);
        const current = dataOf(await api('get', path, undefined, { token: admin.token }));
        if (number === 1 || number === 5) expect(current.name).toBe(body.name);
        if (number === 2) expect(current.description).toBe(body.description);
        if (number === 3) expect(current.description).toBeNull();
        if (number === 4) {
            expect(Number(current.branch_id)).toBe(otherBranch.id);
            expect(itemsOf(await api('get', `/api/departments?branch_id=${otherBranch.id}`, undefined, { token: admin.token }))
                .some(item => item.id === original.id)).toBe(true);
            expect(itemsOf(await api('get', `/api/departments?branch_id=${original.branch_id}`, undefined, { token: admin.token }))
                .some(item => item.id === original.id)).toBe(false);
        }
        if (number === 6) {
            expect(current.id).toBe(original.id);
            expect(current.created_at).toBe(oldDetail.created_at);
            expect(new Date(current.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(oldDetail.updated_at).getTime());
        }
    }
    return res;
}

async function deleteDepartment(number) {
    if (number >= authStart.DDL) return runAuthCase('DDL', number);
    if (number >= 6) {
        if (number === 6) return tryPaths('delete', '/api/departments/', ['abc', '1.5', '1;DROP TABLE users'], undefined);
        if (number === 7) return tryPaths('delete', '/api/departments/', ['0', '-1', '99999999999999999999'], undefined);
        if (number === 8) return deleteMissingEntity('/api/departments/999999');
    }
    if (number === 4) {
        const department = await createDepartment();
        const room = await createRoom(department.id);
        const deleted = await api('delete', `/api/departments/${department.id}`, undefined, { token: admin.token });
        expectCode(deleted, OK);
        const detail = await api('get', `/api/rooms/${room.id}`, undefined, { token: admin.token });
        expectCode(detail, OK);
        expect(dataOf(detail).department_id).toBeNull();
        return deleted;
    }
    if (number === 5) {
        const department = await createDepartment();
        const fixture = await prepareDependency('staff_department', { departmentId: department.id });
        const deleted = await api('delete', `/api/departments/${department.id}`, undefined, { token: admin.token });
        expectCode(deleted, OK);
        const staff = await api('get', `/api/admin/users/${fixture.staffId}`, undefined, { token: admin.token });
        expectCode(staff, OK);
        expect(dataOf(staff).department_id).toBeNull();
        return deleted;
    }
    const department = await createDepartment();
    const deleted = await api('delete', `/api/departments/${department.id}`, undefined, { token: admin.token });
    if (number === 1) {
        expect(dataOf(deleted)).toEqual({});
        return deleted;
    }
    if (number === 2) {
        expectCode(await api('get', `/api/departments/${department.id}`, undefined, { token: admin.token }), '9992');
        const list = await api('get', '/api/departments', undefined, { token: admin.token });
        expect(itemsOf(list).some(item => item.id === department.id)).toBe(false);
        return api('get', `/api/departments/${department.id}`, undefined, { token: admin.token });
    }
    if (number === 3) {
        expectCode(deleted, OK);
        return api('delete', `/api/departments/${department.id}`, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled department delete case ${number}.`);
}

async function prepareDependency(kind, values = {}) {
    // Adapter contract: prepareWeek4OrganizationDependency({ kind, departmentId?, roomId?,
    // codeTemplate?, expectedDatabaseName }) returns { fixtureId, staffId?, sectionIds?,
    // questionIds? }. Kinds are staff_department, staff_room, template_tree, and
    // template_in_use. The cleanup hook receives only fixtureIds returned here.
    const fixture = await adapterMethod('prepareWeek4OrganizationDependency')({
        kind,
        ...values,
        expectedDatabaseName: config.databaseName
    });
    if (!fixture || typeof fixture.fixtureId !== 'string' || !fixture.fixtureId) {
        throw new Error(`Adapter prepareWeek4OrganizationDependency() must return { fixtureId, ... } for "${kind}".`);
    }
    resources.dependencies.add(fixture.fixtureId);
    return fixture;
}

async function roomCase(prefix, number) {
    if (number >= authStart[prefix]) return runAuthCase(prefix, number);
    if (prefix === 'RST') return setRoom(number);
    if (prefix === 'RLS') return listRooms(number);
    if (prefix === 'RGT') return getRoom(number);
    if (prefix === 'RED') return editRoom(number);
    if (prefix === 'RDL') return deleteRoom(number);
    throw new Error(`Unknown Week 4 room group ${prefix}.`);
}

async function setRoom(number) {
    const department = await createDepartment();
    const good = { name: uniqueName('Room'), description: 'Room description', department_id: department.id };
    switch (number) {
        case 1: {
            const res = await api('post', '/api/rooms', good, { token: admin.token });
            expectCode(res, OK);
            assertEntityShape(dataOf(res), ['id', 'name', 'department_id', 'description', 'created_at']);
            expect(dataOf(res).name).toBe(good.name);
            return res;
        }
        case 2: {
            const res = await api('post', '/api/rooms', { name: good.name, department_id: department.id }, { token: admin.token });
            expectCode(res, OK);
            expect(dataOf(res).description == null).toBe(true);
            return res;
        }
        case 3: {
            const room = await createRoom(department.id, { name: good.name });
            expect(itemsOf(await api('get', '/api/rooms', undefined, { token: admin.token })).some(item => item.id === room.id)).toBe(true);
            const detail = await api('get', `/api/rooms/${room.id}`, undefined, { token: admin.token });
            expectCode(detail, OK);
            expect(dataOf(detail).name).toBe(good.name);
            return detail;
        }
        case 4: {
            const anotherDepartment = await createDepartment();
            const sameName = uniqueName('SameRoom');
            const first = await api('post', '/api/rooms', { name: sameName, department_id: department.id }, { token: admin.token });
            expectCode(first, OK);
            return api('post', '/api/rooms', { name: sameName, department_id: anotherDepartment.id }, { token: admin.token });
        }
        case 5: {
            expectCode(await api('post', '/api/rooms', { department_id: department.id }, { token: admin.token }), '1002');
            return api('post', '/api/rooms', { name: good.name }, { token: admin.token });
        }
        case 6: {
            for (const body of [{}, { name: '' }, { name: null }]) {
                expectCode(await api('post', '/api/rooms', body, { token: admin.token }), '1002');
            }
            return api('post', '/api/rooms', {}, { token: admin.token });
        }
        case 7: {
            expectCode(await api('post', '/api/rooms', { ...good, name: 123 }, { token: admin.token }), '1003');
            expectCode(await api('post', '/api/rooms', { ...good, description: 123 }, { token: admin.token }), '1003');
            return api('post', '/api/rooms', { ...good, department_id: 'abc' }, { token: admin.token });
        }
        case 8: return api('post', '/api/rooms', { ...good, name: '   ' }, { token: admin.token });
        case 9: {
            expectCode(await api('post', '/api/rooms', { ...good, name: 'x'.repeat(101) }, { token: admin.token }), '1004');
            return api('post', '/api/rooms', { ...good, description: 'x'.repeat(501) }, { token: admin.token });
        }
        case 10: {
            expectCode(await api('post', '/api/rooms', { ...good, department_id: 0 }, { token: admin.token }), '1004');
            return api('post', '/api/rooms', { ...good, department_id: -1 }, { token: admin.token });
        }
        case 11: {
            const xss = await api('post', '/api/rooms', { ...good, name: '<script>alert(1)</script>' }, { token: admin.token });
            expectCode(xss, '1004');
            const description = "O'Reilly; SELECT * FROM rooms --";
            const sqlText = await api('post', '/api/rooms', { ...good, description }, { token: admin.token });
            expectCode(sqlText, OK);
            expect(dataOf(sqlText).description).toBe(description);
            return xss;
        }
        case 12: return api('post', '/api/rooms', { ...good, department_id: 999999999 }, { token: admin.token });
        case 13: {
            const duplicate = uniqueName('RoomDuplicate');
            expectCode(await api('post', '/api/rooms', { ...good, name: duplicate }, { token: admin.token }), OK);
            return api('post', '/api/rooms', { ...good, name: ` ${duplicate.toUpperCase()} ` }, { token: admin.token });
        }
        case 14: {
            const same = uniqueName('ConcurrentRoom');
            const responses = await Promise.all(Array.from({ length: 5 }, () =>
                api('post', '/api/rooms', { ...good, name: same }, { token: admin.token })));
            expect(responses.filter(res => String(res.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(res => String(res.body?.code) === '9996')).toHaveLength(4);
            return responses.find(res => String(res.body?.code) === OK);
        }
        case 15: return api('post', '/api/rooms', '{"name":', { token: admin.token, contentType: 'application/json' });
        default: throw new Error(`Unhandled room creation case ${number}.`);
    }
}

async function listRooms(number) {
    if (number === 1) {
        const res = await api('get', '/api/rooms', undefined, { token: admin.token });
        expect(Array.isArray(dataOf(res))).toBe(true);
        for (const item of itemsOf(res)) assertEntityShape(item, ['id', 'name', 'department_id', 'description', 'created_at']);
        return res;
    }
    if (number === 2 || number === 3) {
        const department = await createDepartment();
        const room = await createRoom(department.id);
        const endpoint = number === 3 ? `/api/rooms?department_id=${department.id}` : '/api/rooms';
        const res = await api('get', endpoint, undefined, { token: admin.token });
        expect(itemsOf(res).some(item => item.id === room.id)).toBe(true);
        if (number === 3) expect(itemsOf(res).every(item => Number(item.department_id) === department.id)).toBe(true);
        return res;
    }
    if (number === 4) {
        const department = await createDepartment();
        const empty = await api('get', `/api/rooms?department_id=${department.id}`, undefined, { token: admin.token });
        expect(itemsOf(empty)).toEqual([]);
        const missing = await api('get', '/api/rooms?department_id=999999999', undefined, { token: admin.token });
        expect(itemsOf(missing)).toEqual([]);
        return missing;
    }
    if (number === 5) {
        for (const token of [patient.token, doctor.token]) {
            expectCode(await api('get', '/api/rooms', undefined, { token }), OK);
        }
        return api('get', '/api/rooms', undefined, { token: admin.token });
    }
    if (number === 6) {
        expectCode(await api('get', '/api/rooms?department_id=abc', undefined, { token: admin.token }), '1003');
        return api('get', '/api/rooms?department_id=1.5', undefined, { token: admin.token });
    }
    if (number === 7) {
        expectCode(await api('get', '/api/rooms?department_id=0', undefined, { token: admin.token }), '1004');
        return api('get', '/api/rooms?department_id=-1', undefined, { token: admin.token });
    }
    throw new Error(`Unhandled room list case ${number}.`);
}

async function getRoom(number) {
    if (number === 1 || number === 2) {
        const department = await createDepartment();
        const room = await createRoom(department.id);
        const res = await api('get', `/api/rooms/${room.id}`, undefined, { token: number === 2 ? doctor.token : admin.token });
        expectCode(res, OK);
        assertEntityShape(dataOf(res), ['id', 'name', 'description', 'department_id', 'created_at', 'updated_at']);
        return res;
    }
    if (number === 3) return tryPaths('get', '/api/rooms/', ['abc', '1.5', '1;DROP TABLE users'], undefined);
    if (number === 4) return tryPaths('get', '/api/rooms/', ['0', '-1', '99999999999999999999'], undefined);
    if (number === 5) return api('get', '/api/rooms/999999', undefined, { token: admin.token });
    if (number === 6) {
        const department = await createDepartment();
        const room = await createRoom(department.id);
        expectCode(await api('delete', `/api/rooms/${room.id}`, undefined, { token: admin.token }), OK);
        return api('get', `/api/rooms/${room.id}`, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled room detail case ${number}.`);
}

async function editRoom(number) {
    if (number >= authStart.RED) return runAuthCase('RED', number);
    if (number >= 12 && number <= 15) {
        if (number === 12) return tryPaths('put', '/api/rooms/', ['abc', '1.5', '1;DROP TABLE users'], { name: 'Updated' });
        if (number === 13) return tryPaths('put', '/api/rooms/', ['0', '-1', '99999999999999999999'], { name: 'Updated' });
        if (number === 14) return updateMissingEntity('/api/rooms/999999', { name: 'Updated' });
        const department = await createDepartment();
        const room = await createRoom(department.id);
        expectCode(await api('delete', `/api/rooms/${room.id}`, undefined, { token: admin.token }), OK);
        return api('put', `/api/rooms/${room.id}`, { name: 'Updated' }, { token: admin.token });
    }
    const department = await createDepartment();
    const room = await createRoom(department.id);
    const path = `/api/rooms/${room.id}`;
    if (number === 6) return api('put', path, {}, { token: admin.token });
    if (number === 7) {
        expectCode(await api('put', path, { name: 123 }, { token: admin.token }), '1003');
        return api('put', path, { department_id: 'abc' }, { token: admin.token });
    }
    if (number === 8) {
        let last;
        for (const name of ['', '   ', 'x'.repeat(101), '<b>']) {
            last = await api('put', path, { name }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 9) {
        for (const departmentId of [0, -1, null]) {
            const res = await api('put', path, { department_id: departmentId }, { token: admin.token });
            expectCode(res, '1004');
        }
        return api('put', path, { department_id: null }, { token: admin.token });
    }
    if (number === 10) return api('put', path, { department_id: 999999999 }, { token: admin.token });
    if (number === 11) {
        const other = await createRoom(department.id);
        return api('put', path, { name: other.name }, { token: admin.token });
    }
    if (number === 16) {
        const before = dataOf(await api('get', path, undefined, { token: admin.token }));
        const res = await api('put', path, {
            name: uniqueName('MassAssignedRoom'),
            id: 123456,
            created_at: '2000-01-01'
        }, { token: admin.token });
        expectCode(res, OK);
        const after = dataOf(await api('get', path, undefined, { token: admin.token }));
        expect(after.id).toBe(room.id);
        expect(after.created_at).toBe(before.created_at);
        return res;
    }
    if (number === 17) return api('put', path, '{"name":', { token: admin.token, contentType: 'application/json' });

    let body;
    let otherDepartment;
    let before;
    switch (number) {
        case 1: body = { name: uniqueName('RenamedRoom') }; break;
        case 2: body = { description: 'new room description' }; break;
        case 3:
            otherDepartment = await createDepartment();
            body = { department_id: otherDepartment.id };
            break;
        case 4:
            before = dataOf(await api('get', path, undefined, { token: admin.token }));
            body = { description: 'timestamp update' };
            break;
        case 5: body = { name: room.name }; break;
        default: throw new Error(`Unhandled room edit case ${number}.`);
    }
    const res = await api('put', path, body, { token: admin.token });
    expectCode(res, OK);
    const after = dataOf(await api('get', path, undefined, { token: admin.token }));
    if (number === 1 || number === 5) expect(after.name).toBe(body.name);
    if (number === 2) expect(after.description).toBe(body.description);
    if (number === 3) {
        expect(Number(after.department_id)).toBe(otherDepartment.id);
        expect(itemsOf(await api('get', `/api/rooms?department_id=${otherDepartment.id}`, undefined, { token: admin.token }))
            .some(item => item.id === room.id)).toBe(true);
    }
    if (number === 4) {
        expect(after.id).toBe(room.id);
        expect(after.created_at).toBe(before.created_at);
        expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime());
    }
    return res;
}

async function deleteRoom(number) {
    if (number >= authStart.RDL) return runAuthCase('RDL', number);
    if (number === 5) return tryPaths('delete', '/api/rooms/', ['abc', '1.5', '1;DROP TABLE users'], undefined);
    if (number === 6) return tryPaths('delete', '/api/rooms/', ['0', '-1', '99999999999999999999'], undefined);
    if (number === 7) return deleteMissingEntity('/api/rooms/999999');
    if (number === 4) {
        const department = await createDepartment();
        const room = await createRoom(department.id);
        const fixture = await prepareDependency('staff_room', { departmentId: department.id, roomId: room.id });
        const deleted = await api('delete', `/api/rooms/${room.id}`, undefined, { token: admin.token });
        expectCode(deleted, OK);
        const staff = await api('get', `/api/admin/users/${fixture.staffId}`, undefined, { token: admin.token });
        expectCode(staff, OK);
        expect(dataOf(staff).room_id).toBeNull();
        return deleted;
    }
    const department = await createDepartment();
    const room = await createRoom(department.id);
    const deleted = await api('delete', `/api/rooms/${room.id}`, undefined, { token: admin.token });
    if (number === 1) {
        expect(dataOf(deleted)).toEqual({});
        return deleted;
    }
    if (number === 2) {
        expectCode(await api('get', `/api/rooms/${room.id}`, undefined, { token: admin.token }), '9992');
        expect(itemsOf(await api('get', '/api/rooms', undefined, { token: admin.token })).some(item => item.id === room.id)).toBe(false);
        return api('get', `/api/rooms/${room.id}`, undefined, { token: admin.token });
    }
    if (number === 3) {
        expectCode(deleted, OK);
        return api('delete', `/api/rooms/${room.id}`, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled room delete case ${number}.`);
}

async function templateCase(prefix, number) {
    if (number >= authStart[prefix]) return runAuthCase(prefix, number);
    if (prefix === 'TST') return setTemplate(number);
    if (prefix === 'TLS') return listTemplates(number);
    if (prefix === 'TGT') return getTemplate(number);
    if (prefix === 'TED') return editTemplate(number);
    if (prefix === 'TDL') return deleteTemplate(number);
    throw new Error(`Unknown Week 4 template group ${prefix}.`);
}

async function setTemplate(number) {
    const code = `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
    const good = templateBody(code);
    switch (number) {
        case 1: {
            const res = await api('post', '/api/templates', { code_template: code, name: good.name }, { token: admin.token });
            expectCode(res, OK);
            expect(dataOf(res).version).toBe('1.0');
            expect(String(dataOf(res).is_active)).toBe('1');
            assertEntityShape(dataOf(res), ['created_at', 'updated_at']);
            return res;
        }
        case 2:
            return api('post', '/api/templates', { ...good, description: 'Complete template', version: '2.1', is_active: '0' }, { token: admin.token });
        case 3: {
            const template = await createTemplate();
            const listed = await api('get', '/api/templates/all', undefined, { token: admin.token });
            expect(itemsOf(listed).some(item => item.code_template === template.code_template)).toBe(true);
            const detail = await api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
            expectCode(detail, OK);
            expect(dataOf(detail).code_template).toBe(template.code_template);
            expect(dataOf(detail).sections).toEqual([]);
            return detail;
        }
        case 4: {
            let last;
            for (const version of ['1', '1.0', '1.2.3']) {
                last = await api('post', '/api/templates', {
                    ...good,
                    code_template: `TMPL_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
                    version
                }, { token: admin.token });
                expectCode(last, OK);
            }
            return last;
        }
        case 5: {
            expectCode(await api('post', '/api/templates', { name: good.name }, { token: admin.token }), '1002');
            return api('post', '/api/templates', { code_template: code }, { token: admin.token });
        }
        case 6: {
            expectCode(await api('post', '/api/templates', {}, { token: admin.token }), '1002');
            return api('post', '/api/templates', null, { token: admin.token });
        }
        case 7: {
            for (const body of [
                { ...good, code_template: 123 },
                { ...good, name: 123 },
                { ...good, version: 1.0 },
                { ...good, is_active: 1 },
                { ...good, description: 123 }
            ]) expectCode(await api('post', '/api/templates', body, { token: admin.token }), '1003');
            return api('post', '/api/templates', { ...good, is_active: true }, { token: admin.token });
        }
        case 8: {
            let last;
            for (const invalid of ['tmpl_lower', 'TMPL SPACE', '1ABC', 'AB', `A${'B'.repeat(50)}`]) {
                last = await api('post', '/api/templates', { ...good, code_template: invalid }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 9: {
            let last;
            for (const name of ['   ', 'x'.repeat(101), '<b>name</b>']) {
                last = await api('post', '/api/templates', { ...good, name }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 10: return api('post', '/api/templates', { ...good, description: 'x'.repeat(501) }, { token: admin.token });
        case 11: {
            let last;
            for (const version of ['abc', '1.0.0.0', '']) {
                last = await api('post', '/api/templates', { ...good, version }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 12: {
            let last;
            for (const is_active of ['2', 'yes', 'true', '']) {
                last = await api('post', '/api/templates', { ...good, is_active }, { token: admin.token });
                expectCode(last, '1004');
            }
            return last;
        }
        case 13: {
            expectCode(await api('post', '/api/templates', good, { token: admin.token }), OK);
            return api('post', '/api/templates', good, { token: admin.token });
        }
        case 14: {
            const same = `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
            const responses = await Promise.all(Array.from({ length: 5 }, () =>
                api('post', '/api/templates', { ...good, code_template: same }, { token: admin.token })));
            expect(responses.filter(res => String(res.body?.code) === OK)).toHaveLength(1);
            expect(responses.filter(res => String(res.body?.code) === '9996')).toHaveLength(4);
            return responses.find(res => String(res.body?.code) === OK);
        }
        case 15: return api('post', '/api/templates', '{"name":', { token: admin.token, contentType: 'application/json' });
        default: throw new Error(`Unhandled template creation case ${number}.`);
    }
}

async function listTemplates(number) {
    if (number === 1) {
        const res = await api('get', '/api/templates/all', undefined, { token: admin.token });
        expect(Array.isArray(dataOf(res))).toBe(true);
        expect(Number.isInteger(res.body.total)).toBe(true);
        for (const item of itemsOf(res)) {
            assertEntityShape(item, ['code_template', 'name', 'description', 'version', 'is_active', 'created_at']);
        }
        return res;
    }
    if (number === 2) {
        const template = await createTemplate({ is_active: '0' });
        const res = await api('get', '/api/templates/all', undefined, { token: admin.token });
        expect(itemsOf(res).some(item => item.code_template === template.code_template)).toBe(true);
        return res;
    }
    if (number === 3) {
        for (let i = 0; i < 3; i++) {
            await createTemplate();
        }
        const page1 = await api('get', '/api/templates/all?limit=2&page=1', undefined, { token: admin.token });
        const page2 = await api('get', '/api/templates/all?limit=2&page=2', undefined, { token: admin.token });
        const firstItems = itemsOf(page1);
        const secondItems = itemsOf(page2);
        const firstCodes = firstItems.map(item => item.code_template);
        const secondCodes = secondItems.map(item => item.code_template);
        expect(firstCodes.length).toBeLessThanOrEqual(2);
        expect(secondCodes.length).toBeLessThanOrEqual(2);
        expect(new Set([...firstCodes, ...secondCodes]).size).toBe(firstCodes.length + secondCodes.length);
        expect(Number(page1.body.total)).toBe(Number(page2.body.total));
        expect(Number(page1.body.total)).toBeGreaterThanOrEqual(firstCodes.length + secondCodes.length);
        return page2;
    }
    if (number === 4) {
        for (const token of [patient.token, doctor.token]) {
            expectCode(await api('get', '/api/templates/all', undefined, { token }), OK);
        }
        return api('get', '/api/templates/all', undefined, { token: admin.token });
    }
    if (number === 5) {
        const res = await api('get', '/api/templates/all?limit=100', undefined, { token: admin.token });
        const codes = itemsOf(res).map(item => item.code_template);
        expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
        return res;
    }
    if (number === 6) {
        const res = await api('get', '/api/templates/all?page=9999', undefined, { token: admin.token });
        expect(itemsOf(res)).toEqual([]);
        return res;
    }
    if (number === 7) return api('get', '/api/templates/all?limit=101', undefined, { token: admin.token });
    if (number === 8) {
        expectCode(await api('get', '/api/templates/all?page=0', undefined, { token: admin.token }), '1004');
        expectCode(await api('get', '/api/templates/all?limit=0', undefined, { token: admin.token }), '1004');
        return api('get', '/api/templates/all?limit=-1', undefined, { token: admin.token });
    }
    if (number === 9) {
        expectCode(await api('get', '/api/templates/all?page=abc', undefined, { token: admin.token }), '1003');
        return api('get', '/api/templates/all?limit=1.5', undefined, { token: admin.token });
    }
    throw new Error(`Unhandled template list case ${number}.`);
}

async function getTemplate(number) {
    if (number === 1 || number === 2) {
        const template = await createTemplate();
        const fixture = await prepareDependency('template_tree', { codeTemplate: template.code_template });
        const res = await api('get', `/api/templates/${encodeURIComponent(template.code_template)}`, undefined, { token: admin.token });
        expectCode(res, OK);
        expect(dataOf(res).code_template).toBe(template.code_template);
        expect(Array.isArray(dataOf(res).sections)).toBe(true);
        expect(dataOf(res).sections.length).toBeGreaterThan(0);
        const sections = dataOf(res).sections;
        if (number === 1) {
            expect(sections.length).toBeGreaterThanOrEqual(2);
            expect(sections[0]).toHaveProperty('section_id');
            expect(sections[0]).toHaveProperty('title');
            expect(Array.isArray(sections[0].questions)).toBe(true);
            expect(sections.some(section => section.questions?.some(question =>
                Array.isArray(question.options) && question.options.length > 0))).toBe(true);
        } else {
            expect(sections.map(section => Number(section.order))).toEqual(
                [...sections].map(section => Number(section.order)).sort((a, b) => a - b)
            );
            for (const section of sections) {
                const questions = section.questions || [];
                expect(questions.map(question => Number(question.order))).toEqual(
                    [...questions].map(question => Number(question.order)).sort((a, b) => a - b)
                );
                for (const question of questions) {
                    if (Array.isArray(question.options)) {
                        expect(question.options.map(option => Number(option.order))).toEqual(
                            [...question.options].map(option => Number(option.order)).sort((a, b) => a - b)
                        );
                    }
                }
            }
        }
        expect(fixture.fixtureId).toBeTruthy();
        return res;
    }
    if (number === 3) {
        const template = await createTemplate();
        const res = await api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
        expect(dataOf(res).sections).toEqual([]);
        return res;
    }
    if (number === 4) {
        const template = await createTemplate({ is_active: '0' });
        const res = await api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
        expectCode(res, OK);
        expect(dataOf(res).code_template).toBe(template.code_template);
        return res;
    }
    if (number === 5) {
        const template = await createTemplate();
        for (const token of [patient.token, doctor.token]) {
            expectCode(await api('get', `/api/templates/${template.code_template}`, undefined, { token }), OK);
        }
        return api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    }
    if (number === 6) {
        expectCode(await api('get', '/api/templates/abc%20def', undefined, { token: admin.token }), '1004');
        return api('get', '/api/templates/tmpl_x', undefined, { token: admin.token });
    }
    if (number === 7) return api('get', '/api/templates/999999999', undefined, { token: admin.token });
    if (number === 8) {
        const template = await createTemplate();
        expectCode(await api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token }), OK);
        return api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled template detail case ${number}.`);
}

async function editTemplate(number) {
    if (number >= authStart.TED) return runAuthCase('TED', number);
    if (number === 9) return api('put', '/api/templates/abc%20def', { name: 'Updated' }, { token: admin.token });
    if (number === 10) return updateMissingEntity('/api/templates/999999999', { name: 'Updated' });
    if (number === 11) {
        const template = await createTemplate();
        expectCode(await api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token }), OK);
        return api('put', `/api/templates/${template.code_template}`, { name: 'Updated' }, { token: admin.token });
    }
    const template = await createTemplate();
    const path = `/api/templates/${template.code_template}`;
    if (number === 4) {
        await prepareDependency('template_in_use', { codeTemplate: template.code_template });
        const name = uniqueName('InUseMetadata');
        const res = await api('put', path, { name }, { token: admin.token });
        expectCode(res, OK);
        expect(dataOf(await api('get', path, undefined, { token: admin.token })).name).toBe(name);
        return res;
    }
    if (number === 5) return api('put', path, {}, { token: admin.token });
    if (number === 6) {
        expectCode(await api('put', path, { name: 123 }, { token: admin.token }), '1003');
        expectCode(await api('put', path, { version: 2 }, { token: admin.token }), '1003');
        return api('put', path, { is_active: 0 }, { token: admin.token });
    }
    if (number === 7) {
        let last;
        for (const name of ['', '   ', 'x'.repeat(101), '<b>name</b>']) {
            last = await api('put', path, { name }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) {
        expectCode(await api('put', path, { version: 'abc' }, { token: admin.token }), '1004');
        return api('put', path, { is_active: '2' }, { token: admin.token });
    }
    if (number === 12) {
        const before = dataOf(await api('get', path, undefined, { token: admin.token }));
        const replacementCode = `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
        const res = await api('put', path, {
            name: uniqueName('TemplateMeta'),
            code_template: replacementCode,
            created_at: '2000-01-01'
        }, { token: admin.token });
        expectCode(res, OK);
        const after = dataOf(await api('get', path, undefined, { token: admin.token }));
        expect(after.code_template).toBe(template.code_template);
        expect(after.created_at).toBe(before.created_at);
        return res;
    }
    if (number === 13) return api('put', path, '{"name":', { token: admin.token, contentType: 'application/json' });

    let body;
    switch (number) {
        case 1: body = { name: uniqueName('RenamedTemplate') }; break;
        case 2: body = { description: 'revised description', version: '2.1', is_active: '0' }; break;
        case 3: body = {
            name: uniqueName('AllFields'),
            description: 'all fields changed',
            version: '1.2.3',
            is_active: '0'
        }; break;
        default: throw new Error(`Unhandled template edit case ${number}.`);
    }
    const res = await api('put', path, body, { token: admin.token });
    expectCode(res, OK);
    const detail = dataOf(await api('get', path, undefined, { token: admin.token }));
    for (const [field, value] of Object.entries(body)) expect(String(detail[field])).toBe(String(value));
    return res;
}

async function deleteTemplate(number) {
    if (number >= authStart.TDL) return runAuthCase('TDL', number);
    if (number === 6) return api('delete', '/api/templates/abc%20def', undefined, { token: admin.token });
    if (number === 7) return deleteMissingEntity('/api/templates/999999999');
    if (number === 5) {
        const template = await createTemplate();
        await prepareDependency('template_in_use', { codeTemplate: template.code_template });
        return api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    }
    const template = await createTemplate();
    if (number === 4) {
        const fixture = await prepareDependency('template_tree', { codeTemplate: template.code_template });
        const deleted = await api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
        expectCode(deleted, '9992');
        for (const sectionId of fixture.sectionIds || []) {
            expectCode(await api('put', `/api/templates/sections/${sectionId}`, { title: 'After cascade' }, { token: admin.token }), '9992');
        }
        for (const questionId of fixture.questionIds || []) {
            expectCode(await api('put', `/api/templates/questions/${questionId}`, { question_text: 'After cascade' }, { token: admin.token }), '9992');
        }
        if (!fixture.sectionIds?.length || !fixture.questionIds?.length) {
            throw new Error('template_tree fixture must return non-empty sectionIds and questionIds for cascade verification.');
        }
        return deleted;
    }
    const deleted = await api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    if (number === 1) {
        expectCode(deleted, OK);
        expect(dataOf(deleted)).toEqual({});
        return deleted;
    }
    if (number === 2) {
        expectCode(deleted, OK);
        return api('get', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    }
    if (number === 3) {
        expectCode(deleted, OK);
        return api('delete', `/api/templates/${template.code_template}`, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled template delete case ${number}.`);
}

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    if (prefix[0] === 'D') return departmentCase(prefix, number);
    if (prefix[0] === 'R') return roomCase(prefix, number);
    return templateCase(prefix, number);
}

beforeAll(async () => {
    const db = await adapterCall('assertTestDatabase');
    if (db?.isTestDatabase !== true || db.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}".`);
    }
    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    for (const roleName of ['admin', 'patient', 'doctor']) {
        if (!Number.isInteger(roles?.[roleName]) || roles[roleName] <= 0) {
            throw new Error(`Adapter getRoleIds() must return a positive integer "${roleName}" role ID.`);
        }
    }
    if (roles.admin !== 1) throw new Error('The workbook specifies director/admin role ID 1.');
    admin = await registerAccount('Admin', roles.admin);
    patient = await registerAccount('Patient', roles.patient);
    doctor = await registerAccount('Doctor', roles.doctor);
    baseBranch = await createBranch();
    resources.branches.delete(baseBranch.id);
});

afterEach(cleanupCase);

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['case cleanup', cleanupCase],
        ['base branch', cleanupBaseBranch],
        ['suite accounts', cleanupAccounts],
        ['test-hook reset', () => adapterCall('resetTestHooks')]
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(`${label}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
});

describe(`Target ${config.targetName} - Week 4 organization and templates`, () => {
    describe.each(groups)('Week 4 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            expectCode(await runCase(id), expected);
        });
    });
});
