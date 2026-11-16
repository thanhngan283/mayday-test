const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    CQG: {
        codes: '1000,1000,9998,9998,9998,9998',
        titles: [
            'patient receives screening questions and options',
            'doctor, nurse, and admin can read screening questions',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    CLS: {
        codes: '1000,1000,1002,1002,1002,1003,1002,1004,1004,9992,9992,9992,1003,9998,9998,9998,9998',
        titles: [
            'matching answers resolve the seeded template',
            'identical answers resolve deterministically',
            'answers are required',
            'each answer requires question_id and option_value',
            'all required screening questions must be answered',
            'answers and answer fields reject invalid types',
            'empty answers are rejected',
            'duplicate question ids are rejected',
            'more than 50 answers are rejected',
            'unknown question id is rejected',
            'option value not belonging to the question is rejected',
            'unmapped answer combination is rejected',
            'malformed JSON',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MCR: {
        codes: '1000,1000,1000,1000,1000,1000,1002,1002,1002,1003,1003,1004,1004,1004,9992,1004,1004,1004,9992,9992,9992,9992,9992,9992,1003,9998,9998,9998,9998,1009',
        titles: [
            'patient creates a pending record for self',
            'record creation persists text, option, and JSON answers',
            'patient_id from the request cannot override the signed-in patient',
            'doctor creates an assigned in-progress record',
            'nurse creates an unassigned pending record',
            'one patient can create multiple records',
            'template_id is required',
            'doctor must specify patient_id',
            'answer must contain an option, text, or value',
            'record fields reject invalid types',
            'answer_value must be an object',
            'non-positive patient ids are rejected',
            'staff accounts cannot be record patients',
            'malformed template ids are rejected',
            'question from another template is rejected',
            'duplicate answer question ids are rejected',
            'oversized or unsafe answer text is rejected',
            'more than 200 answers are rejected',
            'unknown patient id is rejected',
            'unknown template id is rejected',
            'inactive template is treated as unavailable',
            'unknown question id is rejected',
            'option id from another question is rejected',
            'invalid answers do not partially create a record',
            'malformed JSON',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token',
            'admin is not allowed to create records'
        ]
    },
    MRL: {
        codes: '1000,1000,1000,1000,1000,1000,1000,1000,1004,1004,1004,1004,1003,1003,9998,9998,9998,9998,1009',
        titles: [
            'doctor receives the default record list',
            'nurse and admin can list records',
            'every supported status filter returns matching records',
            'patient_id filter returns only that patient',
            'status and patient_id filters combine',
            'patient without records gets an empty list',
            'pagination uses distinct records and stable totals',
            'page beyond the result set is empty',
            'limit above 100 is rejected',
            'zero and negative page or limit are rejected',
            'unknown and incorrectly cased statuses are rejected',
            'non-positive patient ids are rejected',
            'page, limit, and patient_id reject non-numeric values',
            'SQL-like query values are validated without exposing records',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token',
            'patient cannot list all records'
        ]
    },
    MRG: {
        codes: '1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        titles: [
            'patient reads their own record',
            'staff reads a record',
            'patient cannot read another patient record',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record id returns not found',
            'deleted record id returns not found',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MRS: {
        codes: '1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        titles: [
            'patient reads their own record summary',
            'staff reads a record summary',
            'patient cannot read another patient summary',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record id returns not found',
            'deleted record id returns not found',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MRA: {
        codes: '1000,1010,1010,1010,1004,1003,1004,9992,9992,9998,9998,9998,9998,1009,1009,1009',
        titles: [
            'doctor accepts a pending record',
            'another doctor cannot reassign an accepted record',
            'the accepting doctor cannot accept the same record twice',
            'in-progress record cannot be accepted again',
            'completed and cancelled records cannot be accepted',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record id returns not found',
            'deleted record id returns not found',
            'missing authorization',
            'malformed authorization formats',
            'expired token',
            'logged-out token',
            'patient cannot accept records',
            'nurse cannot accept records',
            'admin cannot accept records'
        ]
    }
};

const groups = Object.entries(catalog).map(([prefix, definition]) => ({
    prefix,
    cases: definition.codes.split(',').map((expected, index) => ({
        id: `W6-${prefix}-${String(index + 1).padStart(2, '0')}`,
        expected,
        title: definition.titles[index]
    }))
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 110 || new Set(allCases.map(item => item.id)).size !== 110 ||
    groups.some(group => group.cases.some(item => !item.title))) {
    throw new Error(`Week 6 workbook coverage must contain exactly 110 uniquely identified cases; found ${allCases.length}.`);
}

const resources = {
    suiteFixtureIds: new Set(),
    caseFixtureIds: new Set(),
    medicalRecordIds: new Set()
};
const accountPhones = new Set();
let roles;
let fixture;
let accounts;

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') {
        throw new Error(`The target adapter must implement ${name}().`);
    }
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({ ...values, expectedDatabaseName: config.databaseName });
}

function uniqueName(prefix = 'week6') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
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

function totalOf(response) {
    const value = response?.body?.total ?? dataOf(response)?.total;
    return Number(value);
}

function recordIdOf(response) {
    const value = dataOf(response)?.medical_record_id;
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
        throw new Error('Week 6 record creation did not return a positive data.medical_record_id.');
    }
    return String(value);
}

async function api(method, endpoint, body, {
    token,
    authorization,
    contentType,
    query,
    rawBody
} = {}) {
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (contentType) call = call.set('Content-Type', contentType);
    if (query) call = call.query(query);
    if (rawBody !== undefined) {
        call = call.set('Content-Type', contentType || 'application/json').send(rawBody);
    } else if (body !== undefined) {
        call = call.send(body);
    }
    return call;
}

async function login(account) {
    const response = await api('post', '/api/auth/login', {
        phone: account.phone,
        password: account.password
    });
    expectCode(response, OK);
    const token = dataOf(response)?.token;
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error(`Week 6 login for ${account.role} did not return data.token.`);
    }
    account.token = token;
    return account;
}

async function registerAccount(accountName, roleName, roleId) {
    const account = {
        role: roleName,
        fullName: `Mayday Week 6 ${accountName}`,
        phone: `09${crypto.randomInt(10000000, 100000000)}`,
        password: `Mayday-${crypto.randomBytes(12).toString('hex')}`
    };
    accountPhones.add(account.phone);
    const signup = await api('post', '/api/auth/signup', {
        full_name: account.fullName,
        phone: account.phone,
        password: account.password
    });
    expectCode(signup, OK);
    account.userId = Number(dataOf(signup)?.user_id);
    if (!Number.isInteger(account.userId) || account.userId <= 0) {
        throw new Error(`Week 6 ${accountName} signup did not return a positive data.user_id.`);
    }
    const promoted = await adapterCall('promoteUser', {
        phone: account.phone,
        roleId
    });
    if (Number(promoted?.roleId) !== roleId) {
        throw new Error(`Adapter failed to promote the Week 6 ${accountName} account.`);
    }
    account.roleId = roleId;
    await login(account);
    return account;
}

async function recordFixture({
    patientId = accounts.patientA.userId,
    templateId = fixture.template.id,
    status = 'pending',
    assignedDoctorId = null,
    createdBy = null
} = {}) {
    const result = await adapterCall('prepareWeek6MedicalRecord', {
        uniquePrefix: uniqueName('W6Record'),
        patientId,
        templateId,
        status,
        assignedDoctorId,
        createdBy
    });
    if (typeof result?.fixtureId !== 'string' || !result.fixtureId ||
        !Number.isInteger(Number(result?.medicalRecordId)) || Number(result.medicalRecordId) <= 0) {
        throw new Error('prepareWeek6MedicalRecord() must return fixtureId and positive medicalRecordId.');
    }
    resources.caseFixtureIds.add(result.fixtureId);
    return {
        id: String(result.medicalRecordId),
        fixtureId: result.fixtureId,
        record: result.record || {}
    };
}

async function createRecord(account, body = {}, { token = account.token } = {}) {
    const response = await api('post', '/api/medical_records', body, { token });
    if (String(response?.body?.code) === OK) resources.medicalRecordIds.add(recordIdOf(response));
    return response;
}

function recordEndpoint(id) {
    return `/api/medical_records/${encodeURIComponent(String(id))}`;
}

function summaryEndpoint(id) {
    return `${recordEndpoint(id)}/summary`;
}

function acceptEndpoint(id) {
    return `${recordEndpoint(id)}/accept`;
}

function templateEndpoint(code) {
    return `/api/templates/${encodeURIComponent(String(code))}`;
}

function classifyBody(answers = fixture.classification.validAnswers) {
    return { answers };
}

function createBody(overrides = {}) {
    return {
        template_id: fixture.template.id,
        ...overrides
    };
}

function validRecordAnswers() {
    return fixture.recordAnswers.map(answer => ({ ...answer }));
}

async function missingRecordId() {
    const id = fixture.absentValues.medicalRecordId;
    const preflight = await api('get', recordEndpoint(id), undefined, { token: accounts.admin.token });
    expectCode(preflight, '9992');
    return String(id);
}

async function authCase(kind, method, endpoint, body, account, extras = {}) {
    if (kind === 'missing') return api(method, endpoint, body, extras);
    if (kind === 'invalid') {
        const signedIn = await login(account);
        const parts = signedIn.token.split('.');
        if (parts.length !== 3 || !parts[2]) throw new Error('Login did not return a JWT-shaped token.');
        parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
        let last;
        for (const authorization of [
            'Bearer abc',
            `Bearer ${parts.join('.')}`,
            signedIn.token,
            'Bearer '
        ]) {
            last = await api(method, endpoint, body, { ...extras, authorization });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterCall('getExpiredToken', { phone: account.phone });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error(`getExpiredToken() returned no expired token for ${account.phone}.`);
        return api(method, endpoint, body, { ...extras, token });
    }
    if (kind === 'logout') {
        const signedIn = await login(account);
        expectCode(await api('post', '/api/auth/logout', {}, { token: signedIn.token }), OK);
        return api(method, endpoint, body, { ...extras, token: signedIn.token });
    }
    throw new Error(`Unknown Week 6 auth case "${kind}".`);
}

function questionListFrom(response) {
    const data = dataOf(response);
    return Array.isArray(data) ? data : data?.questions || [];
}

function assertScreeningQuestionShape(questions) {
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
        expect(question).toEqual(expect.objectContaining({
            question_id: expect.anything(),
            question_text: expect.any(String),
            type_question: expect.any(String),
            options: expect.any(Array)
        }));
        expect(question.options.length).toBeGreaterThan(0);
        for (const option of question.options) {
            expect(option.id).toEqual(expect.any(Number));
            expect(option.option_text).toEqual(expect.any(String));
            expect(option.option_value).toBeDefined();
        }
    }
}

async function createQuestionList() {
    return api('get', '/api/medical_records/classify-questions', undefined, {
        token: accounts.patientA.token
    });
}

async function classify(answers, token = accounts.patientA.token) {
    return api('post', '/api/medical_records/classify', classifyBody(answers), { token });
}

async function assertRecordResponse(response, { patientId, status, doctorId, creatorId } = {}) {
    const data = dataOf(response);
    expect(data).toEqual(expect.objectContaining({
        medical_record_id: expect.any(Number),
        patient_id: expect.any(Number),
        template_id: expect.anything(),
        status: expect.any(String),
        created_at: expect.anything()
    }));
    if (patientId !== undefined) expect(Number(data.patient_id)).toBe(Number(patientId));
    if (status !== undefined) expect(data.status).toBe(status);
    if (doctorId !== undefined) {
        if (doctorId === null) expect(data.assigned_doctor_id == null).toBe(true);
        else expect(Number(data.assigned_doctor_id)).toBe(Number(doctorId));
    }
    if (creatorId !== undefined) expect(Number(data.created_by)).toBe(Number(creatorId));
    return data;
}

async function listRecords(query = {}, token = accounts.doctor.token) {
    return api('get', '/api/medical_records/all', undefined, { token, query });
}

async function recordDetail(id, token = accounts.doctor.token) {
    return api('get', recordEndpoint(id), undefined, { token });
}

async function recordSummary(id, token = accounts.doctor.token) {
    return api('get', summaryEndpoint(id), undefined, { token });
}

async function runAuthCase(prefix, number) {
    const endpoint = {
        CQG: '/api/medical_records/classify-questions',
        CLS: '/api/medical_records/classify',
        MCR: '/api/medical_records',
        MRL: '/api/medical_records/all',
        MRG: recordEndpoint(fixture.absentValues.medicalRecordId),
        MRS: summaryEndpoint(fixture.absentValues.medicalRecordId),
        MRA: acceptEndpoint(fixture.absentValues.medicalRecordId)
    }[prefix];
    const method = prefix === 'CQG' || prefix === 'MRG' || prefix === 'MRS' || prefix === 'MRL'
        ? 'get'
        : 'post';
    const body = prefix === 'CLS' ? classifyBody() : prefix === 'MCR' ? createBody() : {};
    const offset = { CQG: 2, CLS: 13, MCR: 25, MRL: 14, MRG: 7, MRS: 7, MRA: 9 }[prefix];
    const kind = number - offset;
    const kindName = { 1: 'missing', 2: 'invalid', 3: 'expired', 4: 'logout' }[kind];
    const account = prefix === 'MRA'
        ? accounts.doctorA
        : prefix === 'MCR' && number === 30
            ? accounts.admin
            : accounts.patientA;
    return authCase(kindName, method, endpoint, body, account);
}

async function runClassifyQuestions(number) {
    if (number === 1) {
        const response = await createQuestionList();
        expectCode(response, OK);
        assertScreeningQuestionShape(questionListFrom(response));
        return response;
    }
    if (number === 2) {
        let last;
        for (const account of [accounts.doctor, accounts.nurse, accounts.admin]) {
            last = await api('get', '/api/medical_records/classify-questions', undefined, {
                token: account.token
            });
            expectCode(last, OK);
            assertScreeningQuestionShape(questionListFrom(last));
        }
        return last;
    }
    return runAuthCase('CQG', number);
}

async function runClassify(number) {
    if (number >= 14) return runAuthCase('CLS', number);
    if (number === 1 || number === 2) {
        const answers = fixture.classification.validAnswers;
        const first = await classify(answers);
        expectCode(first, OK);
        const result = dataOf(first);
        expect(String(result?.template_id)).toBe(String(fixture.template.id));
        expect(result?.template_name).toEqual(expect.any(String));
        const detail = await api('get', templateEndpoint(fixture.template.code), undefined, {
            token: accounts.admin.token
        });
        expectCode(detail, OK);
        expect(String(dataOf(detail)?.template_id ?? dataOf(detail)?.id)).toBe(String(fixture.template.id));
        expect(result.template_name).toBe(fixture.template.name);
        if (number === 1) return first;
        const second = await classify(answers);
        expectCode(second, OK);
        expect(dataOf(second)).toEqual(dataOf(first));
        return second;
    }
    if (number === 3) return classify(undefined);
    if (number === 4) {
        const [first, second] = fixture.classification.validAnswers;
        return classify([
            { option_value: first.option_value },
            { question_id: second.question_id }
        ]);
    }
    if (number === 5) {
        if (fixture.classification.validAnswers.length < 2) {
            throw new Error('Week 6 screening fixture must include at least two required questions.');
        }
        return classify(fixture.classification.validAnswers.slice(0, 1));
    }
    if (number === 6) {
        let last;
        for (const answers of ['abc', {}, ['a'], [{ question_id: 123, option_value: 'x' }], [
            { question_id: fixture.screeningQuestions[0].question_id, option_value: 1 }
        ]]) {
            last = await classify(answers);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) return classify([]);
    if (number === 8) {
        const answer = fixture.classification.validAnswers[0];
        return classify([answer, { ...answer }]);
    }
    if (number === 9) {
        const answers = Array.from({ length: 51 }, (_, index) =>
            fixture.classification.validAnswers[index % fixture.classification.validAnswers.length]);
        return classify(answers);
    }
    if (number === 10) {
        return classify([{ question_id: fixture.absentValues.questionId, option_value: 'unknown' }]);
    }
    if (number === 11) {
        return classify([{
            question_id: fixture.screeningQuestions[0].question_id,
            option_value: fixture.absentValues.optionValue
        }]);
    }
    if (number === 12) return classify(fixture.classification.noMatchAnswers);
    if (number === 13) {
        return api('post', '/api/medical_records/classify', undefined, {
            token: accounts.patientA.token,
            rawBody: '{"answers":'
        });
    }
    throw new Error(`Unhandled Week 6 classify case ${number}.`);
}

async function runMedicalRecordCreate(number) {
    if (number >= 26 && number <= 29) return runAuthCase('MCR', number);
    if (number === 30) return api('post', '/api/medical_records', createBody(), {
        token: accounts.admin.token
    });
    if (number === 1) {
        const response = await createRecord(accounts.patientA, createBody());
        expectCode(response, OK);
        const id = recordIdOf(response);
        const detail = await recordDetail(id, accounts.patientA.token);
        expectCode(detail, OK);
        await assertRecordResponse(detail, {
            patientId: accounts.patientA.userId,
            status: 'pending',
            doctorId: null,
            creatorId: accounts.patientA.userId
        });
        expect(dataOf(detail).instructions == null).toBe(true);
        return response;
    }
    if (number === 2) {
        const body = createBody({ answers: validRecordAnswers() });
        const response = await createRecord(accounts.patientA, body);
        expectCode(response, OK);
        const answerResponse = await api(
            'get',
            `${recordEndpoint(recordIdOf(response))}/answers`,
            undefined,
            { token: accounts.patientA.token }
        );
        expectCode(answerResponse, OK);
        expect(itemsOf(answerResponse)).toHaveLength(fixture.recordAnswers.length);
        return response;
    }
    if (number === 3) {
        const response = await createRecord(accounts.patientA, createBody({
            patient_id: accounts.patientB.userId
        }));
        expectCode(response, OK);
        const detail = await recordDetail(recordIdOf(response), accounts.patientA.token);
        expectCode(detail, OK);
        await assertRecordResponse(detail, { patientId: accounts.patientA.userId });
        return response;
    }
    if (number === 4 || number === 5) {
        const account = number === 4 ? accounts.doctor : accounts.nurse;
        const response = await createRecord(account, createBody({ patient_id: accounts.patientA.userId }));
        expectCode(response, OK);
        const expectedStatus = number === 4 ? 'in_progress' : 'pending';
        const expectedDoctor = number === 4 ? accounts.doctor.userId : null;
        const detail = await recordDetail(recordIdOf(response), accounts.admin.token);
        expectCode(detail, OK);
        await assertRecordResponse(detail, {
            patientId: accounts.patientA.userId,
            status: expectedStatus,
            doctorId: expectedDoctor,
            creatorId: account.userId
        });
        return response;
    }
    if (number === 6) {
        const first = await createRecord(accounts.patientA, createBody());
        expectCode(first, OK);
        const second = await createRecord(accounts.patientA, createBody());
        expectCode(second, OK);
        expect(recordIdOf(first)).not.toBe(recordIdOf(second));
        const detail = await recordDetail(recordIdOf(second), accounts.patientA.token);
        expectCode(detail, OK);
        await assertRecordResponse(detail, { patientId: accounts.patientA.userId });
        return second;
    }
    if (number === 7) {
        let last;
        for (const body of [{}, null]) {
            last = await createRecord(accounts.patientA, body);
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 8) {
        return createRecord(accounts.doctor, createBody());
    }
    if (number === 9) {
        return createRecord(accounts.patientA, createBody({
            answers: [{ question_id: fixture.recordQuestions[0].question_id }]
        }));
    }
    if (number === 10) {
        const invalidBodies = [
            { template_id: 123, patient_id: accounts.patientA.userId },
            { ...createBody(), patient_id: 'abc' },
            { ...createBody(), answers: 'abc' },
            { ...createBody(), answers: [{ question_id: 123, answer_text: 'x' }] },
            { ...createBody(), answers: [{ question_id: fixture.recordQuestions[1].question_id, question_option_id: 'a' }] },
            { ...createBody(), answers: [{ question_id: fixture.recordQuestions[0].question_id, answer_text: 123 }] }
        ];
        let last;
        for (const body of invalidBodies) {
            last = await createRecord(accounts.patientA, body);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 11) {
        let last;
        for (const answerValue of ['x', [], 1]) {
            last = await createRecord(accounts.patientA, createBody({
                answers: [{
                    question_id: fixture.recordQuestions[2].question_id,
                    answer_value: answerValue
                }]
            }));
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 12) {
        let last;
        for (const patientId of [0, -1]) {
            last = await createRecord(accounts.doctor, createBody({ patient_id: patientId }));
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        return createRecord(accounts.doctor, createBody({ patient_id: accounts.nurse.userId }));
    }
    if (number === 14) {
        return createRecord(accounts.patientA, { template_id: 'abc def' });
    }
    if (number === 15) {
        return createRecord(accounts.patientA, createBody({
            answers: [{ ...fixture.crossTemplateAnswer }]
        }));
    }
    if (number === 16) {
        const answer = validRecordAnswers()[0];
        return createRecord(accounts.patientA, createBody({ answers: [answer, { ...answer }] }));
    }
    if (number === 17) {
        let last;
        for (const answer_text of ['x'.repeat(2001), '<script>alert(1)</script>']) {
            last = await createRecord(accounts.patientA, createBody({
                answers: [{ question_id: fixture.recordQuestions[0].question_id, answer_text }]
            }));
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 18) {
        const answers = Array.from({ length: 201 }, (_, index) =>
            validRecordAnswers()[index % validRecordAnswers().length]);
        return createRecord(accounts.patientA, createBody({ answers }));
    }
    if (number === 19) {
        return createRecord(accounts.doctor, createBody({
            patient_id: fixture.absentValues.patientId
        }));
    }
    if (number === 20) {
        return createRecord(accounts.patientA, { template_id: fixture.absentValues.templateId });
    }
    if (number === 21) {
        return createRecord(accounts.patientA, { template_id: fixture.inactiveTemplateId });
    }
    if (number === 22) {
        return createRecord(accounts.patientA, createBody({
            answers: [{
                question_id: fixture.absentValues.questionId,
                answer_text: 'unknown question'
            }]
        }));
    }
    if (number === 23) {
        return createRecord(accounts.patientA, createBody({
            answers: [{
                question_id: fixture.recordQuestions[1].question_id,
                question_option_id: fixture.foreignQuestionOptionId
            }]
        }));
    }
    if (number === 24) {
        const before = await listRecords({ patient_id: accounts.patientA.userId }, accounts.doctor.token);
        expectCode(before, OK);
        const invalid = await createRecord(accounts.patientA, createBody({
            answers: [
                validRecordAnswers()[0],
                { question_id: fixture.absentValues.questionId, answer_text: 'invalid second answer' }
            ]
        }));
        expectCode(invalid, '9992');
        expect(resources.medicalRecordIds.size).toBe(0);
        const after = await listRecords({ patient_id: accounts.patientA.userId }, accounts.doctor.token);
        expectCode(after, OK);
        expect(totalOf(after)).toBe(totalOf(before));
        return invalid;
    }
    if (number === 25) {
        return api('post', '/api/medical_records', undefined, {
            token: accounts.patientA.token,
            rawBody: '{"template_id":'
        });
    }
    throw new Error(`Unhandled Week 6 medical-record create case ${number}.`);
}

async function runMedicalRecordList(number) {
    if (number >= 15 && number <= 18) return runAuthCase('MRL', number);
    if (number === 19) {
        const response = await listRecords({}, accounts.patientA.token);
        expectCode(response, '1009');
        expect(itemsOf(response)).toEqual([]);
        return response;
    }
    if (number === 1) {
        const response = await listRecords();
        expectCode(response, OK);
        const items = itemsOf(response);
        expect(items.length).toBeLessThanOrEqual(20);
        expect(Number.isFinite(totalOf(response))).toBe(true);
        for (const item of items) {
            expect(item).toEqual(expect.objectContaining({
                medical_record_id: expect.any(Number),
                patient_id: expect.any(Number),
                template_id: expect.anything(),
                status: expect.any(String),
                created_at: expect.anything()
            }));
        }
        for (let index = 1; index < items.length; index += 1) {
            expect(new Date(items[index - 1].created_at).getTime())
                .toBeGreaterThanOrEqual(new Date(items[index].created_at).getTime());
        }
        return response;
    }
    if (number === 2) {
        let last;
        for (const account of [accounts.nurse, accounts.admin]) {
            last = await listRecords({}, account.token);
            expectCode(last, OK);
        }
        return last;
    }
    if (number === 3) {
        let last;
        for (const status of ['draft', 'pending', 'in_progress', 'completed', 'cancelled']) {
            const ownRecord = await recordFixture({ status });
            last = await listRecords({ status }, accounts.doctor.token);
            expectCode(last, OK);
            expect(itemsOf(last).every(item => item.status === status)).toBe(true);
            expect(itemsOf(last).some(item => String(item.medical_record_id) === ownRecord.id)).toBe(true);
        }
        return last;
    }
    if (number === 4) {
        const ownRecord = await recordFixture({ patientId: accounts.patientA.userId });
        const response = await listRecords({ patient_id: accounts.patientA.userId });
        expectCode(response, OK);
        expect(itemsOf(response).every(item => Number(item.patient_id) === accounts.patientA.userId)).toBe(true);
        expect(itemsOf(response).some(item => String(item.medical_record_id) === ownRecord.id)).toBe(true);
        return response;
    }
    if (number === 5) {
        const ownRecord = await recordFixture({ patientId: accounts.patientA.userId, status: 'pending' });
        await recordFixture({ patientId: accounts.patientA.userId, status: 'completed' });
        const response = await listRecords({
            patient_id: accounts.patientA.userId,
            status: 'pending'
        });
        expectCode(response, OK);
        expect(itemsOf(response).every(item =>
            Number(item.patient_id) === accounts.patientA.userId && item.status === 'pending')).toBe(true);
        expect(itemsOf(response).some(item => String(item.medical_record_id) === ownRecord.id)).toBe(true);
        return response;
    }
    if (number === 6) {
        const response = await listRecords({ patient_id: accounts.patientB.userId });
        expectCode(response, OK);
        expect(itemsOf(response)).toEqual([]);
        expect(totalOf(response)).toBe(0);
        return response;
    }
    if (number === 7) {
        const first = await recordFixture({ patientId: accounts.patientA.userId, status: 'pending' });
        const second = await recordFixture({ patientId: accounts.patientA.userId, status: 'pending' });
        const page1 = await listRecords({ patient_id: accounts.patientA.userId, limit: 1, page: 1 });
        const page2 = await listRecords({ patient_id: accounts.patientA.userId, limit: 1, page: 2 });
        expectCode(page1, OK);
        expectCode(page2, OK);
        expect(itemsOf(page1)).toHaveLength(1);
        expect(itemsOf(page2)).toHaveLength(1);
        expect(String(itemsOf(page1)[0].medical_record_id)).not.toBe(String(itemsOf(page2)[0].medical_record_id));
        expect(totalOf(page1)).toBe(totalOf(page2));
        expect(totalOf(page1)).toBeGreaterThanOrEqual(2);
        expect([String(itemsOf(page1)[0].medical_record_id), String(itemsOf(page2)[0].medical_record_id)])
            .toEqual(expect.arrayContaining([first.id, second.id]));
        return page2;
    }
    if (number === 8) {
        await recordFixture({ patientId: accounts.patientA.userId });
        const response = await listRecords({
            patient_id: accounts.patientA.userId,
            page: 9999
        });
        expectCode(response, OK);
        expect(itemsOf(response)).toEqual([]);
        return response;
    }
    if (number === 9) return listRecords({ limit: 101 });
    if (number === 10) {
        let last;
        for (const query of [
            { page: 0 }, { page: -1 }, { limit: 0 }, { limit: -1 }
        ]) {
            last = await listRecords(query);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 11) {
        let last;
        for (const status of ['abc', 'PENDING']) {
            last = await listRecords({ status });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        let last;
        for (const patient_id of [0, -1]) {
            last = await listRecords({ patient_id });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        let last;
        for (const query of [
            { page: 'abc' },
            { limit: '1.5' },
            { patient_id: 'abc' },
            { patient_id: '1.5' }
        ]) {
            last = await listRecords(query);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 14) {
        const malformedPatient = await listRecords({
            patient_id: '1 OR 1=1'
        });
        expectCode(malformedPatient, '1003');
        // Workbook column G says 1003 for this combined SQL-like-input case,
        // while its decision note explicitly assigns status injection code 1004.
        // Keep both assertions separate and return the column-G patient_id case.
        const malformedStatus = await listRecords({
            status: "x' OR '1'='1"
        });
        expectCode(malformedStatus, '1004');
        return malformedPatient;
    }
    throw new Error(`Unhandled Week 6 medical-record list case ${number}.`);
}

async function runRecordRead(prefix, number) {
    const endpointFor = prefix === 'MRG' ? recordEndpoint : summaryEndpoint;
    if (number >= 8) return runAuthCase(prefix, number);
    if (number === 1 || number === 2 || number === 3) {
        const patientId = number === 3 ? accounts.patientB.userId : accounts.patientA.userId;
        const record = await recordFixture({ patientId, status: 'pending' });
        const token = number === 1 ? accounts.patientA.token : number === 3
            ? accounts.patientB.token
            : accounts.nurse.token;
        const response = await api('get', endpointFor(record.id), undefined, { token });
        if (number === 3) {
            expectCode(response, '1009');
            expect(JSON.stringify(response.body)).not.toContain(String(accounts.patientA.userId));
            return response;
        }
        expectCode(response, OK);
        if (prefix === 'MRG') {
            const data = await assertRecordResponse(response, {
                patientId: accounts.patientA.userId,
                status: 'pending'
            });
            for (const field of ['assigned_doctor_id', 'instructions', 'completed_at']) {
                expect(Object.prototype.hasOwnProperty.call(data, field)).toBe(true);
            }
            expect(data.created_by).toEqual(expect.any(Number));
            expect(data.updated_at).toBeDefined();
        } else {
            const data = dataOf(response);
            expect(data).toEqual(expect.objectContaining({
                medical_record_id: expect.any(Number),
                status: 'pending',
                patient_name: accounts.patientA.fullName,
                created_at: expect.anything()
            }));
            expect(data).not.toHaveProperty('answers');
            expect(data).not.toHaveProperty('instructions');
        }
        return response;
    }
    if (number === 4) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await api('get', endpointFor(id), undefined, { token: accounts.doctor.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 5) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await api('get', endpointFor(id), undefined, { token: accounts.doctor.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 6) {
        const id = await missingRecordId();
        return api('get', endpointFor(id), undefined, { token: accounts.doctor.token });
    }
    if (number === 7) {
        const record = await recordFixture({ patientId: accounts.patientA.userId });
        const cleanup = await adapterCall('cleanupWeek6Fixtures', {
            fixtureIds: [record.fixtureId],
            medicalRecordIds: [],
            patientIds: []
        });
        if (cleanup?.cleaned !== true) {
            throw new Error('cleanupWeek6Fixtures() must return { cleaned: true } after deleting exact fixture IDs.');
        }
        resources.caseFixtureIds.delete(record.fixtureId);
        return api('get', endpointFor(record.id), undefined, { token: accounts.doctor.token });
    }
    throw new Error(`Unhandled Week 6 ${prefix} case ${number}.`);
}

async function runAccept(number) {
    if (number >= 10 && number <= 13) return runAuthCase('MRA', number);
    if (number >= 14) {
        const record = await recordFixture({ status: 'pending' });
        const account = number === 14 ? accounts.patientA : number === 15 ? accounts.nurse : accounts.admin;
        const denied = await api('post', acceptEndpoint(record.id), {}, { token: account.token });
        expectCode(denied, '1009');
        const unchanged = await recordDetail(record.id, accounts.doctorA.token);
        expectCode(unchanged, OK);
        expect(dataOf(unchanged).status).toBe('pending');
        return denied;
    }
    if (number === 1) {
        const created = await createRecord(accounts.patientA, createBody());
        expectCode(created, OK);
        const id = recordIdOf(created);
        const accepted = await api('post', acceptEndpoint(id), {}, { token: accounts.doctorA.token });
        expectCode(accepted, OK);
        const detail = await recordDetail(id, accounts.doctorA.token);
        expectCode(detail, OK);
        await assertRecordResponse(detail, {
            patientId: accounts.patientA.userId,
            status: 'in_progress',
            doctorId: accounts.doctorA.userId
        });
        return accepted;
    }
    if (number === 2 || number === 3) {
        const created = await createRecord(accounts.patientA, createBody());
        expectCode(created, OK);
        const id = recordIdOf(created);
        expectCode(await api('post', acceptEndpoint(id), {}, { token: accounts.doctorA.token }), OK);
        return api('post', acceptEndpoint(id), {}, {
            token: number === 2 ? accounts.doctorB.token : accounts.doctorA.token
        });
    }
    if (number === 4) {
        const created = await createRecord(accounts.doctorA, createBody({
            patient_id: accounts.patientA.userId
        }));
        expectCode(created, OK);
        const detail = await recordDetail(recordIdOf(created), accounts.doctorA.token);
        expectCode(detail, OK);
        expect(dataOf(detail).status).toBe('in_progress');
        return api('post', acceptEndpoint(recordIdOf(created)), {}, { token: accounts.doctorA.token });
    }
    if (number === 5) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const record = await recordFixture({ status });
            last = await api('post', acceptEndpoint(record.id), {}, { token: accounts.doctorA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 6) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await api('post', acceptEndpoint(id), {}, { token: accounts.doctorA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await api('post', acceptEndpoint(id), {}, { token: accounts.doctorA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) {
        return api('post', acceptEndpoint(await missingRecordId()), {}, { token: accounts.doctorA.token });
    }
    if (number === 9) {
        const record = await recordFixture({ status: 'pending' });
        const cleanup = await adapterCall('cleanupWeek6Fixtures', {
            fixtureIds: [record.fixtureId],
            medicalRecordIds: [],
            patientIds: []
        });
        if (cleanup?.cleaned !== true) {
            throw new Error('cleanupWeek6Fixtures() must return { cleaned: true } after deleting exact fixture IDs.');
        }
        resources.caseFixtureIds.delete(record.fixtureId);
        return api('post', acceptEndpoint(record.id), {}, { token: accounts.doctorA.token });
    }
    throw new Error(`Unhandled Week 6 accept case ${number}.`);
}

async function runCase(id) {
    const [, prefix, numberText] = id.split('-');
    const number = Number(numberText);
    if (prefix === 'CQG') return runClassifyQuestions(number);
    if (prefix === 'CLS') return runClassify(number);
    if (prefix === 'MCR') return runMedicalRecordCreate(number);
    if (prefix === 'MRL') return runMedicalRecordList(number);
    if (prefix === 'MRG' || prefix === 'MRS') return runRecordRead(prefix, number);
    if (prefix === 'MRA') return runAccept(number);
    throw new Error(`Unknown Week 6 case group "${prefix}".`);
}

async function cleanupCase() {
    if (!resources.caseFixtureIds.size && !resources.medicalRecordIds.size && !accounts) return;
    const fixtureIds = [...resources.caseFixtureIds];
    const medicalRecordIds = [...resources.medicalRecordIds];
    const patientIds = accounts
        ? [accounts.patientA.userId, accounts.patientB.userId].map(Number)
        : [];
    const result = await adapterCall('cleanupWeek6Fixtures', {
        fixtureIds,
        medicalRecordIds,
        patientIds
    });
    if (result?.cleaned !== true) {
        throw new Error('cleanupWeek6Fixtures() must return { cleaned: true } for exact suite-owned records.');
    }
    resources.caseFixtureIds.clear();
    resources.medicalRecordIds.clear();
}

async function cleanupAccounts() {
    const errors = [];
    for (const phoneNumber of [...accountPhones]) {
        try {
            await adapterCall('deleteUser', { phone: phoneNumber });
            accountPhones.delete(phoneNumber);
        } catch (error) {
            errors.push(`${phoneNumber}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(errors.join('; '));
}

beforeAll(async () => {
    // Existing adapter hook contracts used here:
    // assertTestDatabase({ expectedDatabaseName }) returns
    //   { isTestDatabase: true, databaseName: expectedDatabaseName } after inspecting its actual
    //   backend connection; getRoleIds({ expectedDatabaseName }) returns positive integer role IDs
    //   for admin, patient, doctor, and nurse; resetTestHooks({ expectedDatabaseName }) restores
    //   all backend test-only hooks; getExpiredToken({ expectedDatabaseName, phone }) returns
    //   either a JWT string or { token } that is validly signed but expired for that account.
    const db = await adapterCall('assertTestDatabase');
    if (db?.isTestDatabase !== true || db.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}".`);
    }
    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    for (const roleName of ['admin', 'patient', 'doctor', 'nurse']) {
        if (!Number.isInteger(roles?.[roleName]) || roles[roleName] <= 0) {
            throw new Error(`Adapter getRoleIds() must return a positive integer "${roleName}" role ID.`);
        }
    }
    if (roles.admin !== 1) throw new Error('The workbook specifies director/admin role ID 1.');

    // Adapter contract: prepareWeek6Fixtures({ expectedDatabaseName, uniquePrefix }) creates
    // disposable template/question fixtures only, never accounts or reused/overwritten rows.
    // It returns { fixtureIds: string[], template, inactiveTemplateId,
    // screeningQuestions, recordQuestions, recordAnswers, classification, crossTemplateQuestionId,
    // foreignQuestionOptionId, absentValues }. template is { id, code, name }; classification
    // contains validAnswers (at least two),
    // noMatchAnswers, and absentValues.questionId/optionValue are confirmed absent. absentValues
    // also supplies an unused medicalRecordId, patientId, and templateId; prefer the workbook's
    // sentinel value when it is absent, otherwise return a random preflighted absent value.
    // screeningQuestions each expose question_id/question_text/type_question/options, with at
    // least one option; recordQuestions and recordAnswers provide text, option, and JSON answers.
    // The top-level result also includes crossTemplateQuestionId, crossTemplateAnswer, and a
    // foreignQuestionOptionId belonging to a different question. classification includes
    // validAnswers, noMatchAnswers, and preflighted absent questionId/optionValue values.
    // The returned fixtureIds are opaque ownership tokens accepted by cleanupWeek6Fixtures().
    // Adapter contract: prepareWeek6MedicalRecord({ expectedDatabaseName, uniquePrefix, patientId,
    // templateId, status, assignedDoctorId, createdBy }) creates one fresh test-only record and
    // returns { fixtureId, medicalRecordId, record }; patientId must be one of this fixture's
    // patient accounts. The record status is one of draft/pending/in_progress/completed/cancelled.
    // Adapter contract: cleanupWeek6Fixtures({ expectedDatabaseName, fixtureIds, medicalRecordIds,
    // patientIds }) deletes only the exact opaque fixture IDs/API-created record IDs supplied.
    // patientIds, if supplied, must be the two patient accounts registered by this suite; adapter
    // may use them only to remove records created by this suite for those otherwise-empty accounts.
    // It returns { cleaned: true } only after successful idempotent cleanup. It must not delete
    // accounts, questions, templates, or records outside those ownership tokens/IDs.
    const prepared = await adapterCall('prepareWeek6Fixtures', {
        uniquePrefix: uniqueName('W6Suite')
    });
    if (!Array.isArray(prepared?.fixtureIds) || prepared.fixtureIds.length === 0) {
        throw new Error('prepareWeek6Fixtures() must return non-empty opaque fixtureIds.');
    }
    for (const fixtureId of prepared.fixtureIds) resources.suiteFixtureIds.add(fixtureId);
    fixture = prepared;
    if (!fixture.template || !Array.isArray(fixture.screeningQuestions) ||
        fixture.screeningQuestions.length < 2 || !Array.isArray(fixture.recordQuestions) ||
        fixture.recordQuestions.length < 3 || !Array.isArray(fixture.recordAnswers) ||
        fixture.recordAnswers.length < 3 || !fixture.inactiveTemplateId ||
        !fixture.crossTemplateQuestionId || !fixture.crossTemplateAnswer ||
        !Number.isInteger(Number(fixture.foreignQuestionOptionId)) ||
        !fixture.classification?.validAnswers || fixture.classification.validAnswers.length < 2 ||
        !fixture.classification.noMatchAnswers || !fixture.absentValues) {
        throw new Error('prepareWeek6Fixtures() returned an incomplete Week 6 fixture contract.');
    }
    accounts = {};
    for (const [name, roleName] of [
        ['patientA', 'patient'], ['patientB', 'patient'], ['doctorA', 'doctor'],
        ['doctorB', 'doctor'], ['doctor', 'doctor'], ['nurse', 'nurse'], ['admin', 'admin']
    ]) {
        accounts[name] = await registerAccount(name, roleName, roles[roleName]);
    }
});

afterEach(cleanupCase);

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['case fixtures', cleanupCase],
        ['suite fixtures', async () => {
            if (!resources.suiteFixtureIds.size) return;
            const result = await adapterCall('cleanupWeek6Fixtures', {
                fixtureIds: [...resources.suiteFixtureIds],
                medicalRecordIds: [],
                patientIds: accounts
                    ? [accounts.patientA.userId, accounts.patientB.userId].map(Number)
                    : []
            });
            if (result?.cleaned !== true) {
                throw new Error('cleanupWeek6Fixtures() must return { cleaned: true } for suite fixture IDs.');
            }
            resources.suiteFixtureIds.clear();
        }],
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

describe(`Target ${config.targetName} - Week 6 medical-record create and read`, () => {
    describe.each(groups)('Week 6 $prefix API cases', ({ cases }) => {
        test.each(cases)('$id - $title', async ({ id, expected }) => {
            expectCode(await runCase(id), expected);
        });
    });
});
