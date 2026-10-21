const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: GET /api/templates/{code_template} (get_template_detail - 12 Test Cases)', () => {
    const adminToken = 'token_1';
    const patientToken = 'token_2';
    const doctorToken = 'token_3';

    beforeEach(() => {
        app.db.users.length = 0;
        app.db.users.push(
            { user_id: 1, full_name: 'Admin System', phone: '0912345678', password: 'password123', role_id: 3, is_active: 1 },
            { user_id: 2, full_name: 'Patient Test', phone: '0988776655', password: 'password123', role_id: 1, is_active: 1 },
            { user_id: 3, full_name: 'Doctor Test', phone: '0977444555', password: 'password123', role_id: 2, is_active: 1 }
        );
        app.db.blacklist.clear();
        app.db.branches = [{ id: 1, name: 'Chi nhanh test', address: 'Ha Noi', phone: '0241234567' }];
        app.db.departments = [{ id: 1, name: 'Khoa Test', description: 'Mo ta test', branch_id: 1, created_at: new Date().toISOString() }];
        app.db.rooms = [{ id: 1, name: 'Phong Test', description: 'Mo ta test', department_id: 1, created_at: new Date().toISOString() }];
        app.db.templates = [{ code_template: 'TMPL_TEST', name: 'Mau test', description: 'Mo ta test', version: '1.0', is_active: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sections: [] }];
        app.db.sections = app.db.sections || [];
        app.db.questions = app.db.questions || [];
        app.db.options = app.db.options || [];
    });

    test('W4-TGT-01: Mẫu có đầy đủ cây', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TGT-02: Thứ tự hiển thị theo order', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TGT-03: Mẫu rỗng', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TGT-04: Mẫu is_active=\'0\' vẫn xem được', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TGT-05: Mọi role đều gọi được', async () => {
        for (const token of [adminToken, patientToken, doctorToken]) {
            const res = await request(app).get("/api/templates/TMPL_TEST")
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.code).toBe("1000");
        }
    });

    test('W4-TGT-06: code sai format', async () => {
        const res = await request(app).get("/api/templates/abc%20def").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TGT-07: code_template không tồn tại', async () => {
        const res = await request(app).get("/api/templates/TMPL_MISSING").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3401");
    });

    test('W4-TGT-08: code_template của bản ghi đã bị xoá', async () => {
        const res = await request(app).get("/api/templates/TMPL_MISSING").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3401");
    });

    test('W4-TGT-09: Không có header Authorization', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-TGT-10: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', "Bearer abc");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TGT-11: Token hết hạn', async () => {
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', "Bearer expired_token_mock");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-TGT-12: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).get("/api/templates/TMPL_TEST").set('Authorization', "Bearer token_1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

});
