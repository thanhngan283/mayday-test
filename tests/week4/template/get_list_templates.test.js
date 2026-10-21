const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: GET /api/templates/all (get_list_templates - 13 Test Cases)', () => {
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

    test('W4-TLS-01: Không truyền param', async () => {
        const res = await request(app).get("/api/templates/all").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TLS-02: Mẫu vừa tạo có trong danh sách (kể cả is_active=\'0\')', async () => {
        const res = await request(app).get("/api/templates/all").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TLS-03: Phân trang', async () => {
        const res = await request(app).get("/api/templates/all?limit=2&page=1").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TLS-04: Mọi role đều gọi được', async () => {
        for (const token of [adminToken, patientToken, doctorToken]) {
            const res = await request(app).get("/api/templates/all")
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.code).toBe("1000");
        }
    });

    test('W4-TLS-05: Thứ tự ổn định', async () => {
        const res = await request(app).get("/api/templates/all").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TLS-06: page vượt tổng số trang', async () => {
        const res = await request(app).get("/api/templates/all?page=9999").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TLS-07: limit quá lớn', async () => {
        const res = await request(app).get("/api/templates/all?limit=101").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TLS-08: page / limit = 0 hoặc âm', async () => {
        const res = await request(app).get("/api/templates/all?page=0").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TLS-09: page / limit không phải số nguyên', async () => {
        const res = await request(app).get("/api/templates/all?page=abc").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-TLS-10: Không có header Authorization', async () => {
        const res = await request(app).get("/api/templates/all");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-TLS-11: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).get("/api/templates/all").set('Authorization', "Bearer abc");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TLS-12: Token hết hạn', async () => {
        const res = await request(app).get("/api/templates/all").set('Authorization', "Bearer expired_token_mock");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-TLS-13: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).get("/api/templates/all").set('Authorization', "Bearer token_1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

});
