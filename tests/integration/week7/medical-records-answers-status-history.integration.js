const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    MAG: {
        codes: '1000,1000,1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        titles: [
            'returns option, text, and JSON answers',
            'reports the responder for each answer',
            'returns an empty list for a record without answers',
            'doctor, nurse, and admin can read answers',
            'patient cannot read another patient answers',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record is not found',
            'deleted record is not found',
            'missing authorization',
            'invalid authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MAS: {
        codes: '1000,1000,1000,1000,1000,1000,1002,1002,1002,1003,1003,1002,1004,9992,1004,1004,9992,9992,9992,1010,1009,1003,1004,9992,9992,1003,9998,9998,9998,9998,1009',
        titles: [
            'adds three answers and reports count',
            'overwrites an existing answer',
            'adds and overwrites in one request',
            'doctor overwrites a patient answer',
            'accepts option, text, and JSON answer forms',
            'patient writes to their pending record',
            'answers are required',
            'each answer requires question_id',
            'each answer requires an answer value',
            'answer fields reject invalid types',
            'answer_value must be an object',
            'empty answers are rejected',
            'duplicate question ids are rejected',
            'question outside the record template is rejected',
            'oversized or unsafe answer text is rejected',
            'more than 200 answers are rejected',
            'unknown question id is rejected',
            'option belonging to another question is rejected',
            'invalid batch is atomic',
            'completed and cancelled records are closed',
            'patient cannot write to another patient record',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record is not found',
            'deleted record is not found',
            'malformed JSON',
            'missing authorization',
            'invalid authorization formats',
            'expired token',
            'logged-out token',
            'admin cannot write answers'
        ]
    },
    MRE: {
        codes: '1000,1000,1000,1002,1003,1004,1004,1009,1004,1010,1010,1003,1004,9992,9992,1003,9998,9998,9998,9998,1009,1009,1009',
        titles: [
            'assigned doctor completes a record with instructions',
            'completion without instructions stores null',
            'assigned doctor cancels an in-progress record',
            'status is required',
            'status and instructions reject invalid types',
            'only completed or cancelled statuses are accepted',
            'instructions over 5000 or containing markup are rejected',
            'another doctor cannot edit the record',
            'pending record cannot be completed',
            'completed record cannot be edited again',
            'cancelled record cannot be edited again',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record is not found',
            'deleted record is not found',
            'malformed JSON',
            'missing authorization',
            'invalid authorization formats',
            'expired token',
            'logged-out token',
            'patient cannot edit a record',
            'nurse cannot edit a record',
            'admin cannot edit a record'
        ]
    },
    MRT: {
        codes: '1000,1000,1000,1002,1003,1004,1004,1010,1009,1009,1009,1003,1004,9992,9992,1003,9998,9998,9998,9998',
        titles: [
            'patient cancels their pending record',
            'assigned doctor cancels an in-progress record',
            'admin cancels an open record',
            'status is required',
            'status must be a string',
            'only cancelled is accepted',
            'patient cannot cancel an in-progress record',
            'closed record cannot be cancelled again',
            'patient cannot cancel another patient record',
            'another doctor cannot cancel the record',
            'nurse cannot cancel a record',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record is not found',
            'deleted record is not found',
            'malformed JSON',
            'missing authorization',
            'invalid authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MRH: {
        codes: '1000,1000,1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        titles: [
            'patient sees only their own history in newest-first order',
            'staff can read a patient history',
            'patient without records receives an empty list',
            'completed record history includes instructions',
            'patient cannot read another patient history',
            'patient id must be an integer',
            'non-positive and oversized patient ids are rejected',
            'unknown patient is not found',
            'staff account is not a patient',
            'missing authorization',
            'invalid authorization formats',
            'expired token',
            'logged-out token'
        ]
    },
    MRD: {
        codes: '1000,9992,9992,1000,9992,1003,1004,9992,9998,9998,9998,9998,1009,1009,1009',
        titles: [
            'admin deletes a record',
            'deleted record cannot be read',
            'deleting a record cascades its answers',
            'deleted record disappears from patient history',
            'deleting a record twice returns not found',
            'record id must be an integer',
            'non-positive and oversized record ids are rejected',
            'missing record is not found',
            'missing authorization',
            'invalid authorization formats',
            'expired authorization',
            'logged-out authorization',
            'patient cannot delete a record',
            'doctor cannot delete a record',
            'nurse cannot delete a record'
        ]
    }
};

const allCases = Object.entries(catalog).flatMap(([prefix, group]) =>
    group.codes.split(',').map((expected, index) => ({
        id: `W7-${prefix}-${String(index + 1).padStart(2, '0')}`,
        prefix,
        number: index + 1,
        expected,
        title: group.titles[index]
    }))
);
if (allCases.length !== 115 || new Set(allCases.map(item => item.id)).size !== 115 ||
    allCases.some(item => !item.title)) {
    throw new Error(`Week 7 workbook coverage must contain exactly 115 uniquely identified cases; found ${allCases.length}.`);
}

const accountPhones = new Set();
const medicalRecordIds = new Set();
const suiteFixtureIds = new Set();
const caseFixtureIds = new Set();
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

function uniqueName(prefix = 'week7') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
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
    if (Array.isArray(data?.answers)) return data.answers;
    if (Array.isArray(data?.records)) return data.records;
    return [];
}

async function api(method, endpoint, body, {
    token,
    authorization,
    rawBody
} = {}) {
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (rawBody !== undefined) {
        call = call.set('Content-Type', 'application/json').send(rawBody);
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
    if (typeof token !== 'string' || !token) {
        throw new Error(`Week 7 login for ${account.role} did not return data.token.`);
    }
    account.token = token;
    return account;
}

async function registerAccount(label, role, roleId) {
    const account = {
        role,
        fullName: `Mayday Week 7 ${label}`,
        phone: phone(),
        password: password()
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
        throw new Error(`Week 7 ${label} signup did not return a positive data.user_id.`);
    }
    const promoted = await adapterCall('promoteUser', { phone: account.phone, roleId });
    if (Number(promoted?.roleId) !== roleId) {
        throw new Error(`Adapter failed to promote the Week 7 ${label} account.`);
    }
    account.roleId = roleId;
    await login(account);
    return account;
}

function recordEndpoint(id) {
    return `/api/medical_records/${encodeURIComponent(String(id))}`;
}

function answersEndpoint(id) {
    return `${recordEndpoint(id)}/answers`;
}

function statusEndpoint(id) {
    return `${recordEndpoint(id)}/status`;
}

function historyEndpoint(patientId) {
    return `/api/medical_records/patients/${encodeURIComponent(String(patientId))}`;
}

function answer(question, value) {
    return { question_id: question.question_id, ...value };
}

function sampleAnswers() {
    return [
        answer(fixture.questions.choice, {
            question_option_id: Number(fixture.questions.choice.question_option_id)
        }),
        answer(fixture.questions.text, { answer_text: 'Week 7 answer text' }),
        answer(fixture.questions.json, { answer_value: { severity: 2, tags: ['itch'] } })
    ];
}

async function createRecord(account = accounts.patientA, overrides = {}) {
    const body = {
        template_id: fixture.template.id,
        ...overrides
    };
    const response = await api('post', '/api/medical_records', body, { token: account.token });
    if (String(response?.body?.code) === OK) {
        const id = Number(dataOf(response)?.medical_record_id);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error('Week 7 record creation did not return a positive data.medical_record_id.');
        }
        medicalRecordIds.add(String(id));
    }
    return response;
}

async function newRecord(account = accounts.patientA, overrides = {}) {
    const response = await createRecord(account, overrides);
    expectCode(response, OK);
    return String(dataOf(response).medical_record_id);
}

async function doctorRecord(doctor = accounts.doctorA, overrides = {}) {
    return newRecord(doctor, { patient_id: accounts.patientA.userId, ...overrides });
}

async function putAnswers(recordId, answers, token = accounts.patientA.token) {
    return api('put', answersEndpoint(recordId), { answers }, { token });
}

async function getAnswers(recordId, token = accounts.patientA.token) {
    return api('get', answersEndpoint(recordId), undefined, { token });
}

async function getRecord(recordId, token = accounts.doctorA.token) {
    return api('get', recordEndpoint(recordId), undefined, { token });
}

async function deleteRecord(recordId, token = accounts.admin.token) {
    return api('delete', recordEndpoint(recordId), undefined, { token });
}

async function deletedRecord() {
    const id = await newRecord();
    expectCode(await deleteRecord(id), OK);
    return id;
}

async function prepareCaseRecord({ status, assignedDoctorId }) {
    const result = await adapterCall('prepareWeek7MedicalRecord', {
        uniquePrefix: uniqueName('W7CaseRecord'),
        patientId: accounts.patientA.userId,
        templateId: fixture.template.id,
        status,
        assignedDoctorId
    });
    if (typeof result?.fixtureId !== 'string' || !result.fixtureId ||
        !Number.isInteger(Number(result?.medicalRecordId)) || Number(result.medicalRecordId) <= 0) {
        throw new Error('prepareWeek7MedicalRecord() must return fixtureId and positive medicalRecordId.');
    }
    caseFixtureIds.add(result.fixtureId);
    return String(result.medicalRecordId);
}

async function setStatus(recordId, status, token = accounts.doctorA.token, body = {}) {
    return api('put', recordEndpoint(recordId), { status, ...body }, { token });
}

async function closeRecord(status) {
    if (status === 'completed') {
        const id = await doctorRecord();
        expectCode(await setStatus(id, 'completed', accounts.doctorA.token), OK);
        return id;
    }
    const id = await newRecord();
    expectCode(await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
        token: accounts.patientA.token
    }), OK);
    return id;
}

async function authCase(kind, method, endpoint, body, account) {
    if (kind === 'missing') return api(method, endpoint, body);
    if (kind === 'invalid') {
        await login(account);
        const segments = account.token.split('.');
        if (segments.length !== 3 || !segments[2]) throw new Error('Login did not return a JWT-shaped token.');
        segments[2] = `${segments[2][0] === 'a' ? 'b' : 'a'}${segments[2].slice(1)}`;
        let last;
        for (const authorization of [
            'Bearer abc',
            `Bearer ${segments.join('.')}`,
            account.token,
            'Bearer '
        ]) {
            last = await api(method, endpoint, body, { authorization });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterCall('getExpiredToken', { phone: account.phone });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error(`getExpiredToken() returned no expired token for ${account.phone}.`);
        return api(method, endpoint, body, { token });
    }
    if (kind === 'logout') {
        await login(account);
        expectCode(await api('post', '/api/auth/logout', {}, { token: account.token }), OK);
        const response = await api(method, endpoint, body, { token: account.token });
        await login(account);
        return response;
    }
    throw new Error(`Unknown Week 7 auth case "${kind}".`);
}

async function removeSuiteCreatedPatient(account) {
    const result = await adapterCall('deleteUser', { phone: account.phone });
    if (result?.deleted === false) throw new Error(`Adapter did not delete Week 7 patient ${account.phone}.`);
    accountPhones.delete(account.phone);
}

async function completedDetails(recordId) {
    const response = await getRecord(recordId);
    expectCode(response, OK);
    return dataOf(response);
}

async function runAnswersRead(number) {
    if (number === 1) {
        const id = await newRecord();
        expectCode(await putAnswers(id, sampleAnswers()), OK);
        const response = await getAnswers(id);
        expectCode(response, OK);
        const answers = itemsOf(response);
        expect(answers).toHaveLength(3);
        for (const item of answers) {
            expect(item).toEqual(expect.objectContaining({
                id: expect.any(Number),
                medical_record_id: Number(id),
                question_id: expect.any(String),
                answered_by: accounts.patientA.userId,
                created_at: expect.anything(),
                updated_at: expect.anything()
            }));
        }
        expect(answers.find(item => item.question_id === fixture.questions.choice.question_id)
            .question_option_id).toBe(Number(fixture.questions.choice.question_option_id));
        expect(answers.find(item => item.question_id === fixture.questions.text.question_id).answer_text)
            .toBe('Week 7 answer text');
        expect(answers.find(item => item.question_id === fixture.questions.json.question_id).answer_value)
            .toEqual({ severity: 2, tags: ['itch'] });
        return response;
    }
    if (number === 2) {
        const id = await newRecord();
        expectCode(await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'doctor response' })],
            accounts.doctorA.token), OK);
        const response = await getAnswers(id);
        expectCode(response, OK);
        expect(itemsOf(response)[0].answered_by).toBe(accounts.doctorA.userId);
        return response;
    }
    if (number === 3) {
        const response = await getAnswers(await newRecord());
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 4) {
        const id = await newRecord();
        expectCode(await putAnswers(id, sampleAnswers()), OK);
        let last;
        for (const account of [accounts.doctorA, accounts.nurse, accounts.admin]) {
            last = await getAnswers(id, account.token);
            expectCode(last, OK);
            expect(itemsOf(last)).toHaveLength(3);
        }
        return last;
    }
    if (number === 5) {
        const id = await newRecord();
        return getAnswers(id, accounts.patientB.token);
    }
    if (number === 6) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await getAnswers(id, accounts.patientA.token);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await getAnswers(id, accounts.patientA.token);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8 || number === 9) return getAnswers(await deletedRecord());
    const recordId = await newRecord();
    if (number >= 10 && number <= 13) {
        const kind = { 10: 'missing', 11: 'invalid', 12: 'expired', 13: 'logout' }[number];
        return authCase(kind, 'get', answersEndpoint(recordId), undefined, accounts.patientA);
    }
    throw new Error(`Unhandled Week 7 MAG case ${number}.`);
}

async function runAnswersWrite(number) {
    if (number === 1) {
        const id = await newRecord();
        const response = await putAnswers(id, sampleAnswers());
        expectCode(response, OK);
        expect(dataOf(response)?.count).toBe(3);
        const stored = await getAnswers(id);
        expectCode(stored, OK);
        expect(itemsOf(stored)).toHaveLength(3);
        expect(itemsOf(stored).every(item => item.answered_by === accounts.patientA.userId)).toBe(true);
        return response;
    }
    if (number === 2) {
        const id = await newRecord();
        expectCode(await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'before' })]), OK);
        const before = itemsOf(await getAnswers(id))[0];
        const response = await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'after' })]);
        expectCode(response, OK);
        expect(dataOf(response)?.count).toBe(1);
        const stored = itemsOf(await getAnswers(id));
        expect(stored).toHaveLength(1);
        expect(stored[0].answer_text).toBe('after');
        expect(Date.parse(stored[0].updated_at)).toBeGreaterThanOrEqual(Date.parse(before.updated_at));
        return response;
    }
    if (number === 3) {
        const id = await newRecord();
        expectCode(await putAnswers(id, [answer(fixture.questions.text, {
            answer_text: 'before'
        })]), OK);
        const response = await putAnswers(id, [
            answer(fixture.questions.text, { answer_text: 'replaced' }),
            answer(fixture.questions.text, { answer_text: 'new one' }),
            answer(fixture.questions.json, { answer_value: { ok: true } })
        ]);
        expectCode(response, OK);
        expect(dataOf(response)?.count).toBe(3);
        expect(itemsOf(await getAnswers(id))).toHaveLength(3);
        return response;
    }
    if (number === 4) {
        const id = await newRecord();
        expectCode(await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'patient' })]), OK);
        const response = await putAnswers(id, [
            answer(fixture.questions.text, { answer_text: 'doctor' })
        ], accounts.doctorA.token);
        expectCode(response, OK);
        const saved = itemsOf(await getAnswers(id));
        expect(saved).toHaveLength(1);
        expect(saved[0]).toEqual(expect.objectContaining({
            answer_text: 'doctor',
            answered_by: accounts.doctorA.userId
        }));
        return response;
    }
    if (number === 5) {
        const id = await newRecord();
        const response = await putAnswers(id, sampleAnswers());
        expectCode(response, OK);
        const saved = itemsOf(await getAnswers(id));
        expect(saved.find(item => item.question_id === fixture.questions.choice.question_id).question_option_id)
            .toBe(Number(fixture.questions.choice.question_option_id));
        expect(saved.find(item => item.question_id === fixture.questions.text.question_id).answer_text)
            .toBe('Week 7 answer text');
        expect(saved.find(item => item.question_id === fixture.questions.json.question_id).answer_value)
            .toEqual({ severity: 2, tags: ['itch'] });
        return response;
    }
    if (number === 6) {
        const id = await newRecord();
        const response = await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'patient pending' })]);
        expectCode(response, OK);
        expect(dataOf(response)?.count).toBe(1);
        return response;
    }
    if (number === 7) return api('put', answersEndpoint(await newRecord()), {}, { token: accounts.patientA.token });
    if (number === 8) return putAnswers(await newRecord(), [{ answer_text: 'missing question id' }]);
    if (number === 9) return putAnswers(await newRecord(), [{ question_id: fixture.questions.text.question_id }]);
    if (number === 10) {
        const id = await newRecord();
        let last;
        for (const answers of [
            'abc',
            ['a'],
            [{ question_id: 123, answer_text: 'text' }],
            [{ question_id: fixture.questions.choice.question_id, question_option_id: 'a' }],
            [{ question_id: fixture.questions.text.question_id, answer_text: 123 }]
        ]) {
            last = await putAnswers(id, answers);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 11) {
        const id = await newRecord();
        let last;
        for (const answerValue of ['x', [], 1]) {
            last = await putAnswers(id, [
                answer(fixture.questions.json, { answer_value: answerValue })
            ]);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 12) return putAnswers(await newRecord(), []);
    if (number === 13) {
        const item = answer(fixture.questions.text, { answer_text: 'duplicate' });
        return putAnswers(await newRecord(), [item, { ...item }]);
    }
    if (number === 14) {
        return putAnswers(await newRecord(), [
            { question_id: fixture.absentQuestionId, answer_text: 'not in this template' }
        ]);
    }
    if (number === 15) {
        const id = await newRecord();
        let last;
        for (const answerText of ['x'.repeat(2001), '<script>unsafe</script>']) {
            last = await putAnswers(id, [answer(fixture.questions.text, { answer_text: answerText })]);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 16) {
        const answers = Array.from({ length: 201 }, (_, index) =>
            answer(fixture.questions.text, { answer_text: `batch-${index}` }));
        const id = await newRecord();
        const response = await putAnswers(id, answers);
        expectCode(response, '1004');
        const stored = await getAnswers(id);
        expectCode(stored, OK);
        expect(dataOf(stored)).toEqual([]);
        return response;
    }
    if (number === 17) {
        return putAnswers(await newRecord(), [{
            question_id: fixture.absentQuestionId,
            answer_text: 'unknown question'
        }]);
    }
    if (number === 18) {
        return putAnswers(await newRecord(), [answer(fixture.questions.choice, {
            question_option_id: Number(fixture.questions.foreignOption.question_option_id)
        })]);
    }
    if (number === 19) {
        const id = await newRecord();
        const response = await putAnswers(id, [
            answer(fixture.questions.text, { answer_text: 'must roll back' }),
            { question_id: fixture.absentQuestionId, answer_text: 'invalid' }
        ]);
        expectCode(response, '9992');
        const stored = await getAnswers(id);
        expectCode(stored, OK);
        expect(dataOf(stored)).toEqual([]);
        return response;
    }
    if (number === 20) {
        const id = await doctorRecord();
        expectCode(await setStatus(id, 'completed', accounts.doctorA.token), OK);
        let last = await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'closed' })],
            accounts.patientA.token);
        expectCode(last, '1010');
        const cancelledId = await newRecord();
        expectCode(await api('patch', statusEndpoint(cancelledId), { status: 'cancelled' }, {
            token: accounts.patientA.token
        }), OK);
        last = await putAnswers(cancelledId, [answer(fixture.questions.text, { answer_text: 'closed' })]);
        expectCode(last, '1010');
        return last;
    }
    if (number === 21) {
        return putAnswers(await newRecord(), [
            answer(fixture.questions.text, { answer_text: 'forbidden' })
        ], accounts.patientB.token);
    }
    if (number === 22) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'x' })]);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 23) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await putAnswers(id, [answer(fixture.questions.text, { answer_text: 'x' })]);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 24 || number === 25) {
        const id = await deletedRecord();
        return putAnswers(id, [answer(fixture.questions.text, { answer_text: 'missing' })]);
    }
    if (number === 26) {
        return api('put', answersEndpoint(await newRecord()), undefined, {
            token: accounts.patientA.token,
            rawBody: '{"answers":'
        });
    }
    if (number >= 27 && number <= 30) {
        const id = await newRecord();
        const kind = { 27: 'missing', 28: 'invalid', 29: 'expired', 30: 'logout' }[number];
        return authCase(kind, 'put', answersEndpoint(id), {
            answers: [answer(fixture.questions.text, { answer_text: 'x' })]
        }, accounts.patientA);
    }
    if (number === 31) {
        return putAnswers(await newRecord(), [
            answer(fixture.questions.text, { answer_text: 'admin denied' })
        ], accounts.admin.token);
    }
    throw new Error(`Unhandled Week 7 MAS case ${number}.`);
}

async function runRecordEdit(number) {
    if (number <= 3) {
        const id = await doctorRecord();
        const status = number === 3 ? 'cancelled' : 'completed';
        const instructions = number === 1 ? 'Follow-up in two weeks.' : undefined;
        const response = await setStatus(id, status, accounts.doctorA.token,
            instructions === undefined ? {} : { instructions });
        expectCode(response, OK);
        const detail = await completedDetails(id);
        expect(detail.status).toBe(status);
        if (number === 1) {
            expect(detail.instructions).toBe(instructions);
            expect(detail.completed_at).toBeTruthy();
        } else if (number === 2) {
            expect(detail.instructions == null).toBe(true);
            expect(detail.completed_at).toBeTruthy();
        } else {
            expect(detail.completed_at == null).toBe(true);
        }
        expect(detail.updated_at).toBeDefined();
        return response;
    }
    if (number === 4) return api('put', recordEndpoint(await doctorRecord()), {}, { token: accounts.doctorA.token });
    if (number === 5) {
        const id = await doctorRecord();
        let last;
        for (const body of [{ status: 1 }, { status: 'completed', instructions: 123 }]) {
            last = await api('put', recordEndpoint(id), body, { token: accounts.doctorA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 6) {
        const id = await doctorRecord();
        let last;
        for (const status of ['pending', 'draft', 'in_progress', 'abc', 'COMPLETED']) {
            last = await setStatus(id, status);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 7) {
        const id = await doctorRecord();
        let last;
        for (const instructions of ['x'.repeat(5001), '<script>unsafe</script>']) {
            last = await setStatus(id, 'completed', accounts.doctorA.token, { instructions });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) {
        return setStatus(await doctorRecord(), 'completed', accounts.doctorB.token);
    }
    if (number === 9) {
        const id = await prepareCaseRecord({
            status: 'pending',
            assignedDoctorId: accounts.doctorA.userId
        });
        return setStatus(id, 'completed');
    }
    if (number === 10 || number === 11) {
        const id = await doctorRecord();
        const status = number === 10 ? 'completed' : 'cancelled';
        expectCode(await setStatus(id, status), OK);
        return setStatus(id, 'completed');
    }
    if (number === 12) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await api('put', recordEndpoint(id), { status: 'completed' }, {
                token: accounts.doctorA.token
            });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 13) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await api('put', recordEndpoint(id), { status: 'completed' }, { token: accounts.doctorA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14 || number === 15) {
        return setStatus(await deletedRecord(), 'completed');
    }
    if (number === 16) {
        return api('put', recordEndpoint(await doctorRecord()), undefined, {
            token: accounts.doctorA.token,
            rawBody: '{"status":'
        });
    }
    if (number >= 17 && number <= 20) {
        const id = await doctorRecord();
        const kind = { 17: 'missing', 18: 'invalid', 19: 'expired', 20: 'logout' }[number];
        return authCase(kind, 'put', recordEndpoint(id), { status: 'completed' }, accounts.doctorA);
    }
    if (number >= 21 && number <= 23) {
        const id = await doctorRecord();
        const account = { 21: accounts.patientA, 22: accounts.nurse, 23: accounts.admin }[number];
        return setStatus(id, 'completed', account.token);
    }
    throw new Error(`Unhandled Week 7 MRE case ${number}.`);
}

async function runStatusChange(number) {
    if (number === 1) {
        const id = await newRecord();
        const response = await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual(expect.objectContaining({ id: Number(id), status: 'cancelled' }));
        expect((await completedDetails(id)).status).toBe('cancelled');
        return response;
    }
    if (number === 2) {
        const id = await doctorRecord();
        const response = await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
            token: accounts.doctorA.token
        });
        expectCode(response, OK);
        expect(dataOf(response)?.status).toBe('cancelled');
        return response;
    }
    if (number === 3) {
        const id = await newRecord();
        const response = await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
            token: accounts.admin.token
        });
        expectCode(response, OK);
        expect(dataOf(response)?.status).toBe('cancelled');
        return response;
    }
    if (number === 4) {
        return api('patch', statusEndpoint(await newRecord()), {}, { token: accounts.patientA.token });
    }
    if (number === 5) {
        const id = await newRecord();
        let last;
        for (const status of [1, true]) {
            last = await api('patch', statusEndpoint(id), { status }, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 6) {
        const id = await newRecord();
        let last;
        for (const status of ['completed', 'pending', 'abc', 'CANCELLED']) {
            last = await api('patch', statusEndpoint(id), { status }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 7) {
        const id = await doctorRecord();
        return api('patch', statusEndpoint(id), { status: 'cancelled' }, {
            token: accounts.patientA.token
        });
    }
    if (number === 8) {
        const id = await closeRecord('completed');
        return api('patch', statusEndpoint(id), { status: 'cancelled' }, { token: accounts.admin.token });
    }
    if (number === 9) {
        const id = await newRecord();
        return api('patch', statusEndpoint(id), { status: 'cancelled' }, { token: accounts.patientB.token });
    }
    if (number === 10) {
        const id = await doctorRecord();
        return api('patch', statusEndpoint(id), { status: 'cancelled' }, { token: accounts.doctorB.token });
    }
    if (number === 11) {
        const id = await newRecord();
        return api('patch', statusEndpoint(id), { status: 'cancelled' }, { token: accounts.nurse.token });
    }
    if (number === 12) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
                token: accounts.patientA.token
            });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 13) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await api('patch', statusEndpoint(id), { status: 'cancelled' }, {
                token: accounts.patientA.token
            });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14 || number === 15) {
        return api('patch', statusEndpoint(await deletedRecord()), { status: 'cancelled' }, {
            token: accounts.admin.token
        });
    }
    if (number === 16) {
        return api('patch', statusEndpoint(await newRecord()), undefined, {
            token: accounts.patientA.token,
            rawBody: '{"status":'
        });
    }
    if (number >= 17 && number <= 20) {
        const id = await newRecord();
        const kind = { 17: 'missing', 18: 'invalid', 19: 'expired', 20: 'logout' }[number];
        return authCase(kind, 'patch', statusEndpoint(id), { status: 'cancelled' }, accounts.patientA);
    }
    throw new Error(`Unhandled Week 7 MRT case ${number}.`);
}

async function runHistory(number) {
    if (number === 1) {
        const firstId = await newRecord();
        const secondId = await newRecord();
        const response = await api('get', historyEndpoint(accounts.patientA.userId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        const rows = itemsOf(response);
        expect(rows.map(item => String(item.medical_record_id))).toEqual(expect.arrayContaining([firstId, secondId]));
        expect(rows.every(item => [firstId, secondId].includes(String(item.medical_record_id)))).toBe(true);
        for (let i = 1; i < rows.length; i++) {
            expect(Date.parse(rows[i - 1].created_at)).toBeGreaterThanOrEqual(Date.parse(rows[i].created_at));
        }
        return response;
    }
    if (number === 2) {
        const id = await newRecord();
        const response = await api('get', historyEndpoint(accounts.patientA.userId), undefined, {
            token: accounts.doctorA.token
        });
        expectCode(response, OK);
        expect(itemsOf(response).some(item => String(item.medical_record_id) === id)).toBe(true);
        return response;
    }
    if (number === 3) {
        const response = await api('get', historyEndpoint(accounts.patientB.userId), undefined, {
            token: accounts.patientB.token
        });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 4) {
        const id = await doctorRecord();
        expectCode(await setStatus(id, 'completed', accounts.doctorA.token, {
            instructions: 'History conclusion'
        }), OK);
        const response = await api('get', historyEndpoint(accounts.patientA.userId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        const row = itemsOf(response).find(item => String(item.medical_record_id) === id);
        expect(row).toEqual(expect.objectContaining({
            status: 'completed',
            instructions: 'History conclusion'
        }));
        return response;
    }
    if (number === 5) {
        return api('get', historyEndpoint(accounts.patientB.userId), undefined, {
            token: accounts.patientA.token
        });
    }
    if (number === 6) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await api('get', historyEndpoint(id), undefined, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await api('get', historyEndpoint(id), undefined, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) {
        const absent = await registerAccount('absent-patient', 'patient', roles.patient);
        await removeSuiteCreatedPatient(absent);
        return api('get', historyEndpoint(absent.userId), undefined, { token: accounts.patientA.token });
    }
    if (number === 9) {
        return api('get', historyEndpoint(accounts.doctorA.userId), undefined, {
            token: accounts.admin.token
        });
    }
    if (number >= 10 && number <= 13) {
        const kind = { 10: 'missing', 11: 'invalid', 12: 'expired', 13: 'logout' }[number];
        return authCase(kind, 'get', historyEndpoint(accounts.patientA.userId), undefined, accounts.patientA);
    }
    throw new Error(`Unhandled Week 7 MRH case ${number}.`);
}

async function runDelete(number) {
    if (number === 1) {
        const id = await newRecord();
        const response = await deleteRecord(id);
        expectCode(response, OK);
        expect(dataOf(response)).toEqual({});
        return response;
    }
    if (number === 2 || number === 3 || number === 5) {
        const id = await newRecord();
        if (number === 3) {
            expectCode(await putAnswers(id, sampleAnswers()), OK);
            const deleted = await deleteRecord(id);
            expectCode(deleted, OK);
            expectCode(await getAnswers(id, accounts.admin.token), '9992');
            return getAnswers(id, accounts.admin.token);
        }
        expectCode(await deleteRecord(id), OK);
        if (number === 2) return getRecord(id, accounts.admin.token);
        return deleteRecord(id);
    }
    if (number === 4) {
        const id = await newRecord();
        expectCode(await deleteRecord(id), OK);
        const history = await api('get', historyEndpoint(accounts.patientA.userId), undefined, {
            token: accounts.admin.token
        });
        expectCode(history, OK);
        expect(itemsOf(history).some(item => String(item.medical_record_id) === id)).toBe(false);
        return history;
    }
    if (number === 6) {
        let last;
        for (const id of ['abc', '1.5']) {
            last = await deleteRecord(id);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 7) {
        let last;
        for (const id of ['0', '-1', '99999999999999999999']) {
            last = await deleteRecord(id);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 8) return deleteRecord(await deletedRecord());
    if (number >= 9 && number <= 12) {
        const id = await newRecord();
        const kind = { 9: 'missing', 10: 'invalid', 11: 'expired', 12: 'logout' }[number];
        return authCase(kind, 'delete', recordEndpoint(id), undefined, accounts.admin);
    }
    if (number >= 13 && number <= 15) {
        const id = await newRecord();
        const account = { 13: accounts.patientA, 14: accounts.doctorA, 15: accounts.nurse }[number];
        return deleteRecord(id, account.token);
    }
    throw new Error(`Unhandled Week 7 MRD case ${number}.`);
}

async function runCase(testCase) {
    switch (testCase.prefix) {
        case 'MAG': return runAnswersRead(testCase.number);
        case 'MAS': return runAnswersWrite(testCase.number);
        case 'MRE': return runRecordEdit(testCase.number);
        case 'MRT': return runStatusChange(testCase.number);
        case 'MRH': return runHistory(testCase.number);
        case 'MRD': return runDelete(testCase.number);
        default: throw new Error(`Unknown Week 7 case group "${testCase.prefix}".`);
    }
}

async function cleanupRecords() {
    if (!accounts?.admin?.token) {
        medicalRecordIds.clear();
        return;
    }
    const errors = [];
    for (const id of [...medicalRecordIds]) {
        try {
            const response = await deleteRecord(id);
            const code = String(response?.body?.code);
            if (code !== OK && code !== '9992') {
                throw new Error(`cleanup returned code ${code}`);
            }
            medicalRecordIds.delete(id);
        } catch (error) {
            errors.push(`${id}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(`Week 7 record cleanup failed: ${errors.join('; ')}`);
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
    if (errors.length) throw new Error(`Week 7 account cleanup failed: ${errors.join('; ')}`);
}

async function cleanupCaseFixtures() {
    if (!caseFixtureIds.size) return;
    const result = await adapterCall('cleanupWeek7Fixtures', {
        fixtureIds: [...caseFixtureIds]
    });
    if (result?.cleaned !== true) {
        throw new Error('cleanupWeek7Fixtures() must return { cleaned: true } for exact case fixture IDs.');
    }
    caseFixtureIds.clear();
}

beforeAll(async () => {
    // Adapter contracts: assertTestDatabase inspects the actual backend DB connection;
    // getRoleIds returns positive admin/patient/doctor/nurse IDs; promoteUser changes only
    // the just-signed-up user's role; deleteUser removes only the exact phone supplied;
    // getExpiredToken returns a validly signed but expired token for that phone.
    const db = await adapterCall('assertTestDatabase');
    if (db?.isTestDatabase !== true || db.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}".`);
    }
    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    for (const role of ['admin', 'patient', 'doctor', 'nurse']) {
        if (!Number.isInteger(roles?.[role]) || roles[role] <= 0) {
            throw new Error(`Adapter getRoleIds() must return a positive integer "${role}" role ID.`);
        }
    }
    if (roles.admin !== 1) throw new Error('The workbook specifies director/admin role ID 1.');

    // Test-fixture contract: prepareWeek7Fixtures({ expectedDatabaseName, uniquePrefix })
    // creates a disposable active template and only its associated questions/options; it never
    // creates users or medical records, reuses existing IDs, or mutates non-fixture data. It
    // returns { fixtureIds, template: { id }, questions: { choice: { question_id,
    // question_option_id }, text: { question_id }, json: { question_id }, foreignOption:
    // { question_id, question_option_id } }, absentQuestionId }. The absent question ID must
    // be verified absent. The foreign option must belong to a different choice question in
    // template. cleanupWeek7Fixtures({ expectedDatabaseName, fixtureIds }) removes only those
    // opaque fixture IDs (including the one status-specific case record prepared below) and
    // returns { cleaned: true }. Other medical records below are created through the public HTTP
    // API; every mutation targets an API-created record or that explicitly disposable case record.
    // prepareWeek7MedicalRecord({ expectedDatabaseName, uniquePrefix, patientId, templateId,
    // status, assignedDoctorId }) creates one disposable record with exactly those associations
    // and returns { fixtureId, medicalRecordId }; it never reuses or overwrites an existing record.
    const prepared = await adapterCall('prepareWeek7Fixtures', {
        uniquePrefix: uniqueName('W7Suite')
    });
    if (!Array.isArray(prepared?.fixtureIds) || prepared.fixtureIds.length === 0) {
        throw new Error('prepareWeek7Fixtures() must return non-empty opaque fixtureIds.');
    }
    for (const fixtureId of prepared.fixtureIds) suiteFixtureIds.add(fixtureId);
    fixture = prepared;
    if (!fixture.template?.id || !fixture.questions?.choice?.question_id ||
        !fixture.questions?.text?.question_id || !fixture.questions?.json?.question_id ||
        !fixture.questions?.foreignOption?.question_id || !fixture.absentQuestionId ||
        !Number.isInteger(Number(fixture.questions.choice.question_option_id)) ||
        !Number.isInteger(Number(fixture.questions.foreignOption.question_option_id)) ||
        Number(fixture.questions.choice.question_option_id) <= 0 ||
        Number(fixture.questions.foreignOption.question_option_id) <= 0) {
        throw new Error('prepareWeek7Fixtures() returned an incomplete Week 7 fixture contract.');
    }

    accounts = {};
    for (const [label, role] of [
        ['patientA', 'patient'],
        ['patientB', 'patient'],
        ['doctorA', 'doctor'],
        ['doctorB', 'doctor'],
        ['nurse', 'nurse'],
        ['admin', 'admin']
    ]) {
        accounts[label] = await registerAccount(label, role, roles[role]);
    }
});

afterEach(async () => {
    await cleanupRecords();
    await cleanupCaseFixtures();
});

afterAll(async () => {
    const errors = [];
    for (const [label, operation] of [
        ['suite-created records', cleanupRecords],
        ['case-specific record fixtures', cleanupCaseFixtures],
        ['fixture questions and template', async () => {
            if (!suiteFixtureIds.size) return;
            const result = await adapterCall('cleanupWeek7Fixtures', {
                fixtureIds: [...suiteFixtureIds]
            });
            if (result?.cleaned !== true) {
                throw new Error('cleanupWeek7Fixtures() must return { cleaned: true } for exact suite fixture IDs.');
            }
            suiteFixtureIds.clear();
        }],
        ['users by exact phone', cleanupAccounts],
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

describe('Week 7 medical record answers, status, history, and deletion', () => {
    for (const testCase of allCases) {
        test(`${testCase.id} [${testCase.expected}] ${testCase.title}`, async () => {
            const response = await runCase(testCase);
            expectCode(response, testCase.expected);
        });
    }
});
