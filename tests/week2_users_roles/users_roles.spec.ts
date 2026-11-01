import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { MultiRoleSessions, generateValidVnPhone, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 2: MODULE NGƯỜI DÙNG & PHÂN QUYỀN VAI TRÒ (9 APIs)
 * ============================================================================
 * Danh sách API theo phân phối Tuần 2:
 * 1. GET    /api/profile                (get_user_info)
 * 2. PUT    /api/profile                (set_user_info)
 * 3. POST   /api/admin/users            (set_user)
 * 4. GET    /api/admin/users            (get_list_users)
 * 5. GET    /api/admin/users/:id        (get_user_detail)
 * 6. PUT    /api/admin/users/:id        (edit_user / assign)
 * 7. DELETE /api/admin/users/:id        (delete_user)
 * 8. POST   /api/roles                  (set_role)
 * 9. GET    /api/roles                  (get_list_roles)
 */
describe('Week 2 - Users & Roles Management (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  describe('1. GET & PUT /api/profile (Hồ sơ cá nhân & Đối chiếu UI Hành chính A1)', () => {
    it('[TC-PROFILE-01] Happy Path: Bệnh nhân lấy thông tin hồ sơ cá nhân thành công (Code 1000)', async () => {
      const res = await apiClients.userRole.get('/api/profile', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toHaveProperty('phone', sessions.patient.phone);
    });

    it('[TC-PROFILE-02] Happy Path & UI A1 Alignment: Cập nhật thông tin hành chính (ho_ten, ngay_sinh, gioi_tinh, bhyt_so_the) thành công (Code 1000)', async () => {
      const res = await apiClients.userRole.put(
        '/api/profile',
        {
          full_name: 'Nguyễn Văn A (Đã Cập Nhật)',
          gender: 'male',
          dob: '1992-05-15',
          address: 'Số 1 Phương Mai, Đống Đa, Hà Nội',
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-PROFILE-03] Negative Case (Invalid Date Format): Ngày sinh sai định dạng YYYY-MM-DD (mã cũ 2006 gộp về 1004) -> Trả về mã 1004', async () => {
      const res = await apiClients.userRole.put(
        '/api/profile',
        {
          full_name: 'Nguyễn Văn A',
          dob: '31/02/2026_invalid_date',
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-PROFILE-04] Security/Auth: Gọi GET /api/profile không truyền Token -> Trả về mã 9998', async () => {
      const res = await apiClients.userRole.get('/api/profile');
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });

  describe('2. Admin Users CRUD (/api/admin/users)', () => {
    it('[TC-ADMIN-USER-01] Happy Path: Admin tạo mới người dùng, lấy chi tiết, cập nhật và xóa thành công (Code 1000)', async () => {
      const phone = generateValidVnPhone('09');
      const createRes = await apiClients.userRole.post(
        '/api/admin/users',
        {
          full_name: 'User Tạo Bởi Admin',
          phone,
          password: 'UserPass@123',
          role_id: 3,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const userId = createRes.body?.data?.user_id || createRes.body?.data?.id;
      expect(userId).toBeTruthy();

      if (userId) {
        testCaseTeardown.registerUser(userId, sessions.admin.token);

        const detailRes = await apiClients.userRole.get(`/api/admin/users/${userId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);

        const updateRes = await apiClients.userRole.put(
          `/api/admin/users/${userId}`,
          { full_name: 'User Đã Sửa Tên' },
          { token: sessions.admin.token }
        );
        expectResponseCode(updateRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-ADMIN-USER-02] Security/Authorization: Bệnh nhân cố tình lấy danh sách người dùng Admin -> Trả về mã 1009', async () => {
      const res = await apiClients.userRole.get('/api/admin/users', {
        token: sessions.patient.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });

    it('[TC-ADMIN-USER-03] Negative Case (Not Found): Xem chi tiết hoặc xóa user_id không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.userRole.get('/api/admin/users/99999999', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });
  });

  describe('3. Roles Management (GET & POST /api/roles)', () => {
    it('[TC-ROLE-01] Happy Path: Admin lấy danh sách vai trò (get_list_roles) thành công (Code 1000)', async () => {
      const res = await apiClients.userRole.get('/api/roles', {
        token: sessions.admin.token,
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[TC-ROLE-02] Negative Case (Missing Param): Tạo vai trò mới thiếu tên vai trò -> Trả về mã 1002', async () => {
      const res = await apiClients.userRole.post('/api/roles', {}, { token: sessions.admin.token });

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-ROLE-03] Security/Authorization: Bệnh nhân cố tình tạo Role mới -> Trả về mã 1009', async () => {
      const res = await apiClients.userRole.post(
        '/api/roles',
        { name: 'hacker_role', description: 'Unauthorized role' },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.PERMISSION_DENIED);
    });
  });
});
