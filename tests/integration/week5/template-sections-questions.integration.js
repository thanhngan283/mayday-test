const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    SSC: '1000,1000,1000,1000,1000,1002,1002,1003,1004,1004,1004,1004,9992,1004,1010,1003,9998,9998,9998,9998,1009,1009',
    SED: '1000,1000,1000,1000,1002,1003,1004,1004,9992,9992,1010,1000,1003,9998,9998,9998,9998,1009,1009',
    SDL: '1000,1000,9992,9992,9992,1010,9998,9998,9998,9998,1009,1009',
    SQC: '1000,1000,1000,1000,1000,1000,1002,1002,1003,1003,1004,1004,1004,1004,1004,1004,1004,1004,1002,1004,1004,9992,9996,9992,1004,1010,1000,1003,9998,9998,9998,9998,1009,1009',
    QED: '1000,1000,1000,1000,1000,1000,1002,1003,1004,1004,1004,1004,1004,9992,9992,9992,1010,1000,1003,9998,9998,9998,9998,1009,1009',
    QDL: '1000,1000,1000,1000,9992,9992,1010,9998,9998,9998,9998,1009,1009'
};

const titles = {
    SSC: [
        'required fields and defaults', 'all fields', 'filled_by enum values', 'visible in template detail',
        'duplicate order tie-break', 'each required field omitted', 'empty bodies', 'wrong field types',
        'invalid titles', 'invalid order values', 'invalid is_required values', 'invalid filled_by values',
        'unknown template sentinel', 'malformed template path', 'template in use is locked', 'malformed JSON',
        'missing authorization', 'invalid authorization', 'expired authorization', 'logged-out authorization',
        'patient forbidden', 'doctor forbidden'
    ],
    SED: [
        'change title', 'change order and flags', 'change all mutable fields', 'detail reflects new order',
        'empty update', 'wrong field types', 'invalid titles', 'invalid field values', 'unknown section sentinel',
        'deleted section sentinel', 'template in use is locked', 'mass assignment ignored', 'malformed JSON',
        'missing authorization', 'invalid authorization', 'expired authorization', 'logged-out authorization',
        'patient forbidden', 'doctor forbidden'
    ],
    SDL: [
        'delete section', 'deleted section absent from detail', 'question cascade', 'delete twice',
        'unknown section sentinel', 'template in use is locked', 'missing authorization', 'invalid authorization',
        'expired authorization', 'logged-out authorization', 'patient forbidden', 'doctor forbidden'
    ],
    SQC: [
        'minimal text question', 'non-choice question types', 'choice questions and options',
        'optional fields accepted', 'valid parent question', 'visible in correct section and order',
        'each required field omitted', 'empty bodies', 'wrong field types', 'wrong options types',
        'question_id format', 'invalid question text', 'invalid type_question', 'invalid flags and order',
        'invalid show_if_answer JSON', 'options on non-choice type', 'choice type requires options',
        'duplicate option values', 'required option fields', 'invalid option values', 'option count limit',
        'unknown section sentinel', 'question_id uniqueness', 'unknown parent question',
        'parent from another template', 'template in use is locked', 'concurrent duplicate question_id',
        'malformed JSON', 'missing authorization', 'invalid authorization', 'expired authorization',
        'logged-out authorization', 'patient forbidden', 'doctor forbidden'
    ],
    QED: [
        'change question text and order', 'change show_if_answer', 'edit option by id', 'append new option',
        'remove omitted option', 'template detail reflects edits', 'empty update', 'wrong field types',
        'invalid question text', 'invalid order and condition', 'options on text question',
        'empty options on choice question', 'duplicate option values', 'option id belongs elsewhere or missing',
        'unknown question sentinel', 'deleted question sentinel', 'template in use is locked',
        'mass assignment ignored', 'malformed JSON', 'missing authorization', 'invalid authorization',
        'expired authorization', 'logged-out authorization', 'patient forbidden', 'doctor forbidden'
    ],
    QDL: [
        'delete question', 'deleted question absent from detail', 'option cascade',
        'delete parent detaches child', 'delete twice', 'unknown question sentinel',
        'template in use is locked', 'missing authorization', 'invalid authorization',
        'expired authorization', 'logged-out authorization', 'patient forbidden', 'doctor forbidden'
    ]
};

const groups = Object.entries(catalog).map(([prefix, codes]) => ({
    prefix,
    cases: codes.split(',').map((expected, index) => ({
        id: `W5-${prefix}-${String(index + 1).padStart(2, '0')}`,
        expected,
        title: titles[prefix][index]
    }))
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 125 || new Set(allCases.map(item => item.id)).size !== 125) {
    throw new Error(`Week 5 workbook coverage must contain exactly 125 unique cases; found ${allCases.length}.`);
}

const resources = {
    templates: new Set(),
    sections: new Set(),
    questions: new Set(),
    adapterFixtureIds: new Set()
};
const accountPhones = new Set();
let roles;
let admin;
let patient;
let doctor;

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') {
        throw new Error(`The target adapter must implement ${name}().`);
    }
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({ ...values, expectedDatabaseName: config.databaseName });
}

function uniqueName(prefix = 'week5') {
    return `${prefix}_${crypto.randomBytes(7).toString('hex')}`;
}

function uniqueQuestionId(prefix = 'Q') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
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
    const code = String(response?.body?.code);
    const data = dataOf(response);

    if (method.toLowerCase() === 'post' && endpoint === '/api/templates' &&
        code === OK && typeof body?.code_template === 'string') {
        resources.templates.add(body.code_template);
    }
    if (method.toLowerCase() === 'post' && endpoint.endsWith('/sections') &&
        code === OK && data?.section_id !== undefined) {
        resources.sections.add(String(data.section_id));
    }
    if (method.toLowerCase() === 'post' && endpoint.endsWith('/questions') &&
        code === OK && typeof body?.question_id === 'string') {
        resources.questions.add(body.question_id);
    }
    return response;
}

async function registerAccount(roleName, roleId) {
    const account = {
        full_name: `Mayday Week 5 ${roleName}`,
        phone: phone(),
        password: password()
    };
    accountPhones.add(account.phone);
    const signup = await api('post', '/api/auth/signup', account);
    expectCode(signup, OK);
    const promoted = await adapterCall('promoteUser', { phone: account.phone, roleId });
    if (Number(promoted?.roleId) !== roleId) {
        throw new Error(`Adapter failed to promote the Week 5 ${roleName} account.`);
    }
    const login = await api('post', '/api/auth/login', {
        phone: account.phone,
        password: account.password
    });
    expectCode(login, OK);
    account.token = dataOf(login)?.token;
    if (!account.token) throw new Error(`Week 5 ${roleName} login did not return data.token.`);
    return account;
}

function templateBody(code = `TMPL_${crypto.randomBytes(7).toString('hex').toUpperCase()}`) {
    return {
        code_template: code,
        name: uniqueName('W5Template'),
        version: '1.0',
        is_active: '1'
    };
}

async function createTemplate() {
    const body = templateBody();
    const response = await api('post', '/api/templates', body, { token: admin.token });
    expectCode(response, OK);
    return { code: body.code_template, response };
}

function sectionPath(templateCode) {
    return `/api/templates/${encodeURIComponent(templateCode)}/sections`;
}

function sectionBody(overrides = {}) {
    return {
        title: uniqueName('Section'),
        order: '1',
        is_required: '0',
        filled_by: 'patient',
        ...overrides
    };
}

async function createSection(templateCode, overrides = {}) {
    const body = sectionBody(overrides);
    const response = await api('post', sectionPath(templateCode), body, { token: admin.token });
    expectCode(response, OK);
    const sectionId = dataOf(response)?.section_id;
    if (sectionId === undefined || sectionId === null) {
        throw new Error('Creating a Week 5 section did not return data.section_id.');
    }
    return { id: String(sectionId), templateCode, body, response };
}

function questionPath(sectionId) {
    return `/api/templates/sections/${encodeURIComponent(String(sectionId))}/questions`;
}

function questionEditPath(questionId) {
    return `/api/templates/questions/${encodeURIComponent(String(questionId))}`;
}

function questionBody(overrides = {}) {
    return {
        question_id: uniqueQuestionId(),
        question_text: uniqueName('Question'),
        type_question: 'text',
        order: '1',
        ...overrides
    };
}

async function createQuestion(sectionId, overrides = {}) {
    const body = questionBody(overrides);
    const response = await api('post', questionPath(sectionId), body, { token: admin.token });
    expectCode(response, OK);
    return { id: body.question_id, sectionId: String(sectionId), body, response };
}

async function templateDetail(code, token = admin.token) {
    return api('get', `/api/templates/${encodeURIComponent(code)}`, undefined, { token });
}

function findSection(detail, sectionId) {
    return (dataOf(detail)?.sections || []).find(section =>
        String(section.section_id) === String(sectionId));
}

function findQuestion(detail, questionId) {
    for (const section of dataOf(detail)?.sections || []) {
        const found = (section.questions || []).find(question =>
            String(question.question_id) === String(questionId));
        if (found) return { section, question: found };
    }
    return undefined;
}

function assertSection(detail, sectionId) {
    const section = findSection(detail, sectionId);
    expect(section).toBeTruthy();
    return section;
}

function assertQuestion(detail, questionId) {
    const found = findQuestion(detail, questionId);
    expect(found).toBeTruthy();
    return found;
}

function optionPayload(option) {
    return {
        ...(option.id === undefined ? {} : { id: option.id }),
        option_text: option.option_text,
        option_value: option.option_value,
        ...(option.order === undefined ? {} : { order: String(option.order) })
    };
}

async function prepareTemplateInUse(codeTemplate) {
    // Contract: prepareWeek5TemplateUsage({ codeTemplate, expectedDatabaseName }) must attach
    // a disposable medical-record/use fixture to this suite-created template and return
    // { fixtureIds: [opaque IDs created by this hook] }. cleanupWeek5Fixtures({ fixtureIds,
    // expectedDatabaseName }) may remove only the exact IDs passed back by this suite.
    const result = await adapterMethod('prepareWeek5TemplateUsage')({
        codeTemplate,
        expectedDatabaseName: config.databaseName
    });
    if (!Array.isArray(result?.fixtureIds) || result.fixtureIds.length === 0 ||
        result.fixtureIds.some(id => !['string', 'number'].includes(typeof id) || String(id).length === 0)) {
        throw new Error('prepareWeek5TemplateUsage() must return a non-empty fixtureIds array of opaque IDs.');
    }
    for (const id of result.fixtureIds) resources.adapterFixtureIds.add(id);
}

async function authCase(kind, method, endpoint, body) {
    if (kind === 'missing') return api(method, endpoint, body);
    if (kind === 'invalid') {
        const login = await api('post', '/api/auth/login', {
            phone: admin.phone,
            password: admin.password
        });
        expectCode(login, OK);
        const parts = dataOf(login)?.token?.split('.');
        if (!parts || parts.length !== 3) throw new Error('Login did not return a JWT for invalid-token checks.');
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
    throw new Error(`Unknown Week 5 authorization case "${kind}".`);
}

function authKind(prefix, number) {
    const starts = { SSC: 17, SED: 14, SDL: 7, SQC: 29, QED: 20, QDL: 8 };
    return ['missing', 'invalid', 'expired', 'logout', 'patient', 'doctor'][number - starts[prefix]];
}

async function runAuthCase(prefix, number) {
    let method;
    let endpoint;
    let body;
    if (prefix === 'SSC') {
        const template = await createTemplate();
        method = 'post';
        endpoint = sectionPath(template.code);
        body = sectionBody();
    } else if (prefix === 'SED' || prefix === 'SDL') {
        const template = await createTemplate();
        const section = await createSection(template.code);
        method = prefix === 'SED' ? 'put' : 'delete';
        endpoint = `/api/templates/sections/${section.id}`;
        body = prefix === 'SED' ? { title: uniqueName('AuthEdit') } : undefined;
    } else {
        const template = await createTemplate();
        const section = await createSection(template.code);
        const question = await createQuestion(section.id);
        method = prefix === 'SQC' ? 'post' : prefix === 'QED' ? 'put' : 'delete';
        endpoint = prefix === 'SQC' ? questionPath(section.id) : questionEditPath(question.id);
        body = prefix === 'SQC' ? questionBody() :
            prefix === 'QED' ? { question_text: uniqueName('AuthEdit') } : undefined;
    }
    const kind = authKind(prefix, number);
    const response = await authCase(kind, method, endpoint, body);
    expectCode(response, kind === 'patient' || kind === 'doctor' ? '1009' : '9998');
    return response;
}

async function createChoiceQuestion(sectionId, overrides = {}) {
    return createQuestion(sectionId, {
        type_question: 'radio',
        options: [
            { option_text: 'Option A', option_value: 'a', order: '1' },
            { option_text: 'Option B', option_value: 'b', order: '2' }
        ],
        ...overrides
    });
}

async function getQuestionOptions(templateCode, questionId) {
    const detail = await templateDetail(templateCode);
    const question = assertQuestion(detail, questionId).question;
    return Array.isArray(question.options) ? question.options : [];
}

async function createSectionFixture() {
    const template = await createTemplate();
    const section = await createSection(template.code);
    return { template, section };
}

async function createQuestionFixture(type = 'text') {
    const fixture = await createSectionFixture();
    const question = type === 'radio'
        ? await createChoiceQuestion(fixture.section.id)
        : await createQuestion(fixture.section.id, { type_question: type });
    return { ...fixture, question };
}

async function runSectionCreate(number) {
    if (number >= 17) return runAuthCase('SSC', number);
    const template = await createTemplate();
    const base = sectionBody();
    if (number === 1) {
        const response = await api('post', sectionPath(template.code), {
            title: base.title, order: '1'
        }, { token: admin.token });
        expectCode(response, OK);
        const created = dataOf(response);
        expect(created).toEqual(expect.objectContaining({
            section_id: expect.anything(),
            template_id: expect.anything(),
            title: base.title,
            order: expect.anything()
        }));
        expect(String(created.is_required)).toBe('0');
        expect(created.filled_by).toBe('patient');
        return response;
    }
    if (number === 2) {
        const response = await api('post', sectionPath(template.code), {
            ...base, is_required: '1', filled_by: 'doctor'
        }, { token: admin.token });
        expectCode(response, OK);
        const section = assertSection(await templateDetail(template.code), dataOf(response).section_id);
        expect(String(section.is_required)).toBe('1');
        expect(section.filled_by).toBe('doctor');
        return response;
    }
    if (number === 3) {
        let last;
        for (const filled_by of ['patient', 'doctor', 'patdoc']) {
            last = await api('post', sectionPath(template.code), {
                ...sectionBody(), filled_by
            }, { token: admin.token });
            expectCode(last, OK);
            expect(dataOf(last).filled_by).toBe(filled_by);
        }
        return last;
    }
    if (number === 4) {
        const response = await api('post', sectionPath(template.code), base, { token: admin.token });
        expectCode(response, OK);
        const section = assertSection(await templateDetail(template.code), dataOf(response).section_id);
        expect(section.title).toBe(base.title);
        return response;
    }
    if (number === 5) {
        const first = await createSection(template.code, { order: '7' });
        const second = await createSection(template.code, { order: '7' });
        expect(first.id).not.toBe(second.id);
        const detail = await templateDetail(template.code);
        const tied = (dataOf(detail).sections || []).filter(item => String(item.order) === '7');
        expect(tied).toHaveLength(2);
        expect(tied.map(item => Number(item.section_id))).toEqual(
            [...tied].map(item => Number(item.section_id)).sort((a, b) => a - b)
        );
        return second.response;
    }
    if (number === 6) {
        for (const body of [
            { order: '1' }, { title: base.title }
        ]) expectCode(await api('post', sectionPath(template.code), body, { token: admin.token }), '1002');
        return api('post', sectionPath(template.code), { order: '1' }, { token: admin.token });
    }
    if (number === 7) {
        for (const body of [{}, '', null]) {
            expectCode(await api('post', sectionPath(template.code), body, { token: admin.token }), '1002');
        }
        return api('post', sectionPath(template.code), {}, { token: admin.token });
    }
    if (number === 8) {
        let last;
        for (const body of [
            { ...base, title: 123 },
            { ...base, order: 1 },
            { ...base, is_required: 1 },
            { ...base, is_required: true },
            { ...base, filled_by: 1 }
        ]) {
            last = await api('post', sectionPath(template.code), body, { token: admin.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 9) {
        let last;
        for (const title of ['   ', 'x'.repeat(201), '<b>']) {
            last = await api('post', sectionPath(template.code), { ...base, title }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 10) {
        let last;
        for (const order of ['abc', '-1', '1.5', '', '10000']) {
            last = await api('post', sectionPath(template.code), { ...base, order }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 11) {
        let last;
        for (const is_required of ['2', 'yes']) {
            last = await api('post', sectionPath(template.code), { ...base, is_required }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        let last;
        for (const filled_by of ['nurse', 'PATIENT', '']) {
            last = await api('post', sectionPath(template.code), { ...base, filled_by }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        expectCode(await api('delete', `/api/templates/${encodeURIComponent(template.code)}`, undefined, { token: admin.token }), OK);
        return api('post', sectionPath(template.code), base, { token: admin.token });
    }
    if (number === 14) {
        return api('post', '/api/templates/abc%20def/sections', base, { token: admin.token });
    }
    if (number === 15) {
        await prepareTemplateInUse(template.code);
        return api('post', sectionPath(template.code), base, { token: admin.token });
    }
    if (number === 16) {
        return api('post', sectionPath(template.code), '{"title":', {
            token: admin.token, contentType: 'application/json'
        });
    }
    throw new Error(`Unhandled Week 5 section creation case ${number}.`);
}

async function runSectionEdit(number) {
    if (number >= 14) return runAuthCase('SED', number);
    if (number === 9) {
        const { template, section } = await createSectionFixture();
        const endpoint = `/api/templates/sections/${section.id}`;
        expectCode(await api('delete', endpoint, undefined, { token: admin.token }), OK);
        return api('put', endpoint, { title: 'After section deletion' }, { token: admin.token });
    }
    if (number === 10) {
        const { template, section } = await createSectionFixture();
        expectCode(await api('delete', `/api/templates/sections/${section.id}`, undefined, { token: admin.token }), OK);
        expect(findSection(await templateDetail(template.code), section.id)).toBeUndefined();
        return api('put', `/api/templates/sections/${section.id}`, { title: 'After delete' }, { token: admin.token });
    }
    const { template, section } = await createSectionFixture();
    const endpoint = `/api/templates/sections/${section.id}`;
    if (number === 11) {
        await prepareTemplateInUse(template.code);
        return api('put', endpoint, { title: uniqueName('Locked') }, { token: admin.token });
    }
    if (number === 5) return api('put', endpoint, {}, { token: admin.token });
    if (number === 6) {
        let last;
        for (const body of [
            { title: 123 }, { order: 1 }, { is_required: true }
        ]) {
            last = await api('put', endpoint, body, { token: admin.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) {
        let last;
        for (const title of ['', 'x'.repeat(201), '<b>']) {
            last = await api('put', endpoint, { title }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) {
        let last;
        for (const body of [
            { order: 'abc' }, { is_required: '2' }, { filled_by: 'nurse' }
        ]) {
            last = await api('put', endpoint, body, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        const before = assertSection(await templateDetail(template.code), section.id);
        const response = await api('put', endpoint, {
            section_id: 999999999,
            template_id: 'TMPL_OTHER',
            title: uniqueName('MassAssigned')
        }, { token: admin.token });
        expectCode(response, OK);
        const after = assertSection(await templateDetail(template.code), section.id);
        expect(String(after.section_id)).toBe(String(before.section_id));
        expect(String(after.template_id)).toBe(String(before.template_id));
        return response;
    }
    if (number === 13) {
        return api('put', endpoint, '{"title":', {
            token: admin.token, contentType: 'application/json'
        });
    }

    let body;
    switch (number) {
        case 1: body = { title: uniqueName('Renamed') }; break;
        case 2: body = { order: '8', is_required: '1', filled_by: 'doctor' }; break;
        case 3: body = { title: uniqueName('AllFields'), order: '9', is_required: '1', filled_by: 'patdoc' }; break;
        case 4: body = { order: '0' }; break;
        default: throw new Error(`Unhandled Week 5 section edit case ${number}.`);
    }
    const response = await api('put', endpoint, body, { token: admin.token });
    expectCode(response, OK);
    const detail = await templateDetail(template.code);
    const updated = assertSection(detail, section.id);
    for (const [field, value] of Object.entries(body)) expect(String(updated[field])).toBe(String(value));
    if (number === 4) {
        const sections = dataOf(detail).sections;
        expect(sections.map(item => Number(item.order))).toEqual(
            [...sections].map(item => Number(item.order)).sort((a, b) => a - b)
        );
    }
    return response;
}

async function runSectionDelete(number) {
    if (number >= 7) return runAuthCase('SDL', number);
    if (number === 5) {
        const { section } = await createSectionFixture();
        const endpoint = `/api/templates/sections/${section.id}`;
        expectCode(await api('delete', endpoint, undefined, { token: admin.token }), OK);
        return api('delete', endpoint, undefined, { token: admin.token });
    }
    const { template, section } = await createSectionFixture();
    const endpoint = `/api/templates/sections/${section.id}`;
    if (number === 6) {
        await prepareTemplateInUse(template.code);
        return api('delete', endpoint, undefined, { token: admin.token });
    }
    if (number === 3) {
        const question = await createQuestion(section.id);
        const deleted = await api('delete', endpoint, undefined, { token: admin.token });
        expectCode(deleted, OK);
        expect(findSection(await templateDetail(template.code), section.id)).toBeUndefined();
        return api('put', questionEditPath(question.id), { question_text: 'After section cascade' }, { token: admin.token });
    }
    const deleted = await api('delete', endpoint, undefined, { token: admin.token });
    if (number === 1) {
        expect(dataOf(deleted)).toEqual({});
        return deleted;
    }
    if (number === 2) {
        expectCode(deleted, OK);
        expect(findSection(await templateDetail(template.code), section.id)).toBeUndefined();
        return deleted;
    }
    if (number === 4) {
        expectCode(deleted, OK);
        return api('delete', endpoint, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled Week 5 section delete case ${number}.`);
}

async function runQuestionCreate(number) {
    if (number >= 29) return runAuthCase('SQC', number);
    if (number === 22) {
        const { section } = await createSectionFixture();
        const sectionEndpoint = `/api/templates/sections/${section.id}`;
        expectCode(await api('delete', sectionEndpoint, undefined, { token: admin.token }), OK);
        return api('post', questionPath(section.id), questionBody(), { token: admin.token });
    }
    const { template, section } = await createSectionFixture();
    const base = questionBody();
    if (number === 1) {
        const response = await api('post', questionPath(section.id), base, { token: admin.token });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual(expect.objectContaining({
            question_id: base.question_id,
            section_id: expect.anything(),
            question_text: base.question_text,
            type_question: 'text'
        }));
        return response;
    }
    if (number === 2) {
        let last;
        for (const type_question of ['text', 'textarea', 'number', 'date']) {
            last = await api('post', questionPath(section.id), questionBody({ type_question }), { token: admin.token });
            expectCode(last, OK);
            expect(dataOf(last).type_question).toBe(type_question);
        }
        return last;
    }
    if (number === 3) {
        let last;
        for (const type_question of ['radio', 'checkbox', 'select']) {
            last = await api('post', questionPath(section.id), questionBody({
                type_question,
                options: [
                    { option_text: 'First', option_value: `first_${type_question}`, order: '1' },
                    { option_text: 'Second', option_value: `second_${type_question}`, order: '2' }
                ]
            }), { token: admin.token });
            expectCode(last, OK);
            const options = dataOf(last)?.options;
            if (Array.isArray(options)) expect(options).toHaveLength(2);
        }
        return last;
    }
    if (number === 4) {
        const body = questionBody({
            placeholder: 'Type your answer',
            is_required: '1',
            help_text: 'A short hint',
            allow_image: '1',
            show_if_answer: '{"Q_PARENT":"yes"}',
            trigger_image_upload: '1'
        });
        const response = await api('post', questionPath(section.id), body, { token: admin.token });
        expectCode(response, OK);
        const created = assertQuestion(await templateDetail(template.code), body.question_id).question;
        for (const field of [
            'placeholder', 'is_required', 'help_text', 'allow_image', 'show_if_answer',
            'trigger_image_upload'
        ]) expect(String(created[field])).toBe(String(body[field]));
        return response;
    }
    if (number === 5) {
        const parent = await createQuestion(section.id);
        return api('post', questionPath(section.id), questionBody({
            parent_question_id: parent.id
        }), { token: admin.token });
    }
    if (number === 6) {
        const response = await api('post', questionPath(section.id), base, { token: admin.token });
        expectCode(response, OK);
        const detail = await templateDetail(template.code);
        const found = assertQuestion(detail, base.question_id);
        expect(String(found.section.section_id)).toBe(section.id);
        expect(String(found.question.order)).toBe('1');
        return response;
    }
    if (number === 7) {
        let last;
        for (const body of [
            { question_text: base.question_text, type_question: 'text', order: '1' },
            { question_id: base.question_id, type_question: 'text', order: '1' },
            { question_id: base.question_id, question_text: base.question_text, order: '1' },
            { question_id: base.question_id, question_text: base.question_text, type_question: 'text' }
        ]) {
            last = await api('post', questionPath(section.id), body, { token: admin.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 8) {
        for (const body of [{}, '', null]) {
            expectCode(await api('post', questionPath(section.id), body, { token: admin.token }), '1002');
        }
        return api('post', questionPath(section.id), {}, { token: admin.token });
    }
    if (number === 9) {
        let last;
        for (const body of [
            questionBody({ question_id: 123 }),
            questionBody({ question_text: 123 }),
            questionBody({ type_question: 1 }),
            questionBody({ order: 1 }),
            questionBody({ is_required: 1 }),
            questionBody({ allow_image: true }),
            questionBody({ show_if_answer: {} }),
            questionBody({ parent_question_id: 1 })
        ]) {
            last = await api('post', questionPath(section.id), body, { token: admin.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 10) {
        let last;
        for (const options of ['abc', {}, ['a'], [{ option_text: 1 }]]) {
            last = await api('post', questionPath(section.id), questionBody({
                type_question: 'radio', options
            }), { token: admin.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 11) {
        let last;
        for (const question_id of ['q_itch', 'Q ITCH', '1Q', `Q${'A'.repeat(50)}`]) {
            last = await api('post', questionPath(section.id), questionBody({ question_id }), { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        let last;
        for (const question_text of ['   ', 'x'.repeat(501), '<b>']) {
            last = await api('post', questionPath(section.id), questionBody({ question_text }), { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        let last;
        for (const type_question of ['dropdown', 'TEXT']) {
            last = await api('post', questionPath(section.id), questionBody({ type_question }), { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14) {
        let last;
        for (const body of [
            { order: 'abc' }, { is_required: '2' }, { allow_image: '2' }
        ]) {
            last = await api('post', questionPath(section.id), questionBody(body), { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 15) {
        return api('post', questionPath(section.id), questionBody({ show_if_answer: 'not json' }), { token: admin.token });
    }
    if (number === 16) {
        return api('post', questionPath(section.id), questionBody({ options: [{ option_text: 'No', option_value: 'n' }] }), { token: admin.token });
    }
    if (number === 17) {
        expectCode(await api('post', questionPath(section.id), questionBody({
            type_question: 'radio'
        }), { token: admin.token }), '1004');
        return api('post', questionPath(section.id), questionBody({
            type_question: 'radio', options: []
        }), { token: admin.token });
    }
    if (number === 18) {
        return api('post', questionPath(section.id), questionBody({
            type_question: 'radio',
            options: [
                { option_text: 'One', option_value: 'same', order: '1' },
                { option_text: 'Two', option_value: 'same', order: '2' }
            ]
        }), { token: admin.token });
    }
    if (number === 19) {
        let last;
        for (const options of [
            [{ option_value: 'x', order: '1' }],
            [{ option_text: 'Option', order: '1' }],
            [{ option_text: 'Option', option_value: 'x' }]
        ]) {
            last = await api('post', questionPath(section.id), questionBody({
                type_question: 'radio', options
            }), { token: admin.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 20) {
        let last;
        for (const body of [
            questionBody({ order: 'abc' }),
            questionBody({ trigger_image_upload: '2' }),
            questionBody({
                type_question: 'radio',
                options: [{ option_text: 'x'.repeat(201), option_value: 'x', order: '1' }]
            })
        ]) {
            last = await api('post', questionPath(section.id), body, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 21) {
        const options = Array.from({ length: 51 }, (_, index) => ({
            option_text: `Option ${index}`,
            option_value: `v${index}`,
            order: String(index)
        }));
        return api('post', questionPath(section.id), questionBody({
            type_question: 'radio', options
        }), { token: admin.token });
    }
    if (number === 23) {
        const questionId = uniqueQuestionId();
        const body = questionBody({ question_id: questionId });
        expectCode(await api('post', questionPath(section.id), body, { token: admin.token }), OK);
        expectCode(await api('post', questionPath(section.id), body, { token: admin.token }), '9996');
        const anotherSection = await createSection(template.code);
        expectCode(await api('post', questionPath(anotherSection.id), body, { token: admin.token }), '9996');
        const otherTemplate = await createTemplate();
        const foreignSection = await createSection(otherTemplate.code);
        return api('post', questionPath(foreignSection.id), body, { token: admin.token });
    }
    if (number === 24) {
        const parent = await createQuestion(section.id);
        expectCode(await api('delete', questionEditPath(parent.id), undefined, { token: admin.token }), OK);
        return api('post', questionPath(section.id), questionBody({
            parent_question_id: parent.id
        }), { token: admin.token });
    }
    if (number === 25) {
        const otherTemplate = await createTemplate();
        const otherSection = await createSection(otherTemplate.code);
        const parent = await createQuestion(otherSection.id);
        return api('post', questionPath(section.id), questionBody({
            parent_question_id: parent.id
        }), { token: admin.token });
    }
    if (number === 26) {
        await prepareTemplateInUse(template.code);
        return api('post', questionPath(section.id), base, { token: admin.token });
    }
    if (number === 27) {
        const body = questionBody({ question_id: uniqueQuestionId('QCONCURRENT') });
        const responses = await Promise.all(Array.from({ length: 5 }, () =>
            api('post', questionPath(section.id), body, { token: admin.token })));
        expect(responses.filter(response => String(response.body?.code) === OK)).toHaveLength(1);
        expect(responses.filter(response => String(response.body?.code) === '9996')).toHaveLength(4);
        return responses.find(response => String(response.body?.code) === OK);
    }
    if (number === 28) {
        return api('post', questionPath(section.id), '{"question_id":', {
            token: admin.token, contentType: 'application/json'
        });
    }
    throw new Error(`Unhandled Week 5 question creation case ${number}.`);
}

async function runQuestionEdit(number) {
    if (number >= 20) return runAuthCase('QED', number);
    if (number === 14) {
        const first = await createQuestionFixture('radio');
        const other = await createQuestionFixture('radio');
        const firstOptions = await getQuestionOptions(first.template.code, first.question.id);
        const otherOptions = await getQuestionOptions(other.template.code, other.question.id);
        if (!otherOptions[0]?.id || !firstOptions[0]?.id || !firstOptions[1]?.id) {
            throw new Error('Choice question detail must return at least two option IDs.');
        }
        const endpoint = questionEditPath(first.question.id);
        expectCode(await api('put', endpoint, {
            options: [{ id: otherOptions[0].id, option_text: 'Foreign', option_value: 'foreign', order: '1' }]
        }, { token: admin.token }), '9992');
        expect((await getQuestionOptions(first.template.code, first.question.id)).map(option => option.id))
            .toEqual(firstOptions.map(option => option.id));
        expectCode(await api('put', endpoint, {
            options: [optionPayload(firstOptions[1])]
        }, { token: admin.token }), OK);
        return api('put', endpoint, {
            options: [{
                id: firstOptions[0].id,
                option_text: firstOptions[0].option_text,
                option_value: firstOptions[0].option_value,
                order: String(firstOptions[0].order)
            }]
        }, { token: admin.token });
    }
    if (number === 15) {
        const { question } = await createQuestionFixture();
        const endpoint = questionEditPath(question.id);
        expectCode(await api('delete', endpoint, undefined, { token: admin.token }), OK);
        return api('put', endpoint, { question_text: 'After question deletion' }, { token: admin.token });
    }
    if (number === 16) {
        const { template, section, question } = await createQuestionFixture();
        expectCode(await api('delete', questionEditPath(question.id), undefined, { token: admin.token }), OK);
        expect(findQuestion(await templateDetail(template.code), question.id)).toBeUndefined();
        return api('put', questionEditPath(question.id), { question_text: 'After delete' }, { token: admin.token });
    }
    const { template, section, question } = [3, 4, 5, 11, 12, 13].includes(number)
        ? await createQuestionFixture('radio')
        : await createQuestionFixture();
    const endpoint = questionEditPath(question.id);
    if (number === 17) {
        await prepareTemplateInUse(template.code);
        return api('put', endpoint, { question_text: uniqueName('Locked') }, { token: admin.token });
    }
    if (number === 7) return api('put', endpoint, {}, { token: admin.token });
    if (number === 8) {
        let last;
        for (const body of [
            { question_text: 123 }, { order: 1 }, { show_if_answer: {} },
            { options: 'abc' }, { options: [{ id: 1, option_text: 1 }] }
        ]) {
            last = await api('put', endpoint, body, { token: admin.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 9) {
        let last;
        for (const question_text of ['', '   ', 'x'.repeat(501), '<b>']) {
            last = await api('put', endpoint, { question_text }, { token: admin.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 10) {
        expectCode(await api('put', endpoint, { order: 'abc' }, { token: admin.token }), '1004');
        return api('put', endpoint, { show_if_answer: 'not json' }, { token: admin.token });
    }
    if (number === 11) {
        return api('put', endpoint, { options: [{ option_text: 'Invalid', option_value: 'x' }] }, { token: admin.token });
    }
    if (number === 12) {
        return api('put', endpoint, { options: [] }, { token: admin.token });
    }
    if (number === 13) {
        return api('put', endpoint, {
            options: [
                { option_text: 'One', option_value: 'same', order: '1' },
                { option_text: 'Two', option_value: 'same', order: '2' }
            ]
        }, { token: admin.token });
    }
    if (number === 18) {
        const before = assertQuestion(await templateDetail(template.code), question.id).question;
        const response = await api('put', endpoint, {
            question_id: uniqueQuestionId(),
            section_id: 999999999,
            type_question: 'radio',
            question_text: uniqueName('MassAssigned')
        }, { token: admin.token });
        expectCode(response, OK);
        const after = assertQuestion(await templateDetail(template.code), question.id).question;
        expect(after.question_id).toBe(before.question_id);
        expect(String(after.section_id)).toBe(String(before.section_id));
        expect(after.type_question).toBe(before.type_question);
        return response;
    }
    if (number === 19) {
        return api('put', endpoint, '{"question_text":', {
            token: admin.token, contentType: 'application/json'
        });
    }

    let body;
    if (number === 1) {
        body = { question_text: uniqueName('EditedQuestion'), placeholder: 'Updated placeholder', order: '3' };
    } else if (number === 2) {
        body = { show_if_answer: '{"Q_PARENT":"yes"}' };
    } else if (number === 3) {
        const options = await getQuestionOptions(template.code, question.id);
        if (!options[0]?.id) throw new Error('Choice question detail must return option IDs.');
        body = { options: [
            { ...optionPayload(options[0]), option_text: 'Updated option' },
            optionPayload(options[1])
        ] };
    } else if (number === 4) {
        const options = await getQuestionOptions(template.code, question.id);
        if (!options[0]?.id) throw new Error('Choice question detail must return option IDs.');
        body = { options: [
            optionPayload(options[0]),
            optionPayload(options[1]),
            { option_text: 'New option', option_value: uniqueName('value'), order: '3' }
        ] };
    } else if (number === 5) {
        const options = await getQuestionOptions(template.code, question.id);
        if (!options[0]?.id) throw new Error('Choice question detail must return option IDs.');
        body = { options: [optionPayload(options[0])] };
    } else if (number === 6) {
        body = { question_text: uniqueName('VisibleEdit'), order: '4' };
    } else {
        throw new Error(`Unhandled Week 5 question edit case ${number}.`);
    }
    const response = await api('put', endpoint, body, { token: admin.token });
    expectCode(response, OK);
    const updated = assertQuestion(await templateDetail(template.code), question.id).question;
    for (const [field, value] of Object.entries(body)) {
        if (field !== 'options') expect(String(updated[field])).toBe(String(value));
    }
    if (number === 3) expect(updated.options[0].option_text).toBe('Updated option');
    if (number === 4) expect(updated.options).toHaveLength(3);
    if (number === 5) expect(updated.options).toHaveLength(1);
    return response;
}

async function runQuestionDelete(number) {
    if (number >= 8) return runAuthCase('QDL', number);
    if (number === 6) {
        const { section } = await createSectionFixture();
        const question = await createQuestion(section.id);
        const endpoint = questionEditPath(question.id);
        expectCode(await api('delete', endpoint, undefined, { token: admin.token }), OK);
        return api('delete', endpoint, undefined, { token: admin.token });
    }
    const { template, section } = await createSectionFixture();
    if (number === 7) {
        const question = await createQuestion(section.id);
        await prepareTemplateInUse(template.code);
        return api('delete', questionEditPath(question.id), undefined, { token: admin.token });
    }
    if (number === 4) {
        const parent = await createQuestion(section.id);
        const child = await createQuestion(section.id, { parent_question_id: parent.id });
        const deleted = await api('delete', questionEditPath(parent.id), undefined, { token: admin.token });
        expectCode(deleted, OK);
        const childAfter = assertQuestion(await templateDetail(template.code), child.id).question;
        expect(childAfter.parent_question_id == null).toBe(true);
        return deleted;
    }
    const question = number === 3
        ? await createChoiceQuestion(section.id)
        : await createQuestion(section.id);
    const endpoint = questionEditPath(question.id);
    const optionsBefore = number === 3 ? await getQuestionOptions(template.code, question.id) : [];
    const deleted = await api('delete', endpoint, undefined, { token: admin.token });
    if (number === 1) {
        expect(dataOf(deleted)).toEqual({});
        return deleted;
    }
    if (number === 2) {
        expectCode(deleted, OK);
        expect(findQuestion(await templateDetail(template.code), question.id)).toBeUndefined();
        return deleted;
    }
    if (number === 3) {
        expectCode(deleted, OK);
        expect(optionsBefore.length).toBeGreaterThan(0);
        expect(findQuestion(await templateDetail(template.code), question.id)).toBeUndefined();
        return deleted;
    }
    if (number === 5) {
        expectCode(deleted, OK);
        expect(findQuestion(await templateDetail(template.code), question.id)).toBeUndefined();
        return api('delete', endpoint, undefined, { token: admin.token });
    }
    throw new Error(`Unhandled Week 5 question delete case ${number}.`);
}

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    if (prefix === 'SSC') return runSectionCreate(number);
    if (prefix === 'SED') return runSectionEdit(number);
    if (prefix === 'SDL') return runSectionDelete(number);
    if (prefix === 'SQC') return runQuestionCreate(number);
    if (prefix === 'QED') return runQuestionEdit(number);
    if (prefix === 'QDL') return runQuestionDelete(number);
    throw new Error(`Unknown Week 5 case group "${prefix}".`);
}

async function cleanupSet(set, method, routeFor) {
    const errors = [];
    for (const value of [...set]) {
        try {
            const response = await api(method, routeFor(value), undefined, { token: admin?.token });
            if (![OK, '9992'].includes(String(response?.body?.code))) {
                throw new Error(`cleanup returned code ${response?.body?.code}`);
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
    if (resources.adapterFixtureIds.size) {
        try {
            // Cleanup is intentionally constrained to the exact opaque IDs returned by the
            // Week 5 fixture hook; no template, section, question, or other DB-wide cleanup.
            await adapterCall('cleanupWeek5Fixtures', {
                fixtureIds: [...resources.adapterFixtureIds]
            });
            resources.adapterFixtureIds.clear();
        } catch (error) {
            errors.push(`adapter fixtures: ${error.message}`);
        }
    }
    for (const [label, set, method, route] of [
        ['questions', resources.questions, 'delete', id => questionEditPath(id)],
        ['sections', resources.sections, 'delete', id => `/api/templates/sections/${encodeURIComponent(id)}`],
        ['templates', resources.templates, 'delete', code => `/api/templates/${encodeURIComponent(code)}`]
    ]) {
        errors.push(...(await cleanupSet(set, method, route)).map(error => `${label}: ${error}`));
    }
    if (errors.length) throw new Error(errors.join('; '));
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
});

afterEach(cleanupCase);

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['case cleanup', cleanupCase],
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

describe(`Target ${config.targetName} - Week 5 template sections and questions`, () => {
    describe.each(groups)('Week 5 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            expectCode(await runCase(id), expected);
        });
    });
});
