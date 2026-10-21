const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: POST /api/rooms (set_room - 21 Test Cases)', () => {
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

    test('W4-RST-01: Tạo phòng đủ field', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Moi", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-RST-02: Không có description', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Xet Nghiem", "department_id": 1});
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-RST-03: Phòng mới xuất hiện trong list và detail', async () => {
        const createRes = await request(app).post("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: "Phong Moi 3", description: "Mo ta test", department_id: 1 });
        expect(createRes.status).toBe(201);
        expect(createRes.body.code).toBe("1001");

        const id = createRes.body.data.id;
        const listRes = await request(app).get("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.some(item => item.id === id)).toBe(true);

        const detailRes = await request(app).get(`/api/rooms/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.id).toBe(id);
    });

    test('W4-RST-04: Cùng name ở khoa khác', async () => {
        app.db.departments.push({ id: 2, name: "Khoa 2", description: "Mo ta test", branch_id: 1 });
        const res = await request(app).post("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: "Phong Test", description: "Mo ta test", department_id: 2 });
        expect(res.status).toBe(201);
        expect(res.body.code).toBe("1001");
    });

    test('W4-RST-05: Thiếu từng field bắt buộc', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-RST-06: Body {} / name=\'\' / null', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": ""});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2001");
    });

    test('W4-RST-07: Sai kiểu dữ liệu', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "<script>alert(1)</script>", "description": 123, "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W4-RST-08: name toàn khoảng trắng', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "   ", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RST-09: name / description quá dài', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "<script>alert(1)</script>", "description": "ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RST-10: department_id ≤ 0', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 0});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RST-11: XSS / SQLi', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "<script>alert(1)</script>", "description": "' OR 1=1 --", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-RST-12: department_id không tồn tại', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 999999999});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3302");
    });

    test('W4-RST-13: Trùng name trong cùng khoa', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${adminToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("3307");
    });

    test('W4-RST-14: 2 request đồng thời cùng name + khoa', async () => {
        const payload = { name: "Phong Dong Thoi", description: "Mo ta test", department_id: 1 };
        const sendRequest = () => request(app).post("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`).send(payload);
        const results = await Promise.all([sendRequest(), sendRequest()]);
        expect(results.map(x => x.status).sort((a, b) => a - b)).toEqual([201, 400]);
        expect(results.filter(x => x.body.code === "1001")).toHaveLength(1);
        expect(results.filter(x => x.body.code === "3307")).toHaveLength(1);
    });

    test('W4-RST-15: JSON sai cú pháp', async () => {
        const res = await request(app).post("/api/rooms")
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send('{"broken":');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2007");
    });

    test('W4-RST-16: Không có header Authorization', async () => {
        const res = await request(app).post("/api/rooms").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-RST-17: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', "Bearer abc").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RST-18: Token hết hạn', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', "Bearer expired_token_mock").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-RST-19: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).post("/api/rooms").set('Authorization', "Bearer token_1").send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-RST-20: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${patientToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-RST-21: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).post("/api/rooms").set('Authorization', `Bearer ${doctorToken}`).send({"name": "Phong Test", "description": "Mo ta test", "department_id": 1});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
