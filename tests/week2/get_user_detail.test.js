const request = require('supertest');
const app = require('../../app');

describe('W2 - API: GET /api/users/:id (get_user_detail - Full 13 Test Cases)', () => {
    let adminToken = '';
    let patientToken = '';
    let doctorToken = '';
    const adminPhone = '0912345678';
    const patientPhone = '0988776655';
    const doctorPhone = '0977444555';

    beforeEach(async () => {
        app.db.users.length = 0;
        app.db.users.push({ user_id: 1, full_name: 'Admin System', phone: adminPhone, password: 'password123', role_id: 3, is_active: 1 });
        app.db.users.push({ user_id: 2, full_name: 'Patient User', phone: patientPhone, password: 'password123', role_id: 1, is_active: 1 });
        app.db.users.push({ user_id: 3, full_name: 'Doctor User', phone: doctorPhone, password: 'password123', role_id: 2, is_active: 1 });
        app.db.blacklist.clear();

        const aLogin = await request(app).post('/api/auth/login').send({ phone: adminPhone, password: 'password123' });
        adminToken = aLogin.body.data.token;

        const pLogin = await request(app).post('/api/auth/login').send({ phone: patientPhone, password: 'password123' });
        patientToken = pLogin.body.data.token;

        const dLogin = await request(app).post('/api/auth/login').send({ phone: doctorPhone, password: 'password123' });
        doctorToken = dLogin.body.data.token;
    });

    test('W2-GUD-01: Xem chi tiết 1 bệnh nhân', async () => {
        const res = await request(app).get('/api/users/2').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
        expect(res.body.data.user_id).toBe(2);
        expect(res.body.data.full_name).toBe('Patient User');
    });

    test('W2-GUD-02: Dữ liệu khớp thao tác trước (sau khi cập nhật profile)', async () => {
        await request(app).put('/api/profile').set('Authorization', `Bearer ${patientToken}`).send({ full_name: 'Updated Patient Name' });
        const res = await request(app).get('/api/users/2').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
        expect(res.body.data.full_name).toBe('Updated Patient Name');
    });

    test('W2-GUD-03: Xem chi tiết staff / admin', async () => {
        const res = await request(app).get('/api/users/3').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("1000");
        expect(res.body.data.role_id).toBe(2);
    });

    test('W2-GUD-04: id không phải số nguyên (string/abc)', async () => {
        const res = await request(app).get('/api/users/abc').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("2002");
    });

    test('W2-GUD-05: id = 0, số âm, vượt giới hạn int', async () => {
        const res0 = await request(app).get('/api/users/0').set('Authorization', `Bearer ${adminToken}`);
        expect(res0.status).toBe(400);
        expect(res0.body.code).toBe("2003");

        const resNeg = await request(app).get('/api/users/-5').set('Authorization', `Bearer ${adminToken}`);
        expect(resNeg.status).toBe(400);
        expect(resNeg.body.code).toBe("2003");
    });

    test('W2-GUD-06: id hợp lệ nhưng không tồn tại', async () => {
        const res = await request(app).get('/api/users/9999').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3007");
    });

    test('W2-GUD-07: id của bản ghi đã bị xoá', async () => {
        await request(app).delete('/api/users/2').set('Authorization', `Bearer ${adminToken}`);
        const res = await request(app).get('/api/users/2').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("3007");
    });

    test('W2-GUD-08: Không có header Authorization', async () => {
        const res = await request(app).get('/api/users/2');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3003");
    });

    test('W2-GUD-09: Token sai / giả mạo / sai scheme', async () => {
        const res = await request(app).get('/api/users/2').set('Authorization', 'Bearer invalid');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W2-GUD-10: Token hết hạn', async () => {
        const res = await request(app).get('/api/users/2').set('Authorization', 'Bearer expired_token_mock');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W2-GUD-11: Token đã logout (blacklist)', async () => {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${adminToken}`);
        const res = await request(app).get('/api/users/2').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("3001");
    });

    test('W2-GUD-12: Token role patient gọi API chỉ dành cho Admin', async () => {
        const res = await request(app).get('/api/users/3').set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });

    test('W2-GUD-13: Token role doctor gọi API chỉ dành cho Admin', async () => {
        const res = await request(app).get('/api/users/2').set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("3102");
    });
});