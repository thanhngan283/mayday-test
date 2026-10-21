const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: POST /api/templates (set_template - 21 Test Cases)', () => {
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

    test('W4-TST-01: Chỉ có field bắt buộc', async () => {
        const res = await request(app).post("/api/templates")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ code_template: "TMPL_NEW", name: "Mau moi" });
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-TST-02: Đủ field', async () => {
        const res = await request(app).post("/api/templates")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ code_template: "TMPL_NEW_2", name: "Mau day du", description: "Mo ta test", version: "2.1", is_active: "0" });
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-TST-03: Mẫu mới xuất hiện trong list và detail', async () => {
        const createRes = await request(app).post("/api/templates")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ code_template: "TMPL_NEW_3", name: "Mau moi 3" });
        expect(createRes.status).toBe(201);

        const listRes = await request(app).get("/api/templates/all")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.some(item => item.code_template === "TMPL_NEW_3")).toBe(true);

        const detailRes = await request(app).get("/api/templates/TMPL_NEW_3")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.code_template).toBe("TMPL_NEW_3");
    });

    test('W4-TST-04: Các version hợp lệ', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_VER_TEST", "name": "Mau version", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-TST-05: Thiếu từng field bắt buộc', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-TST-06: Body {} / \'\' / null', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-TST-07: Sai kiểu dữ liệu', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "<script>alert(1)</script>", "description": 123, "version": 2, "is_active": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-TST-08: code_template sai format', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "tmpl_urt", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TST-09: name toàn khoảng trắng / quá dài / có \'<\'', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "<script>alert(1)</script>", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TST-10: description quá dài', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "<script>alert(1)</script>", "description": "ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TST-11: version sai format', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "abc", "is_active": "1"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TST-12: is_active ngoài \'0\' / \'1\'', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "2"});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TST-13: code_template đã tồn tại', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${adminToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("3402");
    });

    test('W4-TST-14: 2 request đồng thời cùng code', async () => {
        const payload = { code_template: "TMPL_CONCURRENT", name: "Mau dong thoi", description: "Mo ta test", version: "1.0", is_active: "1" };
        const sendRequest = () => request(app).post("/api/templates")
            .set('Authorization', `Bearer ${adminToken}`).send(payload);
        const results = await Promise.all([sendRequest(), sendRequest()]);
        expect(results.map(x => x.status).sort((a, b) => a - b)).toEqual([201, 409]);
        expect(results.filter(x => x.body.code === "1001")).toHaveLength(1);
        expect(results.filter(x => x.body.code === "3402")).toHaveLength(1);
    });

    test('W4-TST-15: JSON sai cú pháp', async () => {
        const res = await request(app).post("/api/templates")
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send('{"code_template":');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2007");
    });

    test('W4-TST-16: Không có header Authorization', async () => {
        const res = await request(app).post("/api/templates").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-TST-17: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', "Bearer abc").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TST-18: Token hết hạn', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', "Bearer expired_token_mock").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-TST-19: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).post("/api/templates").set('Authorization', "Bearer token_1").send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TST-20: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${patientToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-TST-21: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).post("/api/templates").set('Authorization', `Bearer ${doctorToken}`).send({"code_template": "TMPL_TEST", "name": "Mau test", "description": "Mo ta test", "version": "1.0", "is_active": "1"});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
