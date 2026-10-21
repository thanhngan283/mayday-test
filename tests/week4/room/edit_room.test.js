const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: PUT /api/rooms/{id} (edit_room - 23 Test Cases)', () => {
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

    test('W4-RED-01: Đổi name', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-02: Đổi description', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"description": "Mo ta moi", "version": "2.1", "is_active": "0"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-03: Chuyển sang khoa khác', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-04: updated_at / created_at', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-05: Đổi sang chính tên hiện tại', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-06: Body {}', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-RED-07: Sai kiểu dữ liệu', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": 123, "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-RED-08: name rỗng / toàn khoảng trắng / quá dài / có \'<\'', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "<script>alert(1)</script>", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RED-09: department_id ≤ 0 hoặc null', async () => {
        const res = await request(app).put("/api/rooms/0").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 0});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RED-10: department_id mới không tồn tại', async () => {
        const res = await request(app).put("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: "Phong Test", description: "Mo ta test", department_id: 999999999 });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3302");
    });

    test('W4-RED-11: name trùng phòng khác cùng khoa', async () => {
        app.db.rooms.push({ id: 2, name: "Phong Khac", description: "Mo ta", department_id: 1 });
        const res = await request(app).put("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: "Phong Khac" });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("3307");
    });

    test('W4-RED-12: id không phải số nguyên', async () => {
        const res = await request(app).put("/api/rooms/abc").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-RED-13: id = 0, số âm, vượt giới hạn int', async () => {
        const res = await request(app).put("/api/rooms/0").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RED-14: id hợp lệ nhưng không tồn tại', async () => {
        const res = await request(app).put("/api/rooms/999999999").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 999999999});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3303");
    });

    test('W4-RED-15: id của bản ghi đã bị xoá', async () => {
        const res = await request(app).put("/api/rooms/999999999").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3303");
    });

    test('W4-RED-16: Mass assignment', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi", "code_template": "TMPL_HACK", "created_at": "2000-01-01"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-RED-17: JSON sai cú pháp', async () => {
        const res = await request(app).put("/api/rooms/1")
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send('{"broken":');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2007");
    });

    test('W4-RED-18: Không có header Authorization', async () => {
        const res = await request(app).put("/api/rooms/1").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-RED-19: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', "Bearer abc").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RED-20: Token hết hạn', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', "Bearer expired_token_mock").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-RED-21: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).put("/api/rooms/1").set('Authorization', "Bearer token_1").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RED-22: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${patientToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-RED-23: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).put("/api/rooms/1").set('Authorization', `Bearer ${doctorToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
