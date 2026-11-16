const crypto = require('node:crypto');
const request = require('supertest');
const { loadIntegrationConfig } = require('../support/config');

const config = loadIntegrationConfig();
const adapter = require(config.adapterPath);
const OK = '1000';

const catalog = {
    LEC: {
        codes: '1000,1000,1000,1000,1000,1000,1002,1002,1002,1003,1004,1004,1003,1004,1004,1004,1004,1004,1004,1004,1002,1004,1000,9992,1009,1010,1003,9998,9998,9998,9998,1009',
        title: 'creating lesion episodes'
    },
    LEM: {
        codes: '1000,1000,1000,1000,1000,1000,1003,1004,9998,9998,9998,9998,1009,1009,1009',
        title: 'listing the patient’s lesion episodes'
    },
    LER: {
        codes: '1000,1000,1000,1003,1004,9992,9992,9998,9998,9998,9998,1009',
        title: 'listing episodes by medical record'
    },
    LED: {
        codes: '1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        title: 'reading episode details'
    },
    LEU: {
        codes: '1000,1000,1000,1000,1000,1000,1002,1003,1004,1002,1003,1004,1004,1004,1004,1004,1004,1004,1002,1000,1003,1004,9992,9992,1009,1010,1003,9998,9998,9998,9998,1009',
        title: 'editing lesion episodes'
    },
    LEX: {
        codes: '1000,1000,9992,9992,9992,1003,1004,9992,1009,1010,9998,9998,9998,9998,1009',
        title: 'deleting lesion episodes'
    },
    LOC: {
        codes: '1000,1000,1000,1000,1000,1002,1002,1002,1003,1004,1004,1003,1004,1004,1004,1004,1004,1004,1004,1002,9992,1009,1010,1003,9998,9998,9998,9998,1009',
        title: 'creating lesion locations'
    },
    LOL: {
        codes: '1000,1000,1000,1000,1000,1009,1003,1004,9992,9992,9998,9998,9998,9998',
        title: 'listing locations for an episode'
    },
    LOU: {
        codes: '1000,1000,1000,1000,1000,1002,1003,1004,1002,1003,1004,1004,1004,1004,1004,1004,1004,1002,1000,1003,1004,9992,9992,1009,1010,1003,9998,9998,9998,9998,1009',
        title: 'editing lesion locations'
    },
    LOX: {
        codes: '1000,1000,1000,9992,9992,1003,1004,9992,1009,1010,9998,9998,9998,9998,1009',
        title: 'deleting lesion locations'
    }
};

const allCases = Object.entries(catalog).flatMap(([prefix, group]) =>
    group.codes.split(',').map((expected, index) => ({
        id: `W8-${prefix}-${String(index + 1).padStart(2, '0')}`,
        prefix,
        number: index + 1,
        expected,
        title: group.title
    }))
);

if (allCases.length !== 206 || new Set(allCases.map(item => item.id)).size !== 206) {
    throw new Error(`Week 8 workbook coverage must contain exactly 206 uniquely identified cases; found ${allCases.length}.`);
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

function uniqueName(prefix = 'week8') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function randomPhone() {
    return `09${crypto.randomInt(10000000, 100000000)}`;
}

function randomPassword() {
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
    if (Array.isArray(data?.episodes)) return data.episodes;
    if (Array.isArray(data?.locations)) return data.locations;
    return [];
}

function idOf(item, names) {
    for (const name of names) {
        if (item?.[name] !== undefined && item?.[name] !== null) return item[name];
    }
    return undefined;
}

function expectStringId(value) {
    expect(typeof value).toBe('string');
    expect(value).toMatch(/^[1-9]\d*$/);
}

async function api(method, endpoint, body, {
    token,
    authorization,
    query,
    rawBody
} = {}) {
    let call = request(config.baseUrl)[method.toLowerCase()](endpoint);
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    if (authorization !== undefined) call = call.set('Authorization', authorization);
    if (query) call = call.query(query);
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
        throw new Error(`Week 8 login for ${account.role} did not return data.token.`);
    }
    account.token = token;
    return account;
}

async function registerAccount(label, role, roleId) {
    const account = {
        role,
        fullName: `Mayday Week 8 ${label}`,
        phone: randomPhone(),
        password: randomPassword()
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
        throw new Error(`Week 8 ${label} signup did not return a positive data.user_id.`);
    }
    const promoted = await adapterCall('promoteUser', { phone: account.phone, roleId });
    if (Number(promoted?.roleId) !== roleId) {
        throw new Error(`Adapter failed to promote the Week 8 ${label} account.`);
    }
    account.roleId = roleId;
    await login(account);
    return account;
}

function episodeEndpoint(id) {
    return `/api/lesion-episodes/${encodeURIComponent(String(id))}`;
}

function locationsEndpoint(episodeId) {
    return `/api/lesion-locations/episode/${encodeURIComponent(String(episodeId))}`;
}

function locationEndpoint(id) {
    return `/api/lesion-locations/${encodeURIComponent(String(id))}`;
}

function episodesByRecordEndpoint(recordId) {
    return `/api/lesion-episodes/record/${encodeURIComponent(String(recordId))}`;
}

function photoListEndpoint(locationId) {
    return `/api/lesion-photos/location/${encodeURIComponent(String(locationId))}`;
}

function attachmentViewEndpoint(attachmentId) {
    return `/api/image-attachments/view/${encodeURIComponent(String(attachmentId))}`;
}

function episodeIdFrom(response) {
    const id = idOf(dataOf(response), ['episode_id', 'id']);
    expectStringId(id);
    return id;
}

function locationIdFrom(response) {
    const id = idOf(dataOf(response), ['lesion_location_id', 'location_id', 'id']);
    expectStringId(id);
    return id;
}

async function createRecord(owner = accounts.patientA, creator = owner) {
    const body = { template_id: fixture.template.id };
    if (creator.role !== 'patient') body.patient_id = owner.userId;
    const response = await api('post', '/api/medical_records', body, { token: creator.token });
    expectCode(response, OK);
    const id = dataOf(response)?.medical_record_id;
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        throw new Error('Week 8 record creation did not return a positive data.medical_record_id.');
    }
    const recordId = String(id);
    medicalRecordIds.add(recordId);
    return recordId;
}

async function deleteRecord(recordId) {
    const response = await api('delete', `/api/medical_records/${encodeURIComponent(recordId)}`, undefined, {
        token: accounts.admin.token
    });
    expectCode(response, OK);
    medicalRecordIds.delete(String(recordId));
    return response;
}

async function deletedRecordId(owner = accounts.patientA) {
    const recordId = await createRecord(owner);
    await deleteRecord(recordId);
    return recordId;
}

async function closedRecord(status, owner = accounts.patientA) {
    let recordId;
    if (status === 'completed') {
        recordId = await createRecord(owner, accounts.doctor);
        const closed = await api('put', `/api/medical_records/${recordId}`, {
            status: 'completed'
        }, { token: accounts.doctor.token });
        expectCode(closed, OK);
    } else {
        recordId = await createRecord(owner);
        const closed = await api('patch', `/api/medical_records/${recordId}/status`, {
            status: 'cancelled'
        }, { token: owner.token });
        expectCode(closed, OK);
    }
    return recordId;
}

async function createEpisode(recordId, actor = accounts.patientA, fields = {}) {
    const response = await api('post', '/api/lesion-episodes', {
        medical_record_id: recordId,
        name: uniqueName('episode'),
        ...fields
    }, { token: actor.token });
    expectCode(response, OK);
    return { id: episodeIdFrom(response), response };
}

async function createLocation(episodeId, actor = accounts.patientA, fields = {}) {
    const response = await api('post', '/api/lesion-locations', {
        episode_id: episodeId,
        body_part: uniqueName('bodypart'),
        ...fields
    }, { token: actor.token });
    expectCode(response, OK);
    return { id: locationIdFrom(response), response };
}

async function episodeFixture({ owner = accounts.patientA, actor = owner, name } = {}) {
    const recordId = await createRecord(owner);
    const episode = await createEpisode(recordId, actor, name === undefined ? {} : { name });
    return { recordId, episodeId: episode.id, owner, actor };
}

async function locationFixture({ owner = accounts.patientA, actor = owner, name } = {}) {
    const base = await episodeFixture({ owner, actor, name });
    const location = await createLocation(base.episodeId, actor);
    return { ...base, locationId: location.id };
}

async function deletedEpisodeFixture({ owner = accounts.patientA, actor = owner } = {}) {
    const base = await episodeFixture({ owner, actor });
    const deleted = await api('delete', episodeEndpoint(base.episodeId), undefined, { token: actor.token });
    expectCode(deleted, OK);
    return base;
}

async function deletedLocationFixture({ owner = accounts.patientA, actor = owner } = {}) {
    const base = await locationFixture({ owner, actor });
    const deleted = await api('delete', locationEndpoint(base.locationId), undefined, { token: actor.token });
    expectCode(deleted, OK);
    return base;
}

async function addPhotoFixture({ recordId, episodeId, locationId, owner = accounts.patientA }) {
    const result = await adapterCall('prepareWeek8LesionPhoto', {
        uniquePrefix: uniqueName('W8Photo'),
        patientId: owner.userId,
        medicalRecordId: recordId,
        episodeId,
        locationId
    });
    if (typeof result?.fixtureId !== 'string' || !result.fixtureId ||
        result?.attachmentId === undefined || result?.attachmentId === null ||
        typeof result?.fileUrl !== 'string' || !result.fileUrl) {
        throw new Error('prepareWeek8LesionPhoto() must return { fixtureId, attachmentId, fileUrl }.');
    }
    caseFixtureIds.add(result.fixtureId);
    return result;
}

function requiredEpisodeFields(item, episodeId, recordId, patientId) {
    expect(item).toEqual(expect.objectContaining({
        episode_id: episodeId,
        medical_record_id: recordId,
        patient_id: String(patientId),
        name: expect.any(String),
        created_at: expect.anything(),
        updated_at: expect.anything()
    }));
}

function requiredLocationFields(item, locationId, episodeId) {
    expect(item).toEqual(expect.objectContaining({
        lesion_location_id: locationId,
        episode_id: episodeId,
        body_part: expect.any(String),
        created_at: expect.anything(),
        updated_at: expect.anything()
    }));
}

async function getEpisode(id, token = accounts.patientA.token) {
    return api('get', episodeEndpoint(id), undefined, { token });
}

async function getMyEpisodes(token = accounts.patientA.token, medicalRecordId) {
    const query = medicalRecordId === undefined ? undefined : { medical_record_id: medicalRecordId };
    return api('get', '/api/lesion-episodes/my', undefined, { token, query });
}

async function authCase(kind, method, endpoint, body, account, query) {
    if (kind === 'missing') return api(method, endpoint, body, { query });
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
            last = await api(method, endpoint, body, { authorization, query });
            expectCode(last, '9998');
        }
        return last;
    }
    if (kind === 'expired') {
        const result = await adapterCall('getExpiredToken', { phone: account.phone });
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) throw new Error(`getExpiredToken() returned no expired token for ${account.phone}.`);
        return api(method, endpoint, body, { token, query });
    }
    if (kind === 'logout') {
        await login(account);
        expectCode(await api('post', '/api/auth/logout', {}, { token: account.token }), OK);
        const response = await api(method, endpoint, body, { token: account.token, query });
        await login(account);
        return response;
    }
    throw new Error(`Unknown Week 8 auth case "${kind}".`);
}

function futureDateTime() {
    const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const completeEpisodeFields = {
    occurred_at: '2026-04-20 10:30:00',
    context_tags: '["after_meal","exercise"]',
    context_other: 'Week 8 context',
    medication_name: 'Cetirizine',
    medication_taken_ago: '2',
    medication_unit: 'hour',
    description: 'Episode description'
};

const completeLocationFields = {
    occurred_at: '2026-04-20 10:30:00',
    context_tags: '["itchy","redness"]',
    context_other: 'Location context',
    medication_name: 'Cetirizine',
    medication_taken_ago: '2',
    medication_unit: 'hour'
};

async function runEpisodeCreate(number) {
    if (number >= 1 && number <= 6) {
        const recordId = await createRecord();
        if (number === 1) {
            const response = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Dạng 1 - Đùi trái'
            }, { token: accounts.patientA.token });
            expectCode(response, OK);
            const episodeId = episodeIdFrom(response);
            requiredEpisodeFields(dataOf(response), episodeId, recordId, accounts.patientA.userId);
            expect(dataOf(response).name).toBe('Dạng 1 - Đùi trái');
            return response;
        }
        if (number === 2) {
            const response = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Full episode',
                ...completeEpisodeFields
            }, { token: accounts.patientA.token });
            expectCode(response, OK);
            const episodeId = episodeIdFrom(response);
            requiredEpisodeFields(dataOf(response), episodeId, recordId, accounts.patientA.userId);
            for (const [field, value] of Object.entries(completeEpisodeFields)) {
                expect(dataOf(response)[field]).toBe(value);
            }
            return response;
        }
        if (number === 3) {
            const response = await api('post', '/api/lesion-episodes', {
                medical_record_id: String(recordId),
                name: 'String record id'
            }, { token: accounts.patientA.token });
            expectCode(response, OK);
            expectStringId(dataOf(response).medical_record_id);
            expect(String(dataOf(response).medical_record_id)).toBe(recordId);
            return response;
        }
        if (number === 4) {
            let last;
            for (const actor of [accounts.doctor, accounts.nurse]) {
                last = await api('post', '/api/lesion-episodes', {
                    medical_record_id: recordId,
                    name: `${actor.role} authored episode`
                }, { token: actor.token });
                expectCode(last, OK);
                expectStringId(dataOf(last).episode_id);
                expect(String(dataOf(last).patient_id)).toBe(String(accounts.patientA.userId));
            }
            return last;
        }
        if (number === 5) {
            const first = await createEpisode(recordId, accounts.patientA, { name: 'Repeated name' });
            const second = await createEpisode(recordId, accounts.patientA, { name: 'Repeated name' });
            expect(first.id).not.toBe(second.id);
            const list = await getMyEpisodes();
            expectCode(list, OK);
            const matching = itemsOf(list).filter(item =>
                item.name === 'Repeated name' && String(item.medical_record_id) === recordId);
            expect(matching.map(item => String(item.episode_id))).toEqual(expect.arrayContaining([first.id, second.id]));
            expect(matching).toHaveLength(2);
            return second.response;
        }
        const episode = await createEpisode(recordId);
        const list = await getMyEpisodes();
        expectCode(list, OK);
        expect(itemsOf(list).some(item => String(item.episode_id) === episode.id)).toBe(true);
        const detail = await getEpisode(episode.id);
        expectCode(detail, OK);
        requiredEpisodeFields(dataOf(detail), episode.id, recordId, accounts.patientA.userId);
        return detail;
    }

    if (number === 7) {
        return api('post', '/api/lesion-episodes', { name: 'Missing record id' }, { token: accounts.patientA.token });
    }
    if (number === 8) return api('post', '/api/lesion-episodes', {}, { token: accounts.patientA.token });
    if (number === 9) {
        const recordId = await createRecord();
        let last;
        for (const body of [
            { medical_record_id: recordId },
            { medical_record_id: recordId, name: '' },
            { medical_record_id: recordId, name: null },
            { medical_record_id: recordId, name: '   ' }
        ]) {
            last = await api('post', '/api/lesion-episodes', body, { token: accounts.patientA.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 10) {
        const recordId = await createRecord();
        let last;
        for (const body of [
            { medical_record_id: true, name: 'Type test' },
            { medical_record_id: [], name: 'Type test' },
            { medical_record_id: 1.5, name: 'Type test' },
            { medical_record_id: 'abc', name: 'Type test' },
            { medical_record_id: recordId, name: 123 }
        ]) {
            last = await api('post', '/api/lesion-episodes', body, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 11) {
        let last;
        for (const medical_record_id of [0, -1]) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id,
                name: 'Invalid record id'
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        const recordId = await createRecord();
        let last;
        for (const name of ['x'.repeat(101), '<b>unsafe</b>']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        const recordId = await createRecord();
        let last;
        for (const body of [
            { occurred_at: 123 },
            { context_tags: ['a'] },
            { context_other: 123 },
            { medication_name: 123 },
            { medication_taken_ago: 2, medication_unit: 'hour' },
            { medication_taken_ago: '2', medication_unit: 1 }
        ]) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Optional type',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 14) {
        const recordId = await createRecord();
        let last;
        for (const occurred_at of ['24/04/2026', '2026-13-40 10:00:00', 'abc']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Invalid date',
                occurred_at
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 15) {
        const recordId = await createRecord();
        return api('post', '/api/lesion-episodes', {
            medical_record_id: recordId,
            name: 'Future date',
            occurred_at: futureDateTime()
        }, { token: accounts.patientA.token });
    }
    if (number === 16) {
        const recordId = await createRecord();
        let last;
        for (const context_tags of ['abc', '{}', '[1]', '["a",null]']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Invalid tags',
                context_tags
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 17) {
        const recordId = await createRecord();
        let last;
        for (const context_tags of [
            JSON.stringify(Array.from({ length: 21 }, (_, index) => `tag${index}`)),
            JSON.stringify(['x'.repeat(51)])
        ]) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Oversized tags',
                context_tags
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 18) {
        const recordId = await createRecord();
        let last;
        for (const body of [
            { context_other: 'x'.repeat(256) },
            { medication_name: 'x'.repeat(101) },
            { context_other: '<b>unsafe</b>' },
            { medication_name: '<b>unsafe</b>' }
        ]) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Length validation',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 19) {
        const recordId = await createRecord();
        let last;
        for (const medication_taken_ago of ['abc', '-1', '1.5', '10000']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Invalid elapsed time',
                medication_taken_ago,
                medication_unit: 'hour'
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 20) {
        const recordId = await createRecord();
        let last;
        for (const medication_unit of ['year', 'HOUR']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Invalid medication unit',
                medication_taken_ago: '1',
                medication_unit
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 21) {
        const recordId = await createRecord();
        let last;
        for (const body of [
            { medication_taken_ago: '1' },
            { medication_unit: 'hour' }
        ]) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Incomplete medication timing',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 22) {
        const recordId = await createRecord();
        let last;
        for (const description of ['x'.repeat(1001), '<script>unsafe</script>']) {
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: 'Description validation',
                description
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 23) {
        const recordId = await createRecord();
        const description = "x'; DROP TABLE users;--";
        const created = await createEpisode(recordId, accounts.patientA, {
            name: 'SQL text is data',
            description
        });
        const detail = await getEpisode(created.id);
        expectCode(detail, OK);
        expect(dataOf(detail).description).toBe(description);
        return detail;
    }
    if (number === 24) {
        const recordId = await deletedRecordId();
        return api('post', '/api/lesion-episodes', {
            medical_record_id: recordId,
            name: 'Deleted record'
        }, { token: accounts.patientA.token });
    }
    if (number === 25) {
        const recordId = await createRecord();
        const response = await api('post', '/api/lesion-episodes', {
            medical_record_id: recordId,
            name: 'Foreign patient'
        }, { token: accounts.patientB.token });
        return response;
    }
    if (number === 26) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            last = await api('post', '/api/lesion-episodes', {
                medical_record_id: recordId,
                name: `Closed ${status}`
            }, { token: accounts.patientA.token });
            expectCode(last, '1010');
        }
        return last;
    }
    if (number === 27) {
        const recordId = await createRecord();
        return api('post', '/api/lesion-episodes', undefined, {
            token: accounts.patientA.token,
            rawBody: '{"medical_record_id":'
        });
    }
    if (number >= 28 && number <= 31) {
        const recordId = await createRecord();
        const body = { medical_record_id: recordId, name: 'Authorization case' };
        const kind = { 28: 'missing', 29: 'invalid', 30: 'expired', 31: 'logout' }[number];
        return authCase(kind, 'post', '/api/lesion-episodes', body, accounts.patientA);
    }
    if (number === 32) {
        const recordId = await createRecord();
        return api('post', '/api/lesion-episodes', {
            medical_record_id: recordId,
            name: 'Admin forbidden'
        }, { token: accounts.admin.token });
    }
    throw new Error(`Unhandled Week 8 LEC case ${number}.`);
}

async function runMyEpisodes(number) {
    if (number === 1) {
        const { recordId, episodeId } = await episodeFixture();
        const response = await getMyEpisodes();
        expectCode(response, OK);
        const row = itemsOf(response).find(item => String(item.episode_id) === episodeId);
        requiredEpisodeFields(row, episodeId, recordId, accounts.patientA.userId);
        return response;
    }
    if (number === 2) {
        const a = await episodeFixture();
        const b = await episodeFixture({ owner: accounts.patientB });
        const response = await getMyEpisodes();
        expectCode(response, OK);
        const rows = itemsOf(response);
        expect(rows.some(item => String(item.episode_id) === a.episodeId)).toBe(true);
        expect(rows.some(item => String(item.episode_id) === b.episodeId)).toBe(false);
        expect(rows.every(item => String(item.patient_id) === String(accounts.patientA.userId))).toBe(true);
        return response;
    }
    if (number === 3) {
        const selected = await episodeFixture();
        const other = await episodeFixture();
        const response = await getMyEpisodes(accounts.patientA.token, selected.recordId);
        expectCode(response, OK);
        expect(itemsOf(response).length).toBeGreaterThan(0);
        expect(itemsOf(response).every(item => String(item.medical_record_id) === selected.recordId)).toBe(true);
        expect(itemsOf(response).some(item => String(item.episode_id) === other.episodeId)).toBe(false);
        return response;
    }
    if (number === 4) {
        const created = [];
        for (let index = 0; index < 3; index++) {
            created.push(await episodeFixture());
        }
        const response = await getMyEpisodes();
        expectCode(response, OK);
        const times = itemsOf(response)
            .filter(item => created.some(entry => entry.episodeId === String(item.episode_id)))
            .map(item => Date.parse(item.created_at));
        expect(times).toHaveLength(3);
        for (let index = 1; index < times.length; index++) {
            expect(times[index - 1]).toBeGreaterThanOrEqual(times[index]);
        }
        return response;
    }
    if (number === 5) {
        const response = await getMyEpisodes();
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 6) {
        const foreign = await episodeFixture({ owner: accounts.patientB });
        const deleted = await deletedRecordId();
        let response = await getMyEpisodes(accounts.patientA.token, foreign.recordId);
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        response = await getMyEpisodes(accounts.patientA.token, deleted);
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 7) {
        let last;
        for (const value of ['abc', '1.5', 'true', '[]']) {
            last = await getMyEpisodes(accounts.patientA.token, value);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 8) {
        let last;
        for (const value of ['0', '-1', '99999999999999999999']) {
            last = await getMyEpisodes(accounts.patientA.token, value);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number >= 9 && number <= 12) {
        const kind = { 9: 'missing', 10: 'invalid', 11: 'expired', 12: 'logout' }[number];
        return authCase(kind, 'get', '/api/lesion-episodes/my', undefined, accounts.patientA);
    }
    if (number >= 13 && number <= 15) {
        const account = { 13: accounts.doctor, 14: accounts.nurse, 15: accounts.admin }[number];
        return api('get', '/api/lesion-episodes/my', undefined, { token: account.token });
    }
    throw new Error(`Unhandled Week 8 LEM case ${number}.`);
}

async function runEpisodesByRecord(number) {
    if (number === 1) {
        const fixtureA = await episodeFixture();
        const fixtureB = await episodeFixture();
        const empty = await createRecord();
        let last;
        for (const staff of [accounts.doctor, accounts.nurse, accounts.admin]) {
            last = await api('get', episodesByRecordEndpoint(fixtureA.recordId), undefined, { token: staff.token });
            expectCode(last, OK);
            const rows = itemsOf(last);
            expect(rows.some(item => String(item.episode_id) === fixtureA.episodeId)).toBe(true);
            expect(rows.every(item => String(item.medical_record_id) === fixtureA.recordId)).toBe(true);
            expect(rows.some(item => String(item.episode_id) === fixtureB.episodeId)).toBe(false);
        }
        const emptyList = await api('get', episodesByRecordEndpoint(empty), undefined, {
            token: accounts.doctor.token
        });
        expectCode(emptyList, OK);
        expect(dataOf(emptyList)).toEqual([]);
        return last;
    }
    if (number === 2) {
        const recordId = await createRecord();
        const response = await api('get', episodesByRecordEndpoint(recordId), undefined, {
            token: accounts.doctor.token
        });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 3) {
        const a = await episodeFixture();
        const a2 = await createEpisode(a.recordId);
        const b = await episodeFixture();
        const response = await api('get', episodesByRecordEndpoint(a.recordId), undefined, {
            token: accounts.doctor.token
        });
        expectCode(response, OK);
        const rows = itemsOf(response);
        expect(rows).toHaveLength(2);
        expect(rows.map(item => String(item.episode_id))).toEqual(expect.arrayContaining([a.episodeId, a2.id]));
        expect(rows.some(item => String(item.episode_id) === b.episodeId)).toBe(false);
        return response;
    }
    if (number === 4 || number === 5) {
        let last;
        const ids = number === 4 ? ['abc', '1.5', 'true', '[]'] : ['0', '-1', '99999999999999999999'];
        for (const id of ids) {
            last = await api('get', episodesByRecordEndpoint(id), undefined, { token: accounts.doctor.token });
            expectCode(last, number === 4 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 6 || number === 7) {
        const recordId = await deletedRecordId();
        return api('get', episodesByRecordEndpoint(recordId), undefined, { token: accounts.doctor.token });
    }
    if (number >= 8 && number <= 11) {
        const recordId = await createRecord();
        const kind = { 8: 'missing', 9: 'invalid', 10: 'expired', 11: 'logout' }[number];
        return authCase(kind, 'get', episodesByRecordEndpoint(recordId), undefined, accounts.doctor);
    }
    if (number === 12) {
        const { recordId } = await episodeFixture();
        return api('get', episodesByRecordEndpoint(recordId), undefined, { token: accounts.patientA.token });
    }
    throw new Error(`Unhandled Week 8 LER case ${number}.`);
}

async function runEpisodeDetail(number) {
    if (number === 1) {
        const { recordId, episodeId } = await episodeFixture();
        const response = await getEpisode(episodeId);
        expectCode(response, OK);
        requiredEpisodeFields(dataOf(response), episodeId, recordId, accounts.patientA.userId);
        for (const field of [
            'occurred_at', 'context_tags', 'context_other', 'medication_name',
            'medication_taken_ago', 'medication_unit', 'description'
        ]) expect(dataOf(response)).toHaveProperty(field);
        return response;
    }
    if (number === 2) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const staff of [accounts.doctor, accounts.nurse, accounts.admin]) {
            last = await getEpisode(episodeId, staff.token);
            expectCode(last, OK);
            expect(String(dataOf(last).episode_id)).toBe(episodeId);
        }
        return last;
    }
    if (number === 3) {
        const { episodeId } = await episodeFixture();
        return getEpisode(episodeId, accounts.patientB.token);
    }
    if (number === 4 || number === 5) {
        let last;
        const ids = number === 4 ? ['abc', '1.5', 'true', '[]'] : ['0', '-1', '99999999999999999999'];
        for (const id of ids) {
            last = await getEpisode(id);
            expectCode(last, number === 4 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 6 || number === 7) {
        const { episodeId } = await deletedEpisodeFixture();
        return getEpisode(episodeId);
    }
    if (number >= 8 && number <= 11) {
        const { episodeId } = await episodeFixture();
        const kind = { 8: 'missing', 9: 'invalid', 10: 'expired', 11: 'logout' }[number];
        return authCase(kind, 'get', episodeEndpoint(episodeId), undefined, accounts.patientA);
    }
    throw new Error(`Unhandled Week 8 LED case ${number}.`);
}

async function patchEpisode(episodeId, body, token = accounts.patientA.token) {
    return api('patch', episodeEndpoint(episodeId), body, { token });
}

async function runEpisodeEdit(number) {
    if (number === 1) {
        const { episodeId } = await episodeFixture();
        const response = await patchEpisode(episodeId, { name: 'Renamed episode' });
        expectCode(response, OK);
        const detail = await getEpisode(episodeId);
        expectCode(detail, OK);
        expect(dataOf(detail).name).toBe('Renamed episode');
        return response;
    }
    if (number === 2) {
        const { episodeId } = await episodeFixture();
        let last;
        const individualFields = Object.entries(completeEpisodeFields)
            .filter(([field]) => !['medication_taken_ago', 'medication_unit'].includes(field));
        for (const [field, value] of individualFields) {
            last = await patchEpisode(episodeId, { [field]: value });
            expectCode(last, OK);
            const detail = await getEpisode(episodeId);
            expectCode(detail, OK);
            expect(dataOf(detail)[field]).toBe(value);
        }
        last = await patchEpisode(episodeId, {
            medication_taken_ago: completeEpisodeFields.medication_taken_ago,
            medication_unit: completeEpisodeFields.medication_unit
        });
        expectCode(last, OK);
        const detail = await getEpisode(episodeId);
        expectCode(detail, OK);
        expect(detail.data.medication_taken_ago).toBe(completeEpisodeFields.medication_taken_ago);
        expect(detail.data.medication_unit).toBe(completeEpisodeFields.medication_unit);
        return last;
    }
    if (number === 3) {
        const { episodeId } = await episodeFixture();
        const body = { name: 'All fields changed', ...completeEpisodeFields };
        const response = await patchEpisode(episodeId, body);
        expectCode(response, OK);
        const detail = await getEpisode(episodeId);
        expectCode(detail, OK);
        for (const [field, value] of Object.entries(body)) expect(dataOf(detail)[field]).toBe(value);
        return response;
    }
    if (number === 4) {
        const { episodeId } = await episodeFixture();
        expectCode(await patchEpisode(episodeId, { description: 'remove me' }), OK);
        const response = await patchEpisode(episodeId, { description: null });
        expectCode(response, OK);
        const detail = await getEpisode(episodeId);
        expectCode(detail, OK);
        expect(dataOf(detail).description).toBeNull();
        return response;
    }
    if (number === 5) {
        const { episodeId } = await episodeFixture();
        const before = dataOf(await getEpisode(episodeId));
        await new Promise(resolve => setTimeout(resolve, 1100));
        const response = await patchEpisode(episodeId, { name: 'Timestamp updated' });
        expectCode(response, OK);
        const after = dataOf(await getEpisode(episodeId));
        expect(after.created_at).toBe(before.created_at);
        expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
        return response;
    }
    if (number === 6) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const staff of [accounts.doctor, accounts.nurse]) {
            last = await patchEpisode(episodeId, { name: `${staff.role} update` }, staff.token);
            expectCode(last, OK);
            expect(dataOf(await getEpisode(episodeId)).name).toBe(`${staff.role} update`);
        }
        return last;
    }
    if (number === 7) {
        const { episodeId } = await episodeFixture();
        return patchEpisode(episodeId, {});
    }
    if (number === 8) return patchEpisode((await episodeFixture()).episodeId, { name: 123 });
    if (number === 9) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const name of ['x'.repeat(101), '<b>unsafe</b>']) {
            last = await patchEpisode(episodeId, { name });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 10) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const name of ['', null, '   ']) {
            last = await patchEpisode(episodeId, { name });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 11) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [
            { occurred_at: 123 },
            { context_tags: ['a'] },
            { context_other: 123 },
            { medication_name: 123 },
            { medication_taken_ago: 2, medication_unit: 'hour' },
            { medication_taken_ago: '2', medication_unit: 1 }
        ]) {
            last = await patchEpisode(episodeId, body);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 12 || number === 13) {
        const { episodeId } = await episodeFixture();
        let last;
        const values = number === 12
            ? ['24/04/2026', '2026-13-40 10:00:00', 'abc']
            : [futureDateTime()];
        for (const occurred_at of values) {
            last = await patchEpisode(episodeId, { occurred_at });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const context_tags of ['abc', '{}', '[1]', '["a",null]']) {
            last = await patchEpisode(episodeId, { context_tags });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 15) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const context_tags of [
            JSON.stringify(Array.from({ length: 21 }, (_, index) => `tag${index}`)),
            JSON.stringify(['x'.repeat(51)])
        ]) {
            last = await patchEpisode(episodeId, { context_tags });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 16) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [
            { context_other: 'x'.repeat(256) },
            { medication_name: 'x'.repeat(101) },
            { context_other: '<b>unsafe</b>' },
            { medication_name: '<b>unsafe</b>' }
        ]) {
            last = await patchEpisode(episodeId, body);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 17) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const medication_taken_ago of ['abc', '-1', '1.5', '10000']) {
            last = await patchEpisode(episodeId, { medication_taken_ago, medication_unit: 'hour' });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 18) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const medication_unit of ['year', 'HOUR']) {
            last = await patchEpisode(episodeId, { medication_taken_ago: '1', medication_unit });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 19) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [{ medication_taken_ago: '1' }, { medication_unit: 'hour' }]) {
            last = await patchEpisode(episodeId, body);
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 20) {
        const base = await episodeFixture();
        const originalRecordId = base.recordId;
        const response = await patchEpisode(base.episodeId, {
            name: 'Only permitted field changes',
            episode_id: '999999',
            medical_record_id: '999999',
            patient_id: '999999'
        });
        expectCode(response, OK);
        const detail = await getEpisode(base.episodeId);
        expectCode(detail, OK);
        expect(dataOf(detail).name).toBe('Only permitted field changes');
        expect(String(dataOf(detail).episode_id)).toBe(base.episodeId);
        expect(String(dataOf(detail).medical_record_id)).toBe(originalRecordId);
        expect(String(dataOf(detail).patient_id)).toBe(String(accounts.patientA.userId));
        return response;
    }
    if (number === 21 || number === 22) {
        let last;
        const ids = number === 21 ? ['abc', '1.5', 'true', '[]'] : ['0', '-1', '99999999999999999999'];
        for (const id of ids) {
            last = await patchEpisode(id, { name: 'Invalid id' });
            expectCode(last, number === 21 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 23 || number === 24) {
        const { episodeId } = await deletedEpisodeFixture();
        return patchEpisode(episodeId, { name: 'Already deleted' });
    }
    if (number === 25) {
        const { episodeId } = await episodeFixture();
        return patchEpisode(episodeId, { name: 'Foreign edit' }, accounts.patientB.token);
    }
    if (number === 26) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            const { id } = await createEpisode(recordId);
            last = await patchEpisode(id, { name: 'Closed edit' });
            expectCode(last, '1010');
        }
        return last;
    }
    if (number === 27) {
        const { episodeId } = await episodeFixture();
        return api('patch', episodeEndpoint(episodeId), undefined, {
            token: accounts.patientA.token,
            rawBody: '{"name":'
        });
    }
    if (number >= 28 && number <= 31) {
        const { episodeId } = await episodeFixture();
        const kind = { 28: 'missing', 29: 'invalid', 30: 'expired', 31: 'logout' }[number];
        return authCase(kind, 'patch', episodeEndpoint(episodeId), { name: 'Authorization case' }, accounts.patientA);
    }
    if (number === 32) {
        const { episodeId } = await episodeFixture();
        return patchEpisode(episodeId, { name: 'Admin forbidden' }, accounts.admin.token);
    }
    throw new Error(`Unhandled Week 8 LEU case ${number}.`);
}

async function deleteEpisode(episodeId, token = accounts.patientA.token) {
    return api('delete', episodeEndpoint(episodeId), undefined, { token });
}

async function runEpisodeDelete(number) {
    if (number === 1 || number === 2) {
        if (number === 1) {
            const { episodeId } = await episodeFixture();
            const response = await deleteEpisode(episodeId, accounts.patientA.token);
            expectCode(response, OK);
            expect(dataOf(response)).toEqual({});
            return response;
        }
        let last;
        for (const actor of [accounts.doctor, accounts.nurse]) {
            const { episodeId } = await episodeFixture({ actor });
            last = await deleteEpisode(episodeId, actor.token);
            expectCode(last, OK);
            expect(dataOf(last)).toEqual({});
        }
        return last;
    }
    if (number === 3) {
        const { episodeId } = await episodeFixture();
        expectCode(await deleteEpisode(episodeId), OK);
        const detail = await getEpisode(episodeId);
        expectCode(detail, '9992');
        const list = await getMyEpisodes();
        expectCode(list, OK);
        expect(itemsOf(list).some(item => String(item.episode_id) === episodeId)).toBe(false);
        return detail;
    }
    if (number === 4) {
        const base = await locationFixture();
        const photo = await addPhotoFixture({
            recordId: base.recordId,
            episodeId: base.episodeId,
            locationId: base.locationId
        });
        const initial = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(initial, OK);
        const location = itemsOf(initial).find(item =>
            String(item.lesion_location_id) === base.locationId);
        expect(location?.photos).toEqual(expect.arrayContaining([
            expect.objectContaining({
                attachment: expect.objectContaining({
                    attachment_id: String(photo.attachmentId),
                    file_url: photo.fileUrl
                })
            })
        ]));
        expectCode(await deleteEpisode(base.episodeId), OK);
        expectCode(await api('get', photoListEndpoint(base.locationId), undefined, {
            token: accounts.patientA.token
        }), '9992');
        const attachment = await api('get', attachmentViewEndpoint(photo.attachmentId), undefined, {
            token: accounts.patientA.token
        });
        expect(attachment.status).toBe(200);
        const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, '9992');
        return response;
    }
    if (number === 5) {
        const { episodeId } = await episodeFixture();
        expectCode(await deleteEpisode(episodeId), OK);
        return deleteEpisode(episodeId);
    }
    if (number === 6 || number === 7) {
        let last;
        const ids = number === 6 ? ['abc', '1.5', 'true', '[]'] : ['0', '-1', '99999999999999999999'];
        for (const id of ids) {
            last = await deleteEpisode(id);
            expectCode(last, number === 6 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 8) {
        const { episodeId } = await deletedEpisodeFixture();
        return deleteEpisode(episodeId);
    }
    if (number === 9) {
        const { episodeId } = await episodeFixture();
        return deleteEpisode(episodeId, accounts.patientB.token);
    }
    if (number === 10) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            const { id } = await createEpisode(recordId);
            last = await deleteEpisode(id);
            expectCode(last, '1010');
        }
        return last;
    }
    if (number >= 11 && number <= 14) {
        const { episodeId } = await episodeFixture();
        const kind = { 11: 'missing', 12: 'invalid', 13: 'expired', 14: 'logout' }[number];
        return authCase(kind, 'delete', episodeEndpoint(episodeId), undefined, accounts.patientA);
    }
    if (number === 15) {
        const { episodeId } = await episodeFixture();
        return deleteEpisode(episodeId, accounts.admin.token);
    }
    throw new Error(`Unhandled Week 8 LEX case ${number}.`);
}

async function runLocationCreate(number) {
    if (number >= 1 && number <= 5) {
        const base = await episodeFixture();
        if (number === 1) {
            const response = await api('post', '/api/lesion-locations', {
                episode_id: base.episodeId,
                body_part: 'Cánh tay phải'
            }, { token: accounts.patientA.token });
            expectCode(response, OK);
            const locationId = locationIdFrom(response);
            requiredLocationFields(dataOf(response), locationId, base.episodeId);
            expect(dataOf(response).body_part).toBe('Cánh tay phải');
            return response;
        }
        if (number === 2) {
            const response = await api('post', '/api/lesion-locations', {
                episode_id: base.episodeId,
                body_part: 'Full location',
                ...completeLocationFields
            }, { token: accounts.patientA.token });
            expectCode(response, OK);
            for (const [field, value] of Object.entries(completeLocationFields)) {
                expect(dataOf(response)[field]).toBe(value);
            }
            requiredLocationFields(dataOf(response), locationIdFrom(response), base.episodeId);
            return response;
        }
        if (number === 3) {
            const first = await createLocation(base.episodeId, accounts.patientA, { body_part: 'Left arm' });
            const second = await createLocation(base.episodeId, accounts.patientA, { body_part: 'Left arm' });
            expect(first.id).not.toBe(second.id);
            const list = await api('get', locationsEndpoint(base.episodeId), undefined, {
                token: accounts.patientA.token
            });
            expectCode(list, OK);
            const duplicateRows = itemsOf(list).filter(item => item.body_part === 'Left arm');
            expect(duplicateRows).toHaveLength(2);
            return second.response;
        }
        if (number === 4) {
            let last;
            for (const actor of [accounts.doctor, accounts.nurse]) {
                last = await createLocation(base.episodeId, actor, { body_part: `${actor.role} location` });
                expectCode(last.response, OK);
                expect(String(dataOf(last.response).episode_id)).toBe(base.episodeId);
            }
            return last.response;
        }
        const location = await createLocation(base.episodeId);
        const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        const row = itemsOf(response).find(item => String(item.lesion_location_id) === location.id);
        requiredLocationFields(row, location.id, base.episodeId);
        expect(row.photos).toEqual([]);
        return response;
    }
    if (number === 6) return api('post', '/api/lesion-locations', { body_part: 'No episode' }, { token: accounts.patientA.token });
    if (number === 7) return api('post', '/api/lesion-locations', {}, { token: accounts.patientA.token });
    if (number === 8) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body_part of [undefined, '', null, '   ']) {
            const body = { episode_id: episodeId };
            if (body_part !== undefined) body.body_part = body_part;
            last = await api('post', '/api/lesion-locations', body, { token: accounts.patientA.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 9) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [
            { episode_id: true, body_part: 'Type test' },
            { episode_id: 1.5, body_part: 'Type test' },
            { episode_id: 'abc', body_part: 'Type test' },
            { episode_id: episodeId, body_part: 123 }
        ]) {
            last = await api('post', '/api/lesion-locations', body, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 10) {
        let last;
        for (const episode_id of [0, -1]) {
            last = await api('post', '/api/lesion-locations', {
                episode_id,
                body_part: 'Invalid parent'
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 11) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body_part of ['x'.repeat(101), '<b>unsafe</b>']) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 12) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [
            { occurred_at: 123 },
            { context_tags: ['a'] },
            { context_other: 123 },
            { medication_name: 123 },
            { medication_taken_ago: 2, medication_unit: 'hour' },
            { medication_taken_ago: '2', medication_unit: 1 }
        ]) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Optional type',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 13) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const occurred_at of ['24/04/2026', '2026-13-40 10:00:00', 'abc']) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Invalid date',
                occurred_at
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14) {
        const { episodeId } = await episodeFixture();
        return api('post', '/api/lesion-locations', {
            episode_id: episodeId,
            body_part: 'Future date',
            occurred_at: futureDateTime()
        }, { token: accounts.patientA.token });
    }
    if (number === 15) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const context_tags of ['abc', '{}', '[1]', '["a",null]']) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Invalid tags',
                context_tags
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 16) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const context_tags of [
            JSON.stringify(Array.from({ length: 21 }, (_, index) => `tag${index}`)),
            JSON.stringify(['x'.repeat(51)])
        ]) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Oversized tags',
                context_tags
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 17) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [
            { context_other: 'x'.repeat(256) },
            { medication_name: 'x'.repeat(101) },
            { context_other: '<b>unsafe</b>' },
            { medication_name: '<b>unsafe</b>' }
        ]) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Length validation',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 18) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const medication_taken_ago of ['abc', '-1', '1.5', '10000']) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Invalid elapsed time',
                medication_taken_ago,
                medication_unit: 'hour'
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 19) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const medication_unit of ['year', 'HOUR']) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Invalid unit',
                medication_taken_ago: '1',
                medication_unit
            }, { token: accounts.patientA.token });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 20) {
        const { episodeId } = await episodeFixture();
        let last;
        for (const body of [{ medication_taken_ago: '1' }, { medication_unit: 'hour' }]) {
            last = await api('post', '/api/lesion-locations', {
                episode_id: episodeId,
                body_part: 'Incomplete timing',
                ...body
            }, { token: accounts.patientA.token });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 21) {
        const { episodeId } = await deletedEpisodeFixture();
        return api('post', '/api/lesion-locations', {
            episode_id: episodeId,
            body_part: 'Deleted episode'
        }, { token: accounts.patientA.token });
    }
    if (number === 22) {
        const { episodeId } = await episodeFixture();
        return api('post', '/api/lesion-locations', {
            episode_id: episodeId,
            body_part: 'Foreign patient'
        }, { token: accounts.patientB.token });
    }
    if (number === 23) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            const { id } = await createEpisode(recordId);
            last = await api('post', '/api/lesion-locations', {
                episode_id: id,
                body_part: 'Closed record'
            }, { token: accounts.patientA.token });
            expectCode(last, '1010');
        }
        return last;
    }
    if (number === 24) {
        const { episodeId } = await episodeFixture();
        return api('post', '/api/lesion-locations', undefined, {
            token: accounts.patientA.token,
            rawBody: '{"episode_id":'
        });
    }
    if (number >= 25 && number <= 28) {
        const { episodeId } = await episodeFixture();
        const body = { episode_id: episodeId, body_part: 'Authorization case' };
        const kind = { 25: 'missing', 26: 'invalid', 27: 'expired', 28: 'logout' }[number];
        return authCase(kind, 'post', '/api/lesion-locations', body, accounts.patientA);
    }
    if (number === 29) {
        const { episodeId } = await episodeFixture();
        return api('post', '/api/lesion-locations', {
            episode_id: episodeId,
            body_part: 'Admin forbidden'
        }, { token: accounts.admin.token });
    }
    throw new Error(`Unhandled Week 8 LOC case ${number}.`);
}

async function runLocationList(number) {
    if (number === 1 || number === 2) {
        const base = await locationFixture();
        if (number === 1) {
            const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
                token: accounts.patientA.token
            });
            expectCode(response, OK);
            const row = itemsOf(response).find(item => String(item.lesion_location_id) === base.locationId);
            requiredLocationFields(row, base.locationId, base.episodeId);
            expect(row.photos).toEqual([]);
            return response;
        }
        let last;
        for (const staff of [accounts.doctor, accounts.nurse, accounts.admin]) {
            last = await api('get', locationsEndpoint(base.episodeId), undefined, { token: staff.token });
            expectCode(last, OK);
            expect(itemsOf(last).some(item => String(item.lesion_location_id) === base.locationId)).toBe(true);
        }
        return last;
    }
    if (number === 3) {
        const { episodeId } = await episodeFixture();
        const response = await api('get', locationsEndpoint(episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        expect(dataOf(response)).toEqual([]);
        return response;
    }
    if (number === 4) {
        const base = await locationFixture();
        const photo = await addPhotoFixture({
            recordId: base.recordId,
            episodeId: base.episodeId,
            locationId: base.locationId
        });
        const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        const row = itemsOf(response).find(item => String(item.lesion_location_id) === base.locationId);
        expect(row?.photos).toEqual(expect.arrayContaining([
            expect.objectContaining({
                attachment: expect.objectContaining({
                    attachment_id: String(photo.attachmentId),
                    file_url: photo.fileUrl
                })
            })
        ]));
        return response;
    }
    if (number === 5) {
        const base = await episodeFixture();
        for (let index = 0; index < 3; index++) {
            await createLocation(base.episodeId, accounts.patientA, { body_part: `Location ${index}` });
        }
        const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        const rows = itemsOf(response);
        expect(rows).toHaveLength(3);
        const times = rows.map(item => Date.parse(item.created_at));
        for (let index = 1; index < times.length; index++) {
            expect(times[index - 1]).toBeLessThanOrEqual(times[index]);
        }
        return response;
    }
    if (number === 6) {
        const { episodeId } = await episodeFixture();
        return api('get', locationsEndpoint(episodeId), undefined, { token: accounts.patientB.token });
    }
    if (number === 7 || number === 8) {
        let last;
        const ids = number === 7 ? ['abc', '1.5', 'true', '[]'] : ['0', '-1', '99999999999999999999'];
        for (const id of ids) {
            last = await api('get', locationsEndpoint(id), undefined, { token: accounts.patientA.token });
            expectCode(last, number === 7 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 9 || number === 10) {
        const { episodeId } = await deletedEpisodeFixture();
        return api('get', locationsEndpoint(episodeId), undefined, { token: accounts.patientA.token });
    }
    if (number >= 11 && number <= 14) {
        const { episodeId } = await episodeFixture();
        const kind = { 11: 'missing', 12: 'invalid', 13: 'expired', 14: 'logout' }[number];
        return authCase(kind, 'get', locationsEndpoint(episodeId), undefined, accounts.patientA);
    }
    throw new Error(`Unhandled Week 8 LOL case ${number}.`);
}

async function patchLocation(locationId, body, token = accounts.patientA.token) {
    return api('patch', locationEndpoint(locationId), body, { token });
}

async function runLocationEdit(number) {
    if (number === 1) {
        const base = await locationFixture();
        const { locationId } = base;
        const response = await patchLocation(locationId, { body_part: 'Updated body part' });
        expectCode(response, OK);
        const list = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(list, OK);
        const row = itemsOf(list).find(item => String(item.lesion_location_id) === locationId);
        expect(row.body_part).toBe('Updated body part');
        return response;
    }
    if (number === 2) {
        const base = await locationFixture();
        let last;
        const individualFields = Object.entries(completeLocationFields)
            .filter(([field]) => !['medication_taken_ago', 'medication_unit'].includes(field));
        for (const [field, value] of individualFields) {
            last = await patchLocation(base.locationId, { [field]: value });
            expectCode(last, OK);
        }
        last = await patchLocation(base.locationId, {
            medication_taken_ago: completeLocationFields.medication_taken_ago,
            medication_unit: completeLocationFields.medication_unit
        });
        expectCode(last, OK);
        const list = await api('get', locationsEndpoint(base.episodeId), undefined, { token: accounts.patientA.token });
        expectCode(list, OK);
        const row = itemsOf(list).find(item => String(item.lesion_location_id) === base.locationId);
        for (const [field, value] of Object.entries(completeLocationFields)) expect(row[field]).toBe(value);
        return last;
    }
    if (number === 3) {
        const base = await locationFixture();
        const body = { body_part: 'All fields changed', ...completeLocationFields };
        const response = await patchLocation(base.locationId, body);
        expectCode(response, OK);
        const list = await api('get', locationsEndpoint(base.episodeId), undefined, { token: accounts.patientA.token });
        expectCode(list, OK);
        const row = itemsOf(list).find(item => String(item.lesion_location_id) === base.locationId);
        for (const [field, value] of Object.entries(body)) expect(row[field]).toBe(value);
        return response;
    }
    if (number === 4) {
        const base = await locationFixture();
        expectCode(await patchLocation(base.locationId, { context_other: 'remove me' }), OK);
        const response = await patchLocation(base.locationId, { context_other: null });
        expectCode(response, OK);
        const list = await api('get', locationsEndpoint(base.episodeId), undefined, { token: accounts.patientA.token });
        expectCode(list, OK);
        const row = itemsOf(list).find(item => String(item.lesion_location_id) === base.locationId);
        expect(row.context_other).toBeNull();
        return response;
    }
    if (number === 5) {
        const base = await locationFixture();
        const beforeList = await api('get', locationsEndpoint(base.episodeId), undefined, { token: accounts.patientA.token });
        const before = itemsOf(beforeList).find(item => String(item.lesion_location_id) === base.locationId);
        await new Promise(resolve => setTimeout(resolve, 1100));
        const response = await patchLocation(base.locationId, { body_part: 'Timestamp updated' });
        expectCode(response, OK);
        const afterList = await api('get', locationsEndpoint(base.episodeId), undefined, { token: accounts.patientA.token });
        const after = itemsOf(afterList).find(item => String(item.lesion_location_id) === base.locationId);
        expect(after.created_at).toBe(before.created_at);
        expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
        return response;
    }
    if (number === 6) return patchLocation((await locationFixture()).locationId, {});
    if (number === 7) return patchLocation((await locationFixture()).locationId, { body_part: 123 });
    if (number === 8) {
        const { locationId } = await locationFixture();
        let last;
        for (const body_part of ['x'.repeat(101), '<b>unsafe</b>']) {
            last = await patchLocation(locationId, { body_part });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 9) {
        const { locationId } = await locationFixture();
        let last;
        for (const body_part of ['', null, '   ']) {
            last = await patchLocation(locationId, { body_part });
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 10) {
        const { locationId } = await locationFixture();
        let last;
        for (const body of [
            { occurred_at: 123 },
            { context_tags: ['a'] },
            { context_other: 123 },
            { medication_name: 123 },
            { medication_taken_ago: 2, medication_unit: 'hour' },
            { medication_taken_ago: '2', medication_unit: 1 }
        ]) {
            last = await patchLocation(locationId, body);
            expectCode(last, '1003');
        }
        return last;
    }
    if (number === 11 || number === 12) {
        const { locationId } = await locationFixture();
        let last;
        for (const occurred_at of number === 11
            ? ['24/04/2026', '2026-13-40 10:00:00', 'abc']
            : [futureDateTime()]) {
            last = await patchLocation(locationId, { occurred_at });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 13) {
        const { locationId } = await locationFixture();
        let last;
        for (const context_tags of ['abc', '{}', '[1]', '["a",null]']) {
            last = await patchLocation(locationId, { context_tags });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 14) {
        const { locationId } = await locationFixture();
        let last;
        for (const context_tags of [
            JSON.stringify(Array.from({ length: 21 }, (_, index) => `tag${index}`)),
            JSON.stringify(['x'.repeat(51)])
        ]) {
            last = await patchLocation(locationId, { context_tags });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 15) {
        const { locationId } = await locationFixture();
        let last;
        for (const body of [
            { context_other: 'x'.repeat(256) },
            { medication_name: 'x'.repeat(101) },
            { context_other: '<b>unsafe</b>' },
            { medication_name: '<b>unsafe</b>' }
        ]) {
            last = await patchLocation(locationId, body);
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 16) {
        const { locationId } = await locationFixture();
        let last;
        for (const medication_taken_ago of ['abc', '-1', '1.5', '10000']) {
            last = await patchLocation(locationId, { medication_taken_ago, medication_unit: 'hour' });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 17) {
        const { locationId } = await locationFixture();
        let last;
        for (const medication_unit of ['year', 'HOUR']) {
            last = await patchLocation(locationId, { medication_taken_ago: '1', medication_unit });
            expectCode(last, '1004');
        }
        return last;
    }
    if (number === 18) {
        const { locationId } = await locationFixture();
        let last;
        for (const body of [{ medication_taken_ago: '1' }, { medication_unit: 'hour' }]) {
            last = await patchLocation(locationId, body);
            expectCode(last, '1002');
        }
        return last;
    }
    if (number === 19) {
        const base = await locationFixture();
        const response = await patchLocation(base.locationId, {
            body_part: 'Mass assignment ignored',
            lesion_location_id: '999999',
            episode_id: '999999'
        });
        expectCode(response, OK);
        expect(String(dataOf(response).lesion_location_id)).toBe(base.locationId);
        expect(String(dataOf(response).episode_id)).toBe(base.episodeId);
        expect(dataOf(response).body_part).toBe('Mass assignment ignored');
        return response;
    }
    if (number === 20 || number === 21) {
        let last;
        for (const id of number === 20
            ? ['abc', '1.5', 'true', '[]']
            : ['0', '-1', '99999999999999999999']) {
            last = await patchLocation(id, { body_part: 'Invalid id' });
            expectCode(last, number === 20 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 22 || number === 23) {
        const { locationId } = await deletedLocationFixture();
        return patchLocation(locationId, { body_part: 'Deleted location' });
    }
    if (number === 24) {
        const { locationId } = await locationFixture();
        return patchLocation(locationId, { body_part: 'Foreign edit' }, accounts.patientB.token);
    }
    if (number === 25) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            const { id } = await createEpisode(recordId);
            const location = await createLocation(id);
            last = await patchLocation(location.id, { body_part: 'Closed record' });
            expectCode(last, '1010');
        }
        return last;
    }
    if (number === 26) {
        const { locationId } = await locationFixture();
        return api('patch', locationEndpoint(locationId), undefined, {
            token: accounts.patientA.token,
            rawBody: '{"body_part":'
        });
    }
    if (number >= 27 && number <= 30) {
        const { locationId } = await locationFixture();
        const kind = { 27: 'missing', 28: 'invalid', 29: 'expired', 30: 'logout' }[number];
        return authCase(kind, 'patch', locationEndpoint(locationId), { body_part: 'Authorization case' }, accounts.patientA);
    }
    if (number === 31) {
        const { locationId } = await locationFixture();
        return patchLocation(locationId, { body_part: 'Admin forbidden' }, accounts.admin.token);
    }
    throw new Error(`Unhandled Week 8 LOU case ${number}.`);
}

async function deleteLocation(locationId, token = accounts.patientA.token) {
    return api('delete', locationEndpoint(locationId), undefined, { token });
}

async function runLocationDelete(number) {
    if (number === 1 || number === 2) {
        let last;
        const actor = number === 1 ? accounts.patientA : accounts.doctor;
        const base = await locationFixture({ actor });
        last = await deleteLocation(base.locationId, actor.token);
        expectCode(last, OK);
        expect(dataOf(last)).toEqual({});
        if (number === 2) {
            const nurseBase = await locationFixture({ actor: accounts.nurse });
            last = await deleteLocation(nurseBase.locationId, accounts.nurse.token);
            expectCode(last, OK);
        }
        return last;
    }
    if (number === 3) {
        const base = await locationFixture();
        expectCode(await deleteLocation(base.locationId), OK);
        const response = await api('get', locationsEndpoint(base.episodeId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, OK);
        expect(itemsOf(response).some(item => String(item.lesion_location_id) === base.locationId)).toBe(false);
        return response;
    }
    if (number === 4) {
        const base = await locationFixture();
        const photo = await addPhotoFixture({
            recordId: base.recordId,
            episodeId: base.episodeId,
            locationId: base.locationId
        });
        const before = await api('get', photoListEndpoint(base.locationId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(before, OK);
        expect(itemsOf(before)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                attachment: expect.objectContaining({
                    attachment_id: String(photo.attachmentId),
                    file_url: photo.fileUrl
                })
            })
        ]));
        expectCode(await deleteLocation(base.locationId), OK);
        const response = await api('get', photoListEndpoint(base.locationId), undefined, {
            token: accounts.patientA.token
        });
        expectCode(response, '9992');
        const attachment = await api('get', attachmentViewEndpoint(photo.attachmentId), undefined, {
            token: accounts.patientA.token
        });
        expect(attachment.status).toBe(200);
        return response;
    }
    if (number === 5) {
        const { locationId } = await locationFixture();
        expectCode(await deleteLocation(locationId), OK);
        return deleteLocation(locationId);
    }
    if (number === 6 || number === 7) {
        let last;
        for (const id of number === 6
            ? ['abc', '1.5', 'true', '[]']
            : ['0', '-1', '99999999999999999999']) {
            last = await deleteLocation(id);
            expectCode(last, number === 6 ? '1003' : '1004');
        }
        return last;
    }
    if (number === 8) {
        const { locationId } = await deletedLocationFixture();
        return deleteLocation(locationId);
    }
    if (number === 9) {
        const { locationId } = await locationFixture();
        return deleteLocation(locationId, accounts.patientB.token);
    }
    if (number === 10) {
        let last;
        for (const status of ['completed', 'cancelled']) {
            const recordId = await closedRecord(status);
            const { id } = await createEpisode(recordId);
            const location = await createLocation(id);
            last = await deleteLocation(location.id);
            expectCode(last, '1010');
        }
        return last;
    }
    if (number >= 11 && number <= 14) {
        const { locationId } = await locationFixture();
        const kind = { 11: 'missing', 12: 'invalid', 13: 'expired', 14: 'logout' }[number];
        return authCase(kind, 'delete', locationEndpoint(locationId), undefined, accounts.patientA);
    }
    if (number === 15) {
        const { locationId } = await locationFixture();
        return deleteLocation(locationId, accounts.admin.token);
    }
    throw new Error(`Unhandled Week 8 LOX case ${number}.`);
}

async function runCase(testCase) {
    switch (testCase.prefix) {
        case 'LEC': return runEpisodeCreate(testCase.number);
        case 'LEM': return runMyEpisodes(testCase.number);
        case 'LER': return runEpisodesByRecord(testCase.number);
        case 'LED': return runEpisodeDetail(testCase.number);
        case 'LEU': return runEpisodeEdit(testCase.number);
        case 'LEX': return runEpisodeDelete(testCase.number);
        case 'LOC': return runLocationCreate(testCase.number);
        case 'LOL': return runLocationList(testCase.number);
        case 'LOU': return runLocationEdit(testCase.number);
        case 'LOX': return runLocationDelete(testCase.number);
        default: throw new Error(`Unhandled Week 8 case ${testCase.id}.`);
    }
}

async function cleanupRecords() {
    const errors = [];
    for (const recordId of [...medicalRecordIds]) {
        try {
            const response = await api('delete', `/api/medical_records/${encodeURIComponent(recordId)}`, undefined, {
                token: accounts.admin.token
            });
            expectCode(response, OK);
            medicalRecordIds.delete(recordId);
        } catch (error) {
            errors.push(`${recordId}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(`Week 8 record cleanup failed: ${errors.join('; ')}`);
}

async function cleanupCaseFixtures() {
    if (!caseFixtureIds.size) return;
    const result = await adapterCall('cleanupWeek8Fixtures', { fixtureIds: [...caseFixtureIds] });
    if (result?.cleaned !== true) {
        throw new Error('cleanupWeek8Fixtures() must return { cleaned: true } for exact Week 8 fixture IDs.');
    }
    caseFixtureIds.clear();
}

async function cleanupAccounts() {
    const errors = [];
    for (const phone of [...accountPhones]) {
        try {
            await adapterCall('deleteUser', { phone });
            accountPhones.delete(phone);
        } catch (error) {
            errors.push(`${phone}: ${error.message}`);
        }
    }
    if (errors.length) throw new Error(`Week 8 account cleanup failed: ${errors.join('; ')}`);
}

beforeAll(async () => {
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

    const prepared = await adapterCall('prepareWeek7Fixtures', {
        uniquePrefix: uniqueName('W8Suite')
    });
    if (!Array.isArray(prepared?.fixtureIds) || prepared.fixtureIds.length === 0 ||
        !prepared?.template?.id) {
        throw new Error('prepareWeek7Fixtures() must return fixtureIds and template.id for Week 8 record creation.');
    }
    prepared.fixtureIds.forEach(id => suiteFixtureIds.add(id));
    fixture = prepared;

    accounts = {};
    for (const [label, role] of [
        ['patientA', 'patient'],
        ['patientB', 'patient'],
        ['doctor', 'doctor'],
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
        ['suite-created medical records', cleanupRecords],
        ['case-specific photo fixtures', cleanupCaseFixtures],
        ['Week 7 record template fixture', async () => {
            if (!suiteFixtureIds.size) return;
            const result = await adapterCall('cleanupWeek7Fixtures', { fixtureIds: [...suiteFixtureIds] });
            if (result?.cleaned !== true) {
                throw new Error('cleanupWeek7Fixtures() must return { cleaned: true } for exact Week 8 suite fixture IDs.');
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

describe('Week 8 lesion episodes and locations', () => {
    for (const testCase of allCases) {
        test(`${testCase.id} [${testCase.expected}] ${testCase.title} — case ${String(testCase.number).padStart(2, '0')}`, async () => {
            const response = await runCase(testCase);
            expectCode(response, testCase.expected);
        });
    }
});
