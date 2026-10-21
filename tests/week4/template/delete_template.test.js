const request = require('supertest');
const app = require('../../../app');

describe('W4 - API: DELETE /api/templates/{code_template} (delete_template - 13 Test Cases)', () => {
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

    test('W4-TDL-01: Xoá mẫu chưa dùng', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
    });

    test('W4-TDL-02: Sau xoá: detail', async () => {
        const deleteRes = await request(app).delete("/api/templates/TMPL_TEST")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deleteRes.status).toBe(200);

        const detailRes = await request(app).get("/api/templates/TMPL_TEST")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(detailRes.status).toBe(404);
        expect(detailRes.body.code).toBe("3401");
    });

    test('W4-TDL-03: Xoá lần 2', async () => {
        const firstRes = await request(app).delete("/api/templates/TMPL_TEST")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(firstRes.status).toBe(200);

        const secondRes = await request(app).delete("/api/templates/TMPL_TEST")
            .set('Authorization', `Bearer ${adminToken}`);
        expect(secondRes.status).toBe(404);
        expect(secondRes.body.code).toBe("3401");
    });

    test('W4-TDL-04: Xoá cascade section / question', async () => {
        app.db.sections = [{ section_id: 11, code_template: 'TMPL_TEST', name: 'Section test' }];
        app.db.questions = [{ question_id: 21, section_id: 11, content: 'Question test' }];
        app.db.options = [{ option_id: 31, question_id: 21, content: 'Option test' }];

        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
        expect(app.db.templates.some(x => x.code_template === 'TMPL_TEST')).toBe(false);
        expect(app.db.sections.some(x => x.section_id === 11)).toBe(false);
        expect(app.db.questions.some(x => x.question_id === 21)).toBe(false);
        expect(app.db.options.some(x => x.option_id === 31)).toBe(false);
    });

    test('W4-TDL-05: Mẫu đã có bệnh án dùng', async () => {
        app.db.medical_records = [{ id: 1, code_template: 'TMPL_TEST' }];

        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("3407");
    });

    test('W4-TDL-06: code sai format', async () => {
        const res = await request(app).delete("/api/templates/abc%20def").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2003");
    });

    test('W4-TDL-07: code_template không tồn tại', async () => {
        const res = await request(app).delete("/api/templates/TMPL_MISSING").set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3401");
    });

    test('W4-TDL-08: Không có header Authorization', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W4-TDL-09: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', "Bearer abc");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TDL-10: Token hết hạn', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', "Bearer expired_token_mock");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3002");
    });

    test('W4-TDL-11: Token đã logout (blacklist)', async () => {
        app.db.blacklist.add('token_1');
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', "Bearer token_1");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W4-TDL-12: Token role patient không có quyền gọi API này', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W4-TDL-13: Token role doctor không có quyền gọi API này', async () => {
        const res = await request(app).delete("/api/templates/TMPL_TEST").set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

});
