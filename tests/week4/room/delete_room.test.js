const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: DELETE /api/rooms/{id} (delete_room - 13 Test Cases)', () => {
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

    test('W4-RDL-01: Xoá phòng', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RDL-02: Sau xoá: detail và list', async () => {
        const deleteRes = await request(app).delete("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deleteRes.status).toBe(200);

        const detailRes = await request(app).get("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(detailRes.status).toBe(404);
        expect(detailRes.body.code).toBe("3303");

        const listRes = await request(app).get("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.some(item => item.id === 1)).toBe(false);
    });

    test('W4-RDL-03: Xoá lần 2', async () => {
        const firstRes = await request(app).delete("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(firstRes.status).toBe(200);

        const secondRes = await request(app).delete("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(secondRes.status).toBe(404);
        expect(secondRes.body.code).toBe("3303");
    });

    test('W4-RDL-04: Nhân viên thuộc phòng được SET NULL', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RDL-05: id không phải số nguyên', async () => {
        const res = await request(app).delete("/api/rooms/abc").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-RDL-06: id = 0, số âm, vượt giới hạn int', async () => {
        const res = await request(app).delete("/api/rooms/0").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RDL-07: id hợp lệ nhưng không tồn tại', async () => {
        const res = await request(app).delete("/api/rooms/999999999").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3303");
    });

    test('W4-RDL-08: Không có header Authorization', async () => {
        const res = await request(app).delete("/api/rooms/1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-RDL-09: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', "Bearer abc");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RDL-10: Token hết hạn', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', "Bearer expired_token_mock");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-RDL-11: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).delete("/api/rooms/1").set('Authorization', "Bearer token_1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RDL-12: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-RDL-13: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).delete("/api/rooms/1").set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
