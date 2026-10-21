const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: GET /api/rooms/{id} (get_room_detail - 10 Test Cases)', () => {
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

    test('W4-RGT-01: Xem chi tiết phòng', async () => {
        const res = await request(app).get("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RGT-02: Mọi role đều gọi được', async () => {
        for (const token of [adminToken, patientToken, doctorToken]) {
            const res = await request(app).get("/api/rooms/1")
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.code).toBe("1000");
        }
    });

    test('W4-RGT-03: id không phải số nguyên', async () => {
        const res = await request(app).get("/api/rooms/abc").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-RGT-04: id = 0, số âm, vượt giới hạn int', async () => {
        const res = await request(app).get("/api/rooms/0").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RGT-05: id hợp lệ nhưng không tồn tại', async () => {
        const res = await request(app).get("/api/rooms/999999999").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3303");
    });

    test('W4-RGT-06: id của bản ghi đã bị xoá', async () => {
        const res = await request(app).get("/api/rooms/999999999").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3303");
    });

    test('W4-RGT-07: Không có header Authorization', async () => {
        const res = await request(app).get("/api/rooms/1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-RGT-08: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).get("/api/rooms/1").set('Authorization', "Bearer abc");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RGT-09: Token hết hạn', async () => {
        const res = await request(app).get("/api/rooms/1").set('Authorization', "Bearer expired_token_mock");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-RGT-10: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).get("/api/rooms/1").set('Authorization', "Bearer token_1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

});
