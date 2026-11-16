const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

// Workbook routes are exercised through HTTP only: Week 9 image/lesion/UAS7 routes plus
// signup/login/logout, medical-record create/answers/delete, and Week 8 episode/location
// create/delete routes. prepareWeek7Fixtures supplies an isolated active template, questions,
// options, and a verified absent question ID; all records, episodes, locations, uploads, photos,
// and answer-image links are created through those public APIs and cleaned by their own IDs.
// The decision sheet leaves the MinIO failure trigger and multipart multiple-file field naming
// adapter-specific; this suite requires setMinioFailure({ enabled }) and uses images[].

const catalog = {
    ATU: '1000,1000,1000,1000,1000,1000,1000,1002,1003,1002,1006,1003,1003,1003,1007,1004,1003,1004,1004,9992,1009,9992,1000,1003,9998,9998,9998,9998',
    ATM: '1000,1000,1000,1002,1002,1008,1003,1009,1002,1003,1006,1003,9998,9998,9998,9998',
    ATL: '1000,1000,1000,1000,1000,1009,9992,1003,1004,9998,9998,9998,9998',
    ATV: '200,200,1009,9992,1003,1004,9998,9998',
    ATX: '1000,1000,9992,9992,1009,1009,1009,1003,1004,9992,9998,9998,9998,9998',
    PHC: '1000,1000,1000,1000,1000,1000,1002,1002,1003,1004,1003,1004,1004,1004,1004,1004,1004,1004,1004,9992,9992,9992,1009,1009,1010,1003,9998,9998,9998,9998,1009',
    PHL: '1000,1000,1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
    PHU: '1000,1000,1000,1000,1002,1003,1004,1004,1004,1004,1004,1000,1003,1004,9992,9992,1009,1010,1003,9998,9998,9998,9998,1009',
    PHX: '1000,1000,200,9992,1003,1004,9992,1009,1010,9998,9998,9998,9998,1009',
    AIC: '1000,1000,1000,1000,1002,1002,1003,1004,1004,9992,9992,1009,1009,1010,1008,1010,1003,9998,9998,9998,9998,1009',
    AIL: '1000,1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
    AIX: '1000,1000,9992,1003,1004,9992,1009,1010,9998,9998,9998,9998,1009',
    AIB: '1000,1000,1002,1004,1003,1003,1004,1004,1008,9992,1010,1009,9992,1008,1010,1003,9998,9998,9998,9998,1009',
    U7E: '1000,1000,1000,1000,1000,1009,9998,9998,9998,9998,1009,1009,1009',
    U7C: '1000,1010,1000,1000,1000,1002,1002,1002,1003,1003,1004,1004,1004,1004,1004,1003,1004,9992,1009,9994,1010,1003,9998,9998,9998,9998,1009,1009,1009',
    U7P: '1000,1000,1000,1000,1009,9992,1003,1004,9998,9998,9998,9998',
    U7W: '1000,1000,1000,1000,1000,1000,1000,1000,1000,1004,1004,1009,9992,1003,1004,9998,9998,9998,9998'
};

const titles = {
    ATU: 'uploading a medical image attachment',
    ATM: 'uploading multiple medical image attachments',
    ATL: 'listing image attachments by user',
    ATV: 'viewing a private image attachment',
    ATX: 'deleting an image attachment',
    PHC: 'creating a lesion photo',
    PHL: 'listing lesion photos by location',
    PHU: 'editing a lesion photo milestone',
    PHX: 'deleting a lesion photo',
    AIC: 'linking an image to a medical-record answer',
    AIL: 'listing answer images',
    AIX: 'removing an answer-image link',
    AIB: 'linking answer images in bulk',
    U7E: 'checking UAS7 eligibility',
    U7C: 'recording a daily UAS7 score',
    U7P: 'listing UAS7 scores by patient',
    U7W: 'summarizing a patient UAS7 week'
};

const groups = Object.entries(catalog).map(([prefix, codes]) => ({
    prefix,
    cases: codes.split(',').map((expected, index) => ({
        prefix,
        number: index + 1,
        id: `W9-${prefix}-${String(index + 1).padStart(2, '0')}`,
        expected,
        title: titles[prefix]
    }))
}));
const allCases = groups.flatMap(group => group.cases);
if (allCases.length !== 302 || new Set(allCases.map(item => item.id)).size !== 302) {
    throw new Error(`Week 9 workbook coverage must contain exactly 302 unique cases; found ${allCases.length}.`);
}

const phones = new Set();
const records = new Set();
const attachments = new Map();
const episodes = new Map();
const locations = new Map();
const photos = new Map();
const answerImages = new Map();
const fixtureIds = new Set();
let roles;
let fixture;
let accounts;

function adapterMethod(name) {
    if (typeof adapter[name] !== 'function') throw new Error(`The target adapter must implement ${name}().`);
    return adapter[name].bind(adapter);
}

async function adapterCall(name, values = {}) {
    return adapterMethod(name)({ ...values, expectedDatabaseName: config.databaseName });
}

function uniqueName(prefix = 'week9') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function randomPhone() {
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
    for (const key of ['items', 'attachments', 'photos', 'answer_images', 'scores', 'records']) {
        if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
}

function idOf(item, names = ['id']) {
    for (const name of names) {
        if (item?.[name] !== undefined && item[name] !== null) return item[name];
    }
    return undefined;
}

async function api(method, endpoint, body, options = {}) {
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (options.token) call = call.set('Authorization', `Bearer ${options.token}`);
    if (options.authorization !== undefined) call = call.set('Authorization', options.authorization);
    if (options.query) call = call.query(options.query);
    if (options.rawBody !== undefined) {
        call = call.set('Content-Type', 'application/json').send(options.rawBody);
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
    if (typeof token !== 'string' || !token) throw new Error(`Week 9 ${account.role} login returned no token.`);
    account.token = token;
}

async function registerAccount(label, role, roleId) {
    const account = {
        role,
        fullName: `Mayday Week 9 ${label}`,
        phone: randomPhone(),
        password: password()
    };
    phones.add(account.phone);
    const signup = await api('post', '/api/auth/signup', {
        full_name: account.fullName,
        phone: account.phone,
        password: account.password
    });
    expectCode(signup, OK);
    account.userId = Number(dataOf(signup)?.user_id);
    if (!Number.isInteger(account.userId) || account.userId <= 0) {
        throw new Error(`Week 9 ${label} signup returned no positive user_id.`);
    }
    const promoted = await adapterCall('promoteUser', { phone: account.phone, roleId });
    if (Number(promoted?.roleId) !== roleId) throw new Error(`Adapter failed to promote the Week 9 ${label} account.`);
    await login(account);
    return account;
}

function imageBytes(type = 'png') {
    if (type === 'png') {
        return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
    }
    if (type === 'jpeg') return Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
    if (type === 'webp') return Buffer.from('RIFF\x1a\0\0\0WEBPVP8 ', 'binary');
    return Buffer.from('not an image');
}

function filePart(call, field, type = 'png', filename) {
    const ext = type === 'jpeg' ? 'jpg' : type;
    const contentType = type === 'jpeg' ? 'image/jpeg' :
        type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'text/plain';
    return call.attach(field, imageBytes(type), {
        filename: filename || `mayday-${uniqueName()}.${ext}`,
        contentType
    });
}

async function upload(actor = accounts.patientA, fields = {}, type = 'png', filename) {
    let call = request(config.baseUrl).post('/api/image-attachments/upload')
        .set('Authorization', `Bearer ${actor.token}`);
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) call = call.field(key, value === null ? '' : String(value));
    }
    const ext = type === 'jpeg' ? 'jpg' : type;
    const contentType = type === 'jpeg' ? 'image/jpeg' :
        type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'text/plain';
    call = call.attach('file', imageBytes(type), {
        filename: filename || `mayday-${uniqueName()}.${ext}`,
        contentType
    });
    const response = await call;
    const id = idOf(dataOf(response), ['id', 'attachment_id']);
    if (id !== undefined) attachments.set(String(id), actor);
    return response;
}

async function uploadMany(actor = accounts.patientA, userId = actor.userId, count = 1, {
    types = [], emptyAt, sizeAt, foreignField = 'images[]'
} = {}) {
    let call = request(config.baseUrl).post('/api/image-attachments/upload-multiple')
        .set('Authorization', `Bearer ${actor.token}`);
    if (userId !== undefined) call = call.field('user_id', String(userId));
    for (let i = 0; i < count; i++) {
        let type = types[i] || 'png';
        let bytes = imageBytes(type);
        if (i === emptyAt) bytes = Buffer.alloc(0);
        if (i === sizeAt) bytes = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
        const contentType = type === 'jpeg' ? 'image/jpeg' :
            type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'text/plain';
        call = call.attach(foreignField, bytes, {
            filename: `week9-${i}.${type === 'jpeg' ? 'jpg' : type}`,
            contentType
        });
    }
    const response = await call;
    const data = dataOf(response);
    const items = Array.isArray(data) ? data : data?.items || data?.attachments || [];
    for (const item of items) {
        const id = idOf(item, ['id', 'attachment_id']);
        if (id !== undefined) attachments.set(String(id), actor);
    }
    return response;
}

function requiredId(response, names, context) {
    const id = idOf(dataOf(response), names);
    if (id === undefined || id === null || String(id) === '') throw new Error(`${context} returned no ID.`);
    return String(id);
}

async function createRecord(owner = accounts.patientA, creator = owner) {
    const body = { template_id: fixture.template.id };
    if (creator.role !== 'patient') body.patient_id = owner.userId;
    const response = await api('post', '/api/medical_records', body, { token: creator.token });
    expectCode(response, OK);
    const id = requiredId(response, ['medical_record_id'], 'record creation');
    records.add(id);
    return id;
}

async function deleteRecord(id) {
    const response = await api('delete', `/api/medical_records/${encodeURIComponent(id)}`, undefined, {
        token: accounts.admin.token
    });
    expectCode(response, OK);
    records.delete(String(id));
}

async function deletedRecord(owner = accounts.patientA) {
    const id = await createRecord(owner);
    await deleteRecord(id);
    return id;
}

async function answerFixture(owner = accounts.patientA, creator = owner) {
    const medicalRecordId = await createRecord(owner, creator);
    const answerResponse = await api('put', `/api/medical_records/${medicalRecordId}/answers`, {
        answers: [{
            question_id: fixture.questions.choice.question_id,
            question_option_id: Number(fixture.questions.choice.question_option_id)
        }]
    }, { token: creator.token });
    expectCode(answerResponse, OK);
    let answerId = idOf(dataOf(answerResponse), ['answer_id', 'id']);
    if (answerId === undefined) {
        const listed = await api('get', `/api/medical_records/${medicalRecordId}/answers`, undefined, { token: creator.token });
        expectCode(listed, OK);
        answerId = idOf(itemsOf(listed)[0], ['answer_id', 'medical_record_answer_id', 'id']);
    }
    if (answerId === undefined) throw new Error('Week 9 answer fixture could not resolve an answer ID from the public API.');
    return { medicalRecordId, answerId: String(answerId), owner };
}

async function episodeFixture(owner = accounts.patientA, actor = owner) {
    const recordId = await createRecord(owner);
    const episodeResponse = await api('post', '/api/lesion-episodes', {
        medical_record_id: recordId,
        name: uniqueName('lesion')
    }, { token: actor.token });
    expectCode(episodeResponse, OK);
    const episodeId = requiredId(episodeResponse, ['episode_id', 'id'], 'episode creation');
    episodes.set(episodeId, actor);
    return { recordId, episodeId, owner, actor };
}

async function locationFixture(owner = accounts.patientA, actor = owner) {
    const base = await episodeFixture(owner, actor);
    const response = await api('post', '/api/lesion-locations', {
        episode_id: base.episodeId,
        body_part: uniqueName('location')
    }, { token: actor.token });
    expectCode(response, OK);
    const locationId = requiredId(response, ['lesion_location_id', 'location_id', 'id'], 'location creation');
    locations.set(locationId, actor);
    return { ...base, locationId };
}

async function photoFixture(owner = accounts.patientA, actor = owner, fields = {}) {
    const base = await locationFixture(owner, actor);
    const attachment = await upload(actor);
    expectCode(attachment, OK);
    const attachmentId = requiredId(attachment, ['id', 'attachment_id'], 'attachment upload');
    const response = await api('post', '/api/lesion-photos', {
        episode_id: base.episodeId,
        location_id: base.locationId,
        attachment_id: attachmentId,
        milestone: 'start',
        ...fields
    }, { token: actor.token });
    expectCode(response, OK);
    const photoId = requiredId(response, ['photo_id', 'id'], 'photo creation');
    photos.set(photoId, actor);
    return { ...base, attachmentId, photoId };
}

async function linkFixture(owner = accounts.patientA, creator = owner) {
    const answer = await answerFixture(owner, creator);
    const file = await upload(owner);
    expectCode(file, OK);
    const attachmentId = requiredId(file, ['id', 'attachment_id'], 'attachment upload');
    const response = await api('post', '/api/answer-images', {
        answer_id: answer.answerId,
        attachment_id: attachmentId
    }, { token: creator.token });
    expectCode(response, OK);
    const linkId = requiredId(response, ['id', 'answer_image_id'], 'answer image linking');
    answerImages.set(linkId, creator);
    return { ...answer, attachmentId, linkId };
}

async function closedRecord(status = 'completed', owner = accounts.patientA) {
    const id = await createRecord(owner, accounts.doctor);
    const response = status === 'completed'
        ? await api('put', `/api/medical_records/${id}`, { status: 'completed' }, { token: accounts.doctor.token })
        : await api('patch', `/api/medical_records/${id}/status`, { status: 'cancelled' }, { token: owner.token });
    expectCode(response, OK);
    return id;
}

async function authCase(kind, method, endpoint, body, actor = accounts.patientA, query) {
    if (kind === 'missing') return api(method, endpoint, body, { query });
    if (kind === 'invalid') {
        const token = actor.token;
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[2]) throw new Error('Expected a JWT-shaped token.');
        parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
        let last;
        for (const authorization of ['Bearer abc', `Bearer ${parts.join('.')}`, token, 'Bearer ']) {
            last = await api(method, endpoint, body, { authorization, query });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterCall('getExpiredToken', { phone: actor.phone });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error(`getExpiredToken() returned no token for ${actor.phone}.`);
        return api(method, endpoint, body, { token, query });
    }
    await login(actor);
    expectCode(await api('post', '/api/auth/logout', {}, { token: actor.token }), OK);
    const response = await api(method, endpoint, body, { token: actor.token, query });
    await login(actor);
    return response;
}

async function invalidIds(method, path, body, token, field) {
    const response = await api(method, path, { ...body, [field]: 'not-an-integer' }, { token });
    return response;
}

function endpointId(base, id) {
    return `${base}/${encodeURIComponent(String(id))}`;
}

async function runAttachmentUpload(n) {
    const path = '/api/image-attachments/upload';
    const recordId = await createRecord();
    const fields = { medical_record_id: recordId };
    if (n === 3) Object.assign(fields, { question_id: fixture.questions.choice.question_id, category: 'clinical', description: 'Week 9 upload' });
    if (n === 4) Object.assign(fields, { category: '', description: '' });
    if (n === 16) fields.media_type = 'video';
    if (n === 17) fields.medical_record_id = 'abc';
    if (n === 18) fields.medical_record_id = '0';
    if (n === 19) Object.assign(fields, { category: 'x'.repeat(51), description: '<b>' });
    if (n === 20) fields.medical_record_id = await deletedRecord();
    if (n === 21) fields.medical_record_id = await createRecord(accounts.patientB);
    if (n === 22) fields.question_id = fixture.absentQuestionId || uniqueName('Q_NOT_EXIST');
    if (n === 23) fields.user_id = String(accounts.patientB.userId);

    if (n === 8) {
        let call = request(config.baseUrl).post(path).set('Authorization', `Bearer ${accounts.patientA.token}`);
        return call.field('medical_record_id', recordId);
    }
    if (n === 9) {
        let call = request(config.baseUrl).post(path).set('Authorization', `Bearer ${accounts.patientA.token}`)
            .field('medical_record_id', recordId).field('file', 'abc');
        return call;
    }
    if (n === 10) {
        let call = request(config.baseUrl).post(path).set('Authorization', `Bearer ${accounts.patientA.token}`)
            .field('medical_record_id', recordId);
        return call.attach('file', Buffer.alloc(0), { filename: 'empty.png', contentType: 'image/png' });
    }
    if (n === 11) {
        let call = request(config.baseUrl).post(path).set('Authorization', `Bearer ${accounts.patientA.token}`)
            .field('medical_record_id', recordId);
        return call.attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' });
    }
    if (n === 12) return upload(accounts.patientA, fields, 'txt');
    if (n === 13) return upload(accounts.patientA, fields, 'gif');
    if (n === 14) return upload(accounts.patientA, fields, 'invalid');
    if (n === 15) {
        await adapterCall('setMinioFailure', { enabled: true });
        try { return await upload(accounts.patientA, fields); }
        finally { await adapterCall('setMinioFailure', { enabled: false }); }
    }
    if (n === 24) return api('post', path, fields, { token: accounts.patientA.token });
    if (n >= 25) return authCase(n === 25 ? 'missing' : n === 26 ? 'invalid' : n === 27 ? 'expired' : 'logout',
        'post', path, undefined, accounts.patientA);
    if (n === 7) {
        let response;
        for (const actor of [accounts.patientA, accounts.doctor, accounts.nurse, accounts.admin]) {
            response = await upload(actor, {});
            expectCode(response, OK);
            expect(dataOf(response)).toEqual(expect.objectContaining({ user_id: actor.userId, media_type: 'image' }));
        }
        return response;
    }
    if (n === 2) {
        let response;
        for (const type of ['jpeg', 'png', 'webp']) {
            response = await upload(accounts.patientA, fields, type);
            expectCode(response, OK);
        }
        return response;
    }
    if (n === 5) return upload(accounts.patientA, fields, 'jpeg', 'ảnh tổn thương 1.jpg');
    const actor = accounts.patientA;
    const response = await upload(actor, fields, n === 1 || n === 6 ? 'jpeg' : 'png');
    if (String(response?.body?.code) === OK && n === 6) {
        const id = requiredId(response, ['id', 'attachment_id'], 'attachment upload');
        const view = await api('get', `/api/image-attachments/view/${id}`, undefined, { token: actor.token });
        expect(view.status).toBe(200);
        expect(Buffer.compare(view.body, imageBytes('jpeg'))).toBe(0);
    }
    return response;
}

async function runMultipleUpload(n) {
    if (n === 1) return uploadMany(accounts.patientA, accounts.patientA.userId, 3);
    if (n === 2) return uploadMany(accounts.patientA, accounts.patientA.userId, 10);
    if (n === 3) {
        const response = await uploadMany(accounts.patientA, accounts.patientA.userId, 2);
        expectCode(response, OK);
        const listed = await api('get', `/api/image-attachments/user/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token });
        expectCode(listed, OK);
        expect(itemsOf(listed).length).toBeGreaterThanOrEqual(2);
        return response;
    }
    if (n === 4) return uploadMany(accounts.patientA, accounts.patientA.userId, 0);
    if (n === 5) return uploadMany(accounts.patientA, undefined, 1);
    if (n === 6) return uploadMany(accounts.patientA, accounts.patientA.userId, 11);
    if (n === 7) return uploadMany(accounts.patientA, 'abc', 1);
    if (n === 8) return uploadMany(accounts.patientA, accounts.patientB.userId, 1);
    if (n === 9) return uploadMany(accounts.patientA, accounts.patientA.userId, 1, { emptyAt: 0 });
    if (n === 10 || n === 11) {
        const before = await api('get', `/api/image-attachments/user/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token });
        expectCode(before, OK);
        const priorIds = new Set(itemsOf(before).map(item => String(idOf(item, ['id', 'attachment_id']))));
        const response = await uploadMany(accounts.patientA, accounts.patientA.userId,
            n === 10 ? 3 : 2, n === 10 ? { types: ['png', 'txt', 'jpeg'] } : { sizeAt: 1 });
        const after = await api('get', `/api/image-attachments/user/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token });
        expectCode(after, OK);
        for (const item of itemsOf(after)) {
            const id = String(idOf(item, ['id', 'attachment_id']));
            if (!priorIds.has(id)) attachments.set(id, accounts.patientA);
        }
        return response;
    }
    if (n === 12) return api('post', '/api/image-attachments/upload-multiple', { user_id: accounts.patientA.userId });
    if (n >= 13) return authCase(n === 13 ? 'missing' : n === 14 ? 'invalid' : n === 15 ? 'expired' : 'logout',
        'post', '/api/image-attachments/upload-multiple', undefined, accounts.patientA);
}

async function runAttachmentList(n) {
    const target = n === 7 ? accounts.patientB : accounts.patientA;
    if (n === 1 || n === 2 || n === 4 || n === 5) {
        await upload(accounts.patientA);
        await upload(accounts.patientA);
    }
    if (n === 3) {
        const empty = await registerAccount('empty', 'patient', roles.patient);
        return api('get', `/api/image-attachments/user/${empty.userId}`, undefined, { token: empty.token });
    }
    if (n === 7) {
        const disposable = await registerAccount('deleted-target', 'patient', roles.patient);
        const id = disposable.userId;
        await adapterCall('deleteUser', { phone: disposable.phone });
        phones.delete(disposable.phone);
        return api('get', `/api/image-attachments/user/${id}`, undefined, { token: accounts.admin.token });
    }
    if (n === 8 || n === 9) return api('get', `/api/image-attachments/user/${n === 8 ? 'abc' : '0'}`, undefined, { token: accounts.admin.token });
    if (n >= 10) return authCase(n === 10 ? 'missing' : n === 11 ? 'invalid' : n === 12 ? 'expired' : 'logout',
        'get', `/api/image-attachments/user/${accounts.patientA.userId}`, undefined, accounts.patientA);
    const actor = n === 2 ? accounts.doctor : n === 1 || n === 3 || n === 4 || n === 5 ? accounts.patientA : accounts.patientA;
    if (n === 6) return api('get', `/api/image-attachments/user/${accounts.patientB.userId}`, undefined, { token: accounts.patientA.token });
    const response = await api('get', `/api/image-attachments/user/${target.userId}`, undefined, { token: actor.token });
    if ([1, 2, 4, 5].includes(n)) {
        expect(itemsOf(response).length).toBeGreaterThan(0);
        if (n === 4) expect(itemsOf(response).every(item => String(item.user_id) === String(accounts.patientA.userId))).toBe(true);
        if (n === 5) expect(itemsOf(response).map(item => item.created_at).filter(Boolean)).toEqual(
            [...itemsOf(response).map(item => item.created_at).filter(Boolean)].sort().reverse());
    }
    return response;
}

async function runAttachmentView(n) {
    if (n === 5) return api('get', '/api/image-attachments/view/abc', undefined, { token: accounts.patientA.token });
    if (n === 6) return api('get', '/api/image-attachments/view/0', undefined, { token: accounts.patientA.token });
    if (n === 4) {
        const id = await upload(accounts.patientA).then(r => { expectCode(r, OK); return requiredId(r, ['id', 'attachment_id'], 'upload'); });
        await api('delete', `/api/image-attachments/${id}`, undefined, { token: accounts.patientA.token });
        attachments.delete(id);
        return api('get', `/api/image-attachments/view/${id}`, undefined, { token: accounts.patientA.token });
    }
    const owner = accounts.patientA;
    const file = await upload(owner);
    expectCode(file, OK);
    const id = requiredId(file, ['id', 'attachment_id'], 'upload');
    if (n === 7) return api('get', `/api/image-attachments/view/${id}`);
    if (n === 8) {
        let response = await authCase('invalid', 'get', `/api/image-attachments/view/${id}`, undefined, owner);
        expectCode(response, '9998');
        response = await authCase('expired', 'get', `/api/image-attachments/view/${id}`, undefined, owner);
        expectCode(response, '9998');
        return authCase('logout', 'get', `/api/image-attachments/view/${id}`, undefined, owner);
    }
    if (n === 3) return api('get', `/api/image-attachments/view/${id}`, undefined, { token: accounts.patientB.token });
    const actor = n === 2 ? accounts.doctor : owner;
    const response = await api('get', `/api/image-attachments/view/${id}`, undefined, { token: actor.token });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\//);
    expect(Buffer.compare(response.body, imageBytes('png'))).toBe(0);
    return response;
}

async function runAttachmentDelete(n) {
    if (n === 8) return api('delete', '/api/image-attachments/abc', undefined, { token: accounts.patientA.token });
    if (n === 9) return api('delete', '/api/image-attachments/0', undefined, { token: accounts.patientA.token });
    if (n === 10) {
        const id = await upload(accounts.patientA).then(r => { expectCode(r, OK); return requiredId(r, ['id', 'attachment_id'], 'upload'); });
        await api('delete', `/api/image-attachments/${id}`, undefined, { token: accounts.patientA.token });
        attachments.delete(id);
        return api('delete', `/api/image-attachments/${id}`, undefined, { token: accounts.patientA.token });
    }
    if (n >= 11) {
        const file = await upload(accounts.patientA);
        expectCode(file, OK);
        const id = requiredId(file, ['id', 'attachment_id'], 'upload');
        return authCase(n === 11 ? 'missing' : n === 12 ? 'invalid' : n === 13 ? 'expired' : 'logout',
            'delete', `/api/image-attachments/${id}`, undefined, accounts.patientA);
    }
    const file = await upload(accounts.patientA);
    expectCode(file, OK);
    const id = requiredId(file, ['id', 'attachment_id'], 'upload');
    if (n === 5) {
        const p = await photoFixture();
        return api('delete', `/api/image-attachments/${p.attachmentId}`, undefined, { token: accounts.patientA.token });
    }
    if (n === 6 || n === 7) {
        const actor = n === 6 ? accounts.patientB : accounts.doctor;
        return api('delete', `/api/image-attachments/${id}`, undefined, { token: actor.token });
    }
    const actor = n === 2 ? accounts.admin : accounts.patientA;
    const response = await api('delete', `/api/image-attachments/${id}`, undefined, { token: actor.token });
    if (n === 1 || n === 2) attachments.delete(id);
    if (n === 3 || n === 4) {
        if (n === 4) {
            expectCode(response, OK);
            attachments.delete(id);
            return api('delete', `/api/image-attachments/${id}`, undefined, { token: actor.token });
        }
        const view = await api('get', `/api/image-attachments/view/${id}`, undefined, { token: actor.token });
        const listed = await api('get', `/api/image-attachments/user/${accounts.patientA.userId}`, undefined, { token: actor.token });
        expectCode(view, '9992');
        expect(itemsOf(listed).some(item => String(idOf(item, ['id', 'attachment_id'])) === id)).toBe(false);
        return view;
    }
    return response;
}

function photoPayload(base, extra = {}) {
    return { episode_id: base.episodeId, location_id: base.locationId, attachment_id: base.attachmentId, milestone: 'start', ...extra };
}

async function runPhotoCreate(n) {
    const owner = n === 23 || n === 24 ? accounts.patientB : accounts.patientA;
    const actor = n === 4 ? accounts.doctor : n === 31 || n === 23 || n === 24 ? accounts.patientA : accounts.patientA;
    const base = await locationFixture(owner, n === 4 ? accounts.doctor : owner);
    const uploaded = await upload(n === 23 ? accounts.patientB : actor);
    expectCode(uploaded, OK);
    const attachmentId = requiredId(uploaded, ['id', 'attachment_id'], 'upload');
    const payload = photoPayload({ ...base, attachmentId });
    if (n === 3) Object.assign(payload, { taken_at: '2026-01-02 12:00:00', itch_score: '0', pain_score: '10', burn_score: '3', hives_count: '5', local_auas: '2', annotated_url: 'https://example.test/a.jpg' });
    if (n === 6) Object.assign(payload, { itch_score: '0', pain_score: '10' });
    if (n === 7) delete payload.episode_id;
    if (n === 8) Object.keys(payload).forEach(key => delete payload[key]);
    if (n === 9) payload.episode_id = 'abc';
    if (n === 10) payload.episode_id = '0';
    if (n === 11) payload.itch_score = 5;
    if (n === 12) payload.milestone = 'begin';
    if (n === 13) payload.itch_score = '11';
    if (n === 14) payload.hives_count = '501';
    if (n === 15) payload.local_auas = '101';
    if (n === 16) payload.annotated_url = 'ftp://invalid.test/a';
    if (n === 17) payload.taken_at = '24/04/2026';
    if (n === 18) payload.taken_at = '2999-01-01 00:00:00';
    if (n === 19) {
        const other = await locationFixture();
        payload.location_id = other.locationId;
    }
    if (n === 20) payload.episode_id = await deletedEpisodeId();
    if (n === 21) payload.location_id = await deletedLocationId();
    if (n === 22) payload.attachment_id = await deletedAttachmentId();
    if (n === 25) {
        const closedRecordId = await createRecord(accounts.patientA, accounts.doctor);
        const ep = await api('post', '/api/lesion-episodes', { medical_record_id: closedRecordId, name: uniqueName('closed') }, { token: accounts.patientA.token });
        expectCode(ep, OK);
        const episodeId = requiredId(ep, ['episode_id', 'id'], 'closed episode');
        episodes.set(episodeId, accounts.patientA);
        const loc = await api('post', '/api/lesion-locations', { episode_id: episodeId, body_part: uniqueName('closed') }, { token: accounts.patientA.token });
        expectCode(loc, OK);
        const locationId = requiredId(loc, ['lesion_location_id', 'location_id', 'id'], 'closed location');
        locations.set(locationId, accounts.patientA);
        const close = await api('put', `/api/medical_records/${closedRecordId}`, { status: 'completed' }, { token: accounts.doctor.token });
        expectCode(close, OK);
        payload.episode_id = episodeId;
        payload.location_id = locationId;
    }
    if (n === 26) return api('post', '/api/lesion-photos', undefined, { token: actor.token, rawBody: '{' });
    if (n >= 27 && n <= 30) return authCase(n === 27 ? 'missing' : n === 28 ? 'invalid' : n === 29 ? 'expired' : 'logout',
        'post', '/api/lesion-photos', payload, accounts.patientA);
    if (n === 31) return api('post', '/api/lesion-photos', payload, { token: accounts.admin.token });
    if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6) {
        const response = await api('post', '/api/lesion-photos', payload, { token: actor.token });
        if (String(response?.body?.code) === OK) {
            const photoId = requiredId(response, ['photo_id', 'id'], 'photo creation');
            photos.set(photoId, actor);
            if (n === 2) {
                const deleted = await api('delete', `/api/lesion-photos/${photoId}`, undefined, { token: actor.token });
                expectCode(deleted, OK);
                photos.delete(photoId);
                const nextUpload = await upload(actor);
                expectCode(nextUpload, OK);
                const second = await api('post', '/api/lesion-photos', { ...payload, attachment_id: requiredId(nextUpload, ['id', 'attachment_id'], 'second upload') }, { token: actor.token });
                expectCode(second, OK);
                const nextId = requiredId(second, ['photo_id', 'id'], 'second photo');
                photos.set(nextId, actor);
                expect(nextId).not.toBe(photoId);
            }
            if (n === 5) {
                const listed = await api('get', `/api/lesion-photos/location/${base.locationId}`, undefined, { token: actor.token });
                expect(itemsOf(listed).some(item => String(idOf(item, ['photo_id', 'id'])) === photoId)).toBe(true);
            }
            if (n === 3) expect(dataOf(response)).toEqual(expect.objectContaining({ episode_id: base.episodeId, location_id: base.locationId }));
        }
        return response;
    }
    return api('post', '/api/lesion-photos', payload, { token: actor.token });
}

async function deletedEpisodeId() {
    const base = await episodeFixture();
    const response = await api('delete', `/api/lesion-episodes/${base.episodeId}`, undefined, { token: base.actor.token });
    expectCode(response, OK);
    episodes.delete(base.episodeId);
    return base.episodeId;
}

async function deletedLocationId() {
    const base = await locationFixture();
    const response = await api('delete', `/api/lesion-locations/${base.locationId}`, undefined, { token: base.actor.token });
    expectCode(response, OK);
    locations.delete(base.locationId);
    return base.locationId;
}

async function deletedAttachmentId() {
    const response = await upload(accounts.patientA);
    expectCode(response, OK);
    const id = requiredId(response, ['id', 'attachment_id'], 'attachment upload');
    const deleted = await api('delete', `/api/image-attachments/${id}`, undefined, { token: accounts.patientA.token });
    expectCode(deleted, OK);
    attachments.delete(id);
    return id;
}

async function createPhoto(base, actor = base.actor || accounts.patientA, fields = {}) {
    const uploadResult = await upload(actor);
    expectCode(uploadResult, OK);
    const attachmentId = requiredId(uploadResult, ['id', 'attachment_id'], 'attachment upload');
    const response = await api('post', '/api/lesion-photos', photoPayload({ ...base, attachmentId }, fields), { token: actor.token });
    expectCode(response, OK);
    const id = requiredId(response, ['photo_id', 'id'], 'photo creation');
    photos.set(id, actor);
    return { ...base, attachmentId, photoId: id };
}

async function runPhotoList(n) {
    if (n === 6) return api('get', '/api/lesion-photos/location/abc', undefined, { token: accounts.patientA.token });
    if (n === 7) return api('get', '/api/lesion-photos/location/0', undefined, { token: accounts.patientA.token });
    if (n === 8) return api('get', `/api/lesion-photos/location/${await deletedLocationId()}`, undefined, { token: accounts.patientA.token });
    if (n === 9) return api('get', `/api/lesion-photos/location/${await deletedLocationId()}`, undefined, { token: accounts.patientA.token });
    if (n >= 10) {
        const base = await locationFixture();
        return authCase(n === 10 ? 'missing' : n === 11 ? 'invalid' : n === 12 ? 'expired' : 'logout',
            'get', `/api/lesion-photos/location/${base.locationId}`, undefined, accounts.patientA);
    }
    const base = await locationFixture(n === 5 ? accounts.patientB : accounts.patientA);
    if (n === 1 || n === 2 || n === 4) {
        const photo = await createPhoto(base, n === 2 ? accounts.doctor : base.owner, { taken_at: '2026-01-02 10:00:00' });
        if (n === 4) await createPhoto(base, base.owner, { taken_at: '2026-01-01 10:00:00' });
        const actor = n === 2 ? accounts.doctor : base.owner;
        const response = await api('get', `/api/lesion-photos/location/${base.locationId}`, undefined, { token: actor.token });
        if (n === 1 || n === 2) expect(itemsOf(response).some(item => String(idOf(item, ['photo_id', 'id'])) === photo.photoId)).toBe(true);
        if (n === 4) expect(itemsOf(response).length).toBeGreaterThanOrEqual(2);
        return response;
    }
    const actor = n === 5 ? accounts.patientA : base.owner;
    return api('get', `/api/lesion-photos/location/${base.locationId}`, undefined, { token: actor.token });
}

async function runPhotoUpdate(n) {
    if (n === 13) return api('patch', '/api/lesion-photos/abc/milestone', { milestone: 'peak' }, { token: accounts.patientA.token });
    if (n === 14) return api('patch', '/api/lesion-photos/0/milestone', { milestone: 'peak' }, { token: accounts.patientA.token });
    if (n === 15 || n === 16) {
        const base = await photoFixture();
        await api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
        photos.delete(base.photoId);
        return api('patch', `/api/lesion-photos/${base.photoId}/milestone`, { milestone: 'peak' }, { token: accounts.patientA.token });
    }
    if (n === 17) {
        const base = await photoFixture(accounts.patientB);
        return api('patch', `/api/lesion-photos/${base.photoId}/milestone`, { milestone: 'peak' }, { token: accounts.patientA.token });
    }
    if (n === 18) {
        const recordId = await createRecord(accounts.patientA, accounts.doctor);
        const ep = await api('post', '/api/lesion-episodes', { medical_record_id: recordId, name: uniqueName('closed') }, { token: accounts.patientA.token });
        expectCode(ep, OK);
        const episodeId = requiredId(ep, ['episode_id', 'id']);
        episodes.set(episodeId, accounts.patientA);
        const loc = await api('post', '/api/lesion-locations', { episode_id: episodeId, body_part: uniqueName() }, { token: accounts.patientA.token });
        expectCode(loc, OK);
        const locationId = requiredId(loc, ['lesion_location_id', 'location_id', 'id']);
        locations.set(locationId, accounts.patientA);
        const base = { recordId, episodeId, locationId };
        const file = await upload(accounts.patientA); expectCode(file, OK);
        const create = await api('post', '/api/lesion-photos', photoPayload({ ...base, attachmentId: requiredId(file, ['id', 'attachment_id']) }), { token: accounts.patientA.token });
        expectCode(create, OK);
        const id = requiredId(create, ['photo_id', 'id'], 'closed photo');
        photos.set(id, accounts.patientA);
        const close = await api('put', `/api/medical_records/${recordId}`, { status: 'completed' }, { token: accounts.doctor.token });
        expectCode(close, OK);
        return api('patch', `/api/lesion-photos/${id}/milestone`, { milestone: 'peak' }, { token: accounts.patientA.token });
    }
    if (n === 19 || n >= 20) {
        const base = await photoFixture();
        const path = `/api/lesion-photos/${base.photoId}/milestone`;
        if (n === 19) return api('patch', path, undefined, { token: accounts.patientA.token, rawBody: '{' });
        if (n <= 23) return authCase(n === 20 ? 'missing' : n === 21 ? 'invalid' : n === 22 ? 'expired' : 'logout',
            'patch', path, { milestone: 'peak' }, accounts.patientA);
        return api('patch', path, { milestone: 'peak' }, { token: accounts.admin.token });
    }
    const base = await photoFixture();
    let body = { milestone: 'peak' };
    if (n === 2) body = { itch_score: '4', pain_score: '3', burn_score: '2', hives_count: '12', local_auas: '10', annotated_url: 'https://example.test/photo.png' };
    if (n === 3) body = { itch_score: null };
    if (n === 5) body = {};
    if (n === 6) body = { itch_score: 5 };
    if (n === 7) body = { milestone: 'begin' };
    if (n === 8) body = { itch_score: '11' };
    if (n === 9) body = { hives_count: '501' };
    if (n === 10) body = { local_auas: '101' };
    if (n === 11) body = { annotated_url: 'ftp://bad.test' };
    if (n === 12) body = { photo_id: '999999', episode_id: '999999', attachment_id: '999999', taken_at: '2999-01-01 00:00:00', milestone: 'peak' };
    const response = await api('patch', `/api/lesion-photos/${base.photoId}/milestone`, body, { token: accounts.patientA.token });
    if (String(response?.body?.code) === OK && [1, 2, 3, 4, 12].includes(n)) {
        const reread = await api('get', `/api/lesion-photos/location/${base.locationId}`, undefined, { token: accounts.patientA.token });
        expectCode(reread, OK);
        const item = itemsOf(reread).find(value => String(idOf(value, ['photo_id', 'id'])) === base.photoId);
        expect(item).toBeDefined();
        if (n === 1) expect(item.milestone).toBe('peak');
        if (n === 3) expect(item.itch_score === null || item.itch_score === undefined).toBe(true);
        if (n === 12) expect(item).toEqual(expect.objectContaining({ episode_id: base.episodeId, attachment_id: base.attachmentId }));
    }
    return response;
}

async function runPhotoDelete(n) {
    if (n === 5) return api('delete', '/api/lesion-photos/abc', undefined, { token: accounts.patientA.token });
    if (n === 6) return api('delete', '/api/lesion-photos/0', undefined, { token: accounts.patientA.token });
    if (n === 7) {
        const base = await photoFixture();
        await api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
        photos.delete(base.photoId);
        return api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
    }
    if (n >= 10 && n <= 13) {
        const base = await photoFixture();
        return authCase(n === 10 ? 'missing' : n === 11 ? 'invalid' : n === 12 ? 'expired' : 'logout',
            'delete', `/api/lesion-photos/${base.photoId}`, undefined, accounts.patientA);
    }
    if (n === 14) {
        const base = await photoFixture();
        return api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.admin.token });
    }
    const base = await photoFixture(n === 8 ? accounts.patientB : accounts.patientA);
    if (n === 3) {
        const response = await api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
        expectCode(response, OK);
        photos.delete(base.photoId);
        const view = await api('get', `/api/image-attachments/view/${base.attachmentId}`, undefined, { token: accounts.patientA.token });
        expect(view.status).toBe(200);
        return view;
    }
    if (n === 4 || n === 7) {
        const first = await api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
        expectCode(first, OK);
        photos.delete(base.photoId);
        return api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
    }
    if (n === 8) return api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
    if (n === 9) {
        const openRecordId = await createRecord(accounts.patientA, accounts.doctor);
        const ep = await api('post', '/api/lesion-episodes', { medical_record_id: openRecordId, name: uniqueName('closed') }, { token: accounts.patientA.token });
        expectCode(ep, OK);
        const episodeId = requiredId(ep, ['episode_id', 'id']);
        episodes.set(episodeId, accounts.patientA);
        const loc = await api('post', '/api/lesion-locations', { episode_id: episodeId, body_part: uniqueName('closed') }, { token: accounts.patientA.token });
        expectCode(loc, OK);
        const locationId = requiredId(loc, ['lesion_location_id', 'location_id', 'id']);
        locations.set(locationId, accounts.patientA);
        const file = await upload(accounts.patientA); expectCode(file, OK);
        const attachmentId = requiredId(file, ['id', 'attachment_id']);
        const created = await api('post', '/api/lesion-photos', photoPayload({ episodeId, locationId, attachmentId }), { token: accounts.patientA.token });
        expectCode(created, OK);
        const photoId = requiredId(created, ['photo_id', 'id']);
        photos.set(photoId, accounts.patientA);
        expectCode(await api('put', `/api/medical_records/${openRecordId}`, { status: 'completed' }, { token: accounts.doctor.token }), OK);
        return api('delete', `/api/lesion-photos/${photoId}`, undefined, { token: accounts.patientA.token });
    }
    const response = await api('delete', `/api/lesion-photos/${base.photoId}`, undefined, { token: accounts.patientA.token });
    if (n === 1 || n === 2) photos.delete(base.photoId);
    if (n === 2) {
        const listed = await api('get', `/api/lesion-photos/location/${base.locationId}`, undefined, { token: accounts.patientA.token });
        expectCode(listed, OK);
        expect(itemsOf(listed).some(item => String(idOf(item, ['photo_id', 'id'])) === base.photoId)).toBe(false);
    }
    return response;
}

async function runAnswerImageCreate(n) {
    const actor = n === 3 ? accounts.doctor : n === 22 ? accounts.admin : accounts.patientA;
    const owner = n === 13 ? accounts.patientB : accounts.patientA;
    const answer = await answerFixture(owner);
    const uploadOwner = n === 12 ? accounts.patientB : owner;
    const file = await upload(uploadOwner);
    expectCode(file, OK);
    const attachmentId = requiredId(file, ['id', 'attachment_id'], 'attachment upload');
    const body = { answer_id: answer.answerId, attachment_id: attachmentId };
    if (n === 2) body.option_value = 'front_view';
    if (n === 5) delete body.answer_id;
    if (n === 6) { delete body.answer_id; delete body.attachment_id; }
    if (n === 7) body.answer_id = 'abc';
    if (n === 8) body.answer_id = '0';
    if (n === 9) body.option_value = 'x'.repeat(101);
    if (n === 10) body.answer_id = await deletedAnswerId();
    if (n === 11) body.attachment_id = await deletedAttachmentId();
    if (n === 14 || n === 15) {
        if (n === 14) {
            const first = await api('post', '/api/answer-images', body, { token: actor.token });
            expectCode(first, OK);
            answerImages.set(requiredId(first, ['id', 'answer_image_id']), actor);
        } else {
            for (let i = 0; i < 10; i++) {
                const other = await upload(owner); expectCode(other, OK);
                const link = await api('post', '/api/answer-images', { answer_id: answer.answerId, attachment_id: requiredId(other, ['id', 'attachment_id']) }, { token: actor.token });
                expectCode(link, OK);
                answerImages.set(requiredId(link, ['id', 'answer_image_id']), actor);
            }
        }
    }
    if (n === 16) {
        const closedAnswer = await answerFixture(accounts.patientA, accounts.doctor);
        const closed = await api('put', `/api/medical_records/${closedAnswer.medicalRecordId}`, { status: 'completed' }, { token: accounts.doctor.token });
        expectCode(closed, OK);
        body.answer_id = closedAnswer.answerId;
    }
    if (n === 17) return api('post', '/api/answer-images', undefined, { token: actor.token, rawBody: '{' });
    if (n >= 18 && n <= 21) return authCase(n === 18 ? 'missing' : n === 19 ? 'invalid' : n === 20 ? 'expired' : 'logout',
        'post', '/api/answer-images', body, accounts.patientA);
    return api('post', '/api/answer-images', body, { token: actor.token });
}

async function deletedAnswerId() {
    const answer = await answerFixture();
    await deleteRecord(answer.medicalRecordId);
    return answer.answerId;
}

async function runAnswerImageList(n) {
    if (n === 5) return api('get', '/api/answer-images/abc', undefined, { token: accounts.patientA.token });
    if (n === 6) return api('get', '/api/answer-images/0', undefined, { token: accounts.patientA.token });
    if (n === 7 || n === 8) return api('get', `/api/answer-images/${await deletedAnswerId()}`, undefined, { token: accounts.patientA.token });
    if (n >= 9) {
        const answer = await answerFixture();
        return authCase(n === 9 ? 'missing' : n === 10 ? 'invalid' : n === 11 ? 'expired' : 'logout',
            'get', `/api/answer-images/${answer.answerId}`, undefined, accounts.patientA);
    }
    const owner = n === 4 ? accounts.patientB : accounts.patientA;
    const answer = await answerFixture(owner);
    if (n === 1 || n === 2) {
        const file = await upload(owner); expectCode(file, OK);
        const link = await api('post', '/api/answer-images', { answer_id: answer.answerId, attachment_id: requiredId(file, ['id', 'attachment_id']) }, { token: n === 2 ? accounts.doctor.token : owner.token });
        expectCode(link, OK); answerImages.set(requiredId(link, ['id', 'answer_image_id']), n === 2 ? accounts.doctor : owner);
    }
    const actor = n === 2 ? accounts.doctor : n === 4 ? accounts.patientA : owner;
    return api('get', `/api/answer-images/${answer.answerId}`, undefined, { token: actor.token });
}

async function runAnswerImageDelete(n) {
    if (n === 4) return api('delete', '/api/answer-images/abc', undefined, { token: accounts.patientA.token });
    if (n === 5) return api('delete', '/api/answer-images/0', undefined, { token: accounts.patientA.token });
    if (n === 6) {
        const link = await linkFixture();
        await api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
        answerImages.delete(link.linkId);
        return api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
    }
    if (n >= 9 && n <= 12) {
        const link = await linkFixture();
        return authCase(n === 9 ? 'missing' : n === 10 ? 'invalid' : n === 11 ? 'expired' : 'logout',
            'delete', `/api/answer-images/${link.linkId}`, undefined, accounts.patientA);
    }
    if (n === 13) {
        const link = await linkFixture();
        return api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.admin.token });
    }
    const link = await linkFixture(n === 7 ? accounts.patientB : accounts.patientA,
        n === 8 ? accounts.doctor : n === 7 ? accounts.patientB : accounts.patientA);
    if (n === 2) {
        const response = await api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
        expectCode(response, OK);
        answerImages.delete(link.linkId);
        const list = await api('get', `/api/answer-images/${link.answerId}`, undefined, { token: accounts.patientA.token });
        expectCode(list, OK);
        expect(itemsOf(list).some(item => String(idOf(item, ['id', 'answer_image_id'])) === link.linkId)).toBe(false);
        const view = await api('get', `/api/image-attachments/view/${link.attachmentId}`, undefined, { token: accounts.patientA.token });
        expect(view.status).toBe(200);
        return response;
    }
    if (n === 7) return api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
    if (n === 8) {
        expectCode(await api('put', `/api/medical_records/${link.medicalRecordId}`, { status: 'completed' }, { token: accounts.doctor.token }), OK);
        return api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
    }
    const response = await api('delete', `/api/answer-images/${link.linkId}`, undefined, { token: accounts.patientA.token });
    if (n === 1) answerImages.delete(link.linkId);
    return response;
}

async function runAnswerImageBulk(n) {
    const answer = await answerFixture(accounts.patientA, n === 15 ? accounts.doctor : accounts.patientA);
    const uploads = [];
    const addUpload = async actor => {
        const response = await upload(actor);
        expectCode(response, OK);
        return requiredId(response, ['id', 'attachment_id'], 'attachment upload');
    };
    if ([1, 2, 11, 14].includes(n)) {
        const count = n === 1 ? 3 : n === 2 ? 10 : n === 14 ? 10 : 1;
        for (let i = 0; i < count; i++) uploads.push(await addUpload(accounts.patientA));
        if (n === 11) {
            const first = await api('post', '/api/answer-images', { answer_id: answer.answerId, attachment_id: uploads[0] }, { token: accounts.patientA.token });
            expectCode(first, OK); answerImages.set(requiredId(first, ['id', 'answer_image_id']), accounts.patientA);
        }
    }
    if (n === 8) {
        const id = await addUpload(accounts.patientA);
        uploads.push(id, id);
    }
    if (n === 9) for (let i = 0; i < 11; i++) uploads.push(await addUpload(accounts.patientA));
    if (n === 10) uploads.push(await addUpload(accounts.patientA), '999999999');
    if (n === 12) uploads.push(await addUpload(accounts.patientB));
    if (n === 3) return api('post', '/api/answer-images/bulk', {}, { token: accounts.patientA.token });
    if (n === 4) return api('post', '/api/answer-images/bulk', { answer_id: answer.answerId, attachments: [] }, { token: accounts.patientA.token });
    if (n === 5) return api('post', '/api/answer-images/bulk', { answer_id: answer.answerId, attachments: 'abc' }, { token: accounts.patientA.token });
    if (n === 6) return api('post', '/api/answer-images/bulk', { answer_id: 'abc', attachments: [] }, { token: accounts.patientA.token });
    if (n === 7) return api('post', '/api/answer-images/bulk', { answer_id: 0, attachments: [{ attachment_id: -1 }] }, { token: accounts.patientA.token });
    if (n === 10) {
        const absentAttachment = await deletedAttachmentId();
        const validAttachment = await addUpload(accounts.patientA);
        return api('post', '/api/answer-images/bulk', {
            answer_id: answer.answerId,
            attachments: [{ attachment_id: validAttachment }, { attachment_id: absentAttachment }]
        }, { token: accounts.patientA.token });
    }
    if (n === 13) return api('post', '/api/answer-images/bulk', {
        answer_id: await deletedAnswerId(),
        attachments: [{ attachment_id: await addUpload(accounts.patientA) }]
    }, { token: accounts.patientA.token });
    if (n === 14) {
        const existing = await api('post', '/api/answer-images', {
            answer_id: answer.answerId,
            attachment_id: await addUpload(accounts.patientA)
        }, { token: accounts.patientA.token });
        expectCode(existing, OK);
        answerImages.set(requiredId(existing, ['id', 'answer_image_id']), accounts.patientA);
    }
    if (n === 15) {
        const closedAnswer = answer;
        const closed = await api('put', `/api/medical_records/${closedAnswer.medicalRecordId}`, { status: 'completed' }, { token: accounts.doctor.token });
        expectCode(closed, OK);
        return api('post', '/api/answer-images/bulk', { answer_id: closedAnswer.answerId, attachments: [{ attachment_id: await addUpload(accounts.patientA) }] }, { token: accounts.patientA.token });
    }
    if (n === 16) return api('post', '/api/answer-images/bulk', undefined, { token: accounts.patientA.token, rawBody: '{' });
    if (n >= 17 && n <= 20) return authCase(n === 17 ? 'missing' : n === 18 ? 'invalid' : n === 19 ? 'expired' : 'logout',
        'post', '/api/answer-images/bulk', { answer_id: answer.answerId, attachments: [] }, accounts.patientA);
    if (n === 21) return api('post', '/api/answer-images/bulk', { answer_id: answer.answerId, attachments: [] }, { token: accounts.admin.token });
    const response = await api('post', '/api/answer-images/bulk', {
        answer_id: answer.answerId,
        attachments: uploads.map(attachment_id => ({ attachment_id }))
    }, { token: accounts.patientA.token });
    if ([1, 2].includes(n) && String(response?.body?.code) === OK) {
        expect(dataOf(response)?.total).toBe(String(n === 1 ? 3 : 10));
        expect(itemsOf(response)).toHaveLength(n === 1 ? 3 : 10);
    }
    return response;
}

async function createScore(recordId, actor = accounts.patientA, fields = {}) {
    return api('post', '/api/uas7-scores', {
        medical_record_id: recordId,
        score_date: new Date().toISOString().slice(0, 10),
        iss7: '2',
        hss7: '1',
        ...fields
    }, { token: actor.token });
}

async function runEligibility(n) {
    const endpoint = '/api/uas7-scores/eligibility';
    if (n >= 7 && n <= 10) return authCase(n === 7 ? 'missing' : n === 8 ? 'invalid' : n === 9 ? 'expired' : 'logout', 'get', endpoint, undefined, accounts.patientA);
    if (n >= 11) return api('get', endpoint, undefined, { token: accounts[n === 11 ? 'doctor' : n === 12 ? 'nurse' : 'admin'].token });
    if (n === 1) {
        const id = await createRecord(accounts.patientA, accounts.doctor);
        const response = await api('get', endpoint, undefined, { token: accounts.patientA.token });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual(expect.objectContaining({ eligible: 'true', medical_record_id: expect.anything() }));
        expect(String(dataOf(response).medical_record_id)).toBe(id);
        return response;
    }
    if (n === 2) {
        const empty = await registerAccount('no-records', 'patient', roles.patient);
        return api('get', endpoint, undefined, { token: empty.token });
    }
    if (n === 3) {
        await createRecord();
        return api('get', endpoint, undefined, { token: accounts.patientA.token });
    }
    if (n === 4) {
        await closedRecord();
        return api('get', endpoint, undefined, { token: accounts.patientA.token });
    }
    const old = await createRecord(accounts.patientA, accounts.doctor);
    await new Promise(resolve => setTimeout(resolve, 5));
    const latest = await createRecord(accounts.patientA, accounts.doctor);
    const response = await api('get', endpoint, undefined, { token: accounts.patientA.token });
    expect(String(dataOf(response)?.medical_record_id)).toBe(latest);
    expect(old).not.toBe(latest);
    return response;
}

async function runScoreCreate(n) {
    const recordId = n === 18 ? await deletedRecord() : n === 19 ? await createRecord(accounts.patientB, accounts.doctor) :
        n === 20 ? await createRecord() : n === 21 ? await closedRecord() : await createRecord(accounts.patientA, accounts.doctor);
    const body = { medical_record_id: recordId, score_date: new Date().toISOString().slice(0, 10), iss7: '2', hss7: '1' };
    if (n === 2) {
        const first = await createScore(recordId); expectCode(first, OK);
        return createScore(recordId);
    }
    if (n === 3) body.score_date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (n === 4) Object.assign(body, { iss7: '0', hss7: '3' });
    if (n === 5) body.note = 'Weekly symptoms';
    if (n === 6) {
        let response;
        for (const field of ['medical_record_id', 'iss7', 'hss7']) {
            const missing = { ...body };
            delete missing[field];
            response = await api('post', '/api/uas7-scores', missing, { token: accounts.patientA.token });
            expectCode(response, '1002');
        }
        return response;
    }
    if (n === 7) {
        delete body.score_date;
        return api('post', '/api/uas7-scores', body, { token: accounts.patientA.token });
    }
    if (n === 8) return api('post', '/api/uas7-scores', {}, { token: accounts.patientA.token });
    if (n === 9) Object.assign(body, { iss7: 3, hss7: 2 });
    if (n === 10) Object.assign(body, { medical_record_id: true, score_date: 123, note: 123 });
    if (n === 11) body.score_date = '2026-13-40';
    if (n === 12) body.score_date = '2999-01-01';
    if (n === 13) body.iss7 = '4';
    if (n === 14) body.hss7 = '-1';
    if (n === 15) body.note = '<b>' + 'x'.repeat(501);
    if (n === 16) body.medical_record_id = 'abc';
    if (n === 17) body.medical_record_id = '0';
    if (n === 20) body.medical_record_id = recordId;
    if (n === 21) body.medical_record_id = recordId;
    if (n === 22) return api('post', '/api/uas7-scores', undefined, { token: accounts.patientA.token, rawBody: '{' });
    if (n >= 23 && n <= 26) return authCase(n === 23 ? 'missing' : n === 24 ? 'invalid' : n === 25 ? 'expired' : 'logout',
        'post', '/api/uas7-scores', body, accounts.patientA);
    if (n >= 27) return api('post', '/api/uas7-scores', body, {
        token: accounts[n === 27 ? 'doctor' : n === 28 ? 'nurse' : 'admin'].token
    });
    return createScore(recordId, accounts.patientA, body);
}

async function runScoreList(n, kind) {
    const isWeek = kind === 'week';
    const endpoint = isWeek ? '/api/uas7-scores/week' : '/api/uas7-scores/patient';
    if (n >= (isWeek ? 16 : 9)) {
        const authStart = isWeek ? 16 : 9;
        if (n >= authStart) return authCase(n === authStart ? 'missing' : n === authStart + 1 ? 'invalid' : n === authStart + 2 ? 'expired' : 'logout',
            'get', `${endpoint}/${accounts.patientA.userId}`, undefined, accounts.patientA);
    }
    if (isWeek && n === 10) return api('get', `${endpoint}/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token, query: { start_date: '24/04/2026' } });
    if (isWeek && n === 11) return api('get', `${endpoint}/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token, query: { start_date: '2999-01-01' } });
    if ((isWeek && n === 14) || (!isWeek && n === 7)) return api('get', `${endpoint}/abc`, undefined, { token: accounts.patientA.token });
    if ((isWeek && n === 15) || (!isWeek && n === 8)) return api('get', `${endpoint}/0`, undefined, { token: accounts.patientA.token });
    if ((isWeek && n === 13) || (!isWeek && n === 6)) {
        const disposable = await registerAccount('deleted-patient', 'patient', roles.patient);
        const id = disposable.userId;
        await adapterCall('deleteUser', { phone: disposable.phone });
        phones.delete(disposable.phone);
        return api('get', `${endpoint}/${id}`, undefined, { token: accounts.admin.token });
    }
    if (isWeek && n === 5) {
        const response = await api('get', `${endpoint}/${accounts.patientA.userId}`, undefined, { token: accounts.patientA.token });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual(expect.objectContaining({
            week_score: '0',
            severity_label: 'Không có',
            completed_days: '0'
        }));
        return response;
    }
    if (isWeek && [6, 7, 8].includes(n)) {
        const totals = n === 6 ? [1, 15] : n === 7 ? [16, 27] : [28, 42];
        const expectedLabel = n === 6 ? 'Nhẹ' : n === 7 ? 'Trung bình' : 'Nặng';
        let response;
        for (let i = 0; i < totals.length; i++) {
            const owner = i === 0 ? accounts.patientA : accounts.patientB;
            const recordId = await createRecord(owner, accounts.doctor);
            let remaining = totals[i];
            for (let day = 0; day < 7 && remaining > 0; day++) {
                const daily = Math.min(6, remaining);
                const iss7 = Math.min(3, daily);
                const hss7 = daily - iss7;
                const date = new Date(Date.now() - day * 86400000).toISOString().slice(0, 10);
                expectCode(await createScore(recordId, owner, { score_date: date, iss7: String(iss7), hss7: String(hss7) }), OK);
                remaining -= daily;
            }
            response = await api('get', `${endpoint}/${owner.userId}`, undefined, { token: owner.token });
            expectCode(response, OK);
            expect(dataOf(response)?.week_score).toBe(String(totals[i]));
            expect(dataOf(response)?.severity_label).toBe(expectedLabel);
        }
        return response;
    }
    const owner = n === (isWeek ? 12 : 5) ? accounts.patientB : accounts.patientA;
    const record = await createRecord(owner, accounts.doctor);
    if (n === 1 || n === 2 || n === 4 || (isWeek && n >= 3 && n <= 8)) {
        const scoreDate = new Date().toISOString().slice(0, 10);
        await createScore(record, owner, { score_date: scoreDate });
        if (n === 3 || n === 4) {
            const days = n === 3 ? 6 : 2;
            for (let i = 1; i <= days; i++) {
                const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
                await createScore(record, owner, { score_date: date, iss7: '1', hss7: '1' });
            }
        }
    }
    if (!isWeek && n === 4) {
        const secondRecord = await createRecord(owner, accounts.doctor);
        await createScore(secondRecord, owner, { score_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10) });
    }
    const patientId = n === 6 || (isWeek && n === 13) ? 'abc' : owner.userId;
    const actor = n === 2 ? accounts.doctor : n === 5 || (isWeek && n === 9) ? accounts.patientA : owner;
    const query = isWeek && n === 2 ? { start_date: new Date().toISOString().slice(0, 10) } : undefined;
    const response = await api('get', `${endpoint}/${patientId}`, undefined, { token: actor.token, query });
    if (String(response?.body?.code) === OK && n === 1) {
        expect(itemsOf(response).length).toBeGreaterThan(0);
        expect(itemsOf(response)[0]).toEqual(expect.objectContaining({ patient_id: expect.anything(), medical_record_id: expect.anything(), score_date: expect.any(String) }));
    }
    if (isWeek && String(response?.body?.code) === OK && n <= 9) {
        const data = dataOf(response);
        expect(data).toEqual(expect.objectContaining({ patient_id: expect.anything(), week_score: expect.anything(), severity_label: expect.any(String), completed_days: expect.anything() }));
        if (n === 1) expect(data).toEqual(expect.objectContaining({ week_score: '0', severity_label: 'Không có', completed_days: '0' }));
        if (n === 2) expect(data).toEqual(expect.objectContaining({ week_score: '0', severity_label: 'Không có' }));
        if (n === 3) expect(data.week_score).toBe('15');
        if (n === 4) expect(data.completed_days).toBe('3');
    }
    if (isWeek && n === 9) {
        const patientResult = await api('get', `${endpoint}/${owner.userId}`, undefined, { token: owner.token });
        expectCode(patientResult, OK);
        const staffResult = await api('get', `${endpoint}/${owner.userId}`, undefined, { token: accounts.doctor.token });
        expectCode(staffResult, OK);
        return staffResult;
    }
    return response;
}

async function runCase(testCase) {
    const { prefix, number: n } = testCase;
    switch (prefix) {
        case 'ATU': return runAttachmentUpload(n);
        case 'ATM': return runMultipleUpload(n);
        case 'ATL': return runAttachmentList(n);
        case 'ATV': return runAttachmentView(n);
        case 'ATX': return runAttachmentDelete(n);
        case 'PHC': return runPhotoCreate(n);
        case 'PHL': return runPhotoList(n);
        case 'PHU': return runPhotoUpdate(n);
        case 'PHX': return runPhotoDelete(n);
        case 'AIC': return runAnswerImageCreate(n);
        case 'AIL': return runAnswerImageList(n);
        case 'AIX': return runAnswerImageDelete(n);
        case 'AIB': return runAnswerImageBulk(n);
        case 'U7E': return runEligibility(n);
        case 'U7C': return runScoreCreate(n);
        case 'U7P': return runScoreList(n, 'patient');
        case 'U7W': return runScoreList(n, 'week');
        default: throw new Error(`Unhandled Week 9 case ${testCase.id}.`);
    }
}

async function cleanupAfterEach() {
    const errors = [];
    for (const [id, actor] of [...answerImages]) {
        try {
            const response = await api('delete', `/api/answer-images/${id}`, undefined, { token: actor.token || accounts.admin.token });
            if (!['1000', '9992', '1010'].includes(String(response?.body?.code))) expectCode(response, OK);
            answerImages.delete(id);
        } catch (error) { errors.push(`answer image ${id}: ${error.message}`); }
    }
    for (const id of [...records]) {
        try { await deleteRecord(id); } catch (error) { errors.push(`record ${id}: ${error.message}`); }
    }
    for (const [id, actor] of [...photos]) {
        try {
            const response = await api('delete', `/api/lesion-photos/${id}`, undefined, { token: actor.token || accounts.admin.token });
            if (!['1000', '9992', '1010'].includes(String(response?.body?.code))) expectCode(response, OK);
            photos.delete(id);
        } catch (error) { errors.push(`photo ${id}: ${error.message}`); }
    }
    for (const [id, actor] of [...attachments]) {
        try {
            const response = await api('delete', `/api/image-attachments/${id}`, undefined, { token: actor.token || accounts.admin.token });
            if (!['1000', '9992'].includes(String(response?.body?.code))) expectCode(response, OK);
            attachments.delete(id);
        } catch (error) { errors.push(`attachment ${id}: ${error.message}`); }
    }
    for (const id of [...locations.keys()]) {
        try {
            const actor = locations.get(id);
            const response = await api('delete', `/api/lesion-locations/${id}`, undefined, { token: actor.token });
            if (!['1000', '9992'].includes(String(response?.body?.code))) expectCode(response, OK);
            locations.delete(id);
        } catch (error) { errors.push(`location ${id}: ${error.message}`); }
    }
    for (const id of [...episodes.keys()]) {
        try {
            const actor = episodes.get(id);
            const response = await api('delete', `/api/lesion-episodes/${id}`, undefined, { token: actor.token });
            if (!['1000', '9992'].includes(String(response?.body?.code))) expectCode(response, OK);
            episodes.delete(id);
        } catch (error) { errors.push(`episode ${id}: ${error.message}`); }
    }
    if (errors.length) throw new Error(`Week 9 per-case cleanup failed: ${errors.join('; ')}`);
}

beforeAll(async () => {
    const db = await adapterCall('assertTestDatabase');
    if (db?.isTestDatabase !== true || db.databaseName !== config.databaseName) {
        throw new Error(`Adapter did not confirm isolated test database "${config.databaseName}".`);
    }
    await adapterCall('resetTestHooks');
    roles = await adapterCall('getRoleIds');
    for (const role of ['admin', 'patient', 'doctor', 'nurse']) {
        if (!Number.isInteger(roles?.[role]) || roles[role] <= 0) throw new Error(`getRoleIds() must return a positive ${role} role ID.`);
    }
    if (roles.admin !== 1) throw new Error('Week 9 workbook specifies admin role ID 1.');

    const prepared = await adapterCall('prepareWeek7Fixtures', { uniquePrefix: uniqueName('W9') });
    if (!Array.isArray(prepared?.fixtureIds) || !prepared.fixtureIds.length || !prepared.template?.id ||
        !prepared.questions?.choice?.question_id || !prepared.questions?.text?.question_id ||
        !prepared.questions?.json?.question_id || !prepared.absentQuestionId) {
        throw new Error('prepareWeek7Fixtures() must return the Week 7 template/question fixture and verified absentQuestionId.');
    }
    prepared.fixtureIds.forEach(id => fixtureIds.add(id));
    fixture = prepared;
    accounts = {};
    for (const [label, role] of [
        ['patientA', 'patient'], ['patientB', 'patient'],
        ['doctor', 'doctor'], ['nurse', 'nurse'], ['admin', 'admin']
    ]) accounts[label] = await registerAccount(label, role, roles[role]);
});

afterEach(async () => cleanupAfterEach());

afterAll(async () => {
    const errors = [];
    try { await cleanupAfterEach(); } catch (error) { errors.push(error.message); }
    if (fixtureIds.size) {
        try {
            const result = await adapterCall('cleanupWeek7Fixtures', { fixtureIds: [...fixtureIds] });
            if (result?.cleaned !== true) throw new Error('cleanupWeek7Fixtures() must return { cleaned: true }.');
            fixtureIds.clear();
        } catch (error) { errors.push(`Week 7 fixtures: ${error.message}`); }
    }
    for (const phone of [...phones]) {
        try {
            await adapterCall('deleteUser', { phone });
            phones.delete(phone);
        } catch (error) { errors.push(`user ${phone}: ${error.message}`); }
    }
    try { await adapterCall('resetTestHooks'); } catch (error) { errors.push(`test hooks: ${error.message}`); }
    if (errors.length) throw new Error(errors.join('; '));
});

describe('Week 9 image attachments, lesion photos, answer images, and UAS7', () => {
    for (const testCase of allCases) {
        test(`${testCase.id} [${testCase.expected}] ${testCase.title}`, async () => {
            const response = await runCase(testCase);
            if (testCase.prefix === 'ATV' && [1, 2].includes(testCase.number)) {
                expect(response.status).toBe(200);
                expect(response.headers['content-type']).toMatch(/^image\/(jpeg|png)$/);
                return;
            }
            if (testCase.prefix === 'PHX' && testCase.number === 3) {
                expect(response.status).toBe(200);
                return;
            }
            if (testCase.prefix === 'ATV' || testCase.prefix === 'PHX' && testCase.number === 3) {
                expect(response.status).toBe(Number(testCase.expected));
                return;
            }
            expectCode(response, testCase.expected);
        });
    }
});
