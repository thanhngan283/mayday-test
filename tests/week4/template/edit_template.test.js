const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: PUT /api/templates/{code_template} (edit_template - 19 Test Cases)', () => {
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

    test('W4-TED-01: Đổi name', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TED-02: Đổi description / version / is_active', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"description": "Mo ta moi", "version": "2.1", "is_active": "0"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TED-03: Đổi tất cả field', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi", "description": "Mo ta moi", "version": "2.1", "is_active": "0"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TED-04: Template đã dùng vẫn sửa được metadata', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TED-05: Body {}', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-TED-06: Sai kiểu dữ liệu', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": 123, "description": "Mo ta test", "version": 2, "is_active": 0});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-TED-07: name rỗng / toàn khoảng trắng / quá dài / có \'<\'', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "<script>alert(1)</script>", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TED-08: version / is_active sai', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "abc", "is_active": "2"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TED-09: code sai format ở path', async () => {
        const res = await request(app).put("/api/templates/abc%20def").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "tmpl_urt", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TED-10: code_template không tồn tại', async () => {
        const res = await request(app).put("/api/templates/TMPL_MISSING").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3401");
    });

    test('W4-TED-11: code_template của bản ghi đã bị xoá', async () => {
        const res = await request(app).put("/api/templates/TMPL_MISSING").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3401");
    });

    test('W4-TED-12: Mass assignment: đổi code_template', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`).send({"name": "Ten moi", "code_template": "TMPL_HACK", "created_at": "2000-01-01"});
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TED-13: JSON sai cú pháp', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST")
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send('{"broken":');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2007");
    });

    test('W4-TED-14: Không có header Authorization', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-TED-15: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', "Bearer abc").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TED-16: Token hết hạn', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', "Bearer expired_token_mock").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-TED-17: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', "Bearer token_1").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TED-18: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${patientToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-TED-19: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).put("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${doctorToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
