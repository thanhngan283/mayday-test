import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 3: MODULE PERMISSION & CƠ CẤU TỔ CHỨC - BRANCHES (12 APIs)
 * ============================================================================
 * Danh sách 12 API theo phân phối Tuần 3 (`1. Weekly API.html`):
 * 1.  POST   /api/permissions                              (set_permission)
 * 2.  GET    /api/permissions                              (get_list_permissions)
 * 3.  PUT    /api/permissions/:id                          (edit_permission)
 * 4.  DELETE /api/permissions/:id                          (delete_permission)
 * 5.  POST   /api/roles/:roleId/permissions                (set_role_permissions)
 * 6.  GET    /api/roles/:roleId/permissions                (get_role_permissions)
 * 7.  DELETE /api/roles/:roleId/permissions/:permissionId  (delete_role_permission)
 * 8.  POST   /api/branches                                 (set_branch)
 * 9.  GET    /api/branches                                 (get_list_branches)
 * 10. GET    /api/branches/:id                             (get_branch_detail)
 * 11. PUT    /api/branches/:id                             (edit_branch)
 * 12. DELETE /api/branches/:id                             (delete_branch)
 */
describe('Week 3 - Permissions, Role-Permissions & Branches CRUD (Real API, Zero Mocking)', () => {
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

  // ==========================================================================
  // PHẦN 1: PERMISSION CRUD (/api/permissions)
  // ==========================================================================
  describe('1. Permission Management (/api/permissions)', () => {
    it('[TC-PERM-01] Happy Path: Admin tạo mới, lấy danh sách, cập nhật và xóa Permission thành công (Code 1000)', async () => {
      const uniquePermName = `medrec.review.${Date.now()}`;

      // 1. Tạo mới Permission
      const createRes = await apiClients.userRole.post(
        '/api/permissions',
        {
          name: uniquePermName,
          description: 'Quyền duyệt bệnh án phản vệ nâng cao',
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const permId = createRes.body?.data?.id || createRes.body?.data?.permission_id;
      expect(permId).toBeTruthy();

      if (permId) {
        testCaseTeardown.register({
          description: `Cleanup permission ${permId}`,
          execute: async () => {
            await apiClients.userRole.delete(`/api/permissions/${permId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // 2. Lấy danh sách Permissions
        const listRes = await apiClients.userRole.get('/api/permissions', {
          token: sessions.admin.token,
        });
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // 3. Cập nhật Permission
        const editRes = await apiClients.userRole.put(
          `/api/permissions/${permId}`,
          {
            name: uniquePermName,
            description: 'Quyền duyệt bệnh án phản vệ (Đã cập nhật)',
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // 4. Xóa Permission
        const delRes = await apiClients.userRole.delete(`/api/permissions/${permId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-PERM-02] Negative Case (Missing Parameter): Tạo Permission thiếu trường name -> Trả về mã 1002', async () => {
      const res = await apiClients.userRole.post(
        '/api/permissions',
        { description: 'Thiếu trường name bắt buộc' },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-PERM-03] Negative Case (Duplicate Permission): Tạo Permission trùng tên đã tồn tại -> Trả về mã 9996', async () => {
      const permName = `dup.perm.${Date.now()}`;
      const firstRes = await apiClients.userRole.post(
        '/api/permissions',
        { name: permName, description: 'Bản ghi gốc' },
        { token: sessions.admin.token }
      );

      const permId = firstRes.body?.data?.id || firstRes.body?.data?.permission_id;
      if (permId) {
        testCaseTeardown.register({
          description: `Cleanup duplicate test permission ${permId}`,
          execute: async () => {
            await apiClients.userRole.delete(`/api/permissions/${permId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }

      const dupRes = await apiClients.userRole.post(
        '/api/permissions',
        { name: permName, description: 'Bản ghi trùng' },
        { token: sessions.admin.token }
      );
      expectResponseCode(dupRes.body.code, [
        RESPONSE_CODES.USER_EXISTED,
        RESPONSE_CODES.INVALID_PARAMETER_VALUE,
      ]);
    });

    it('[TC-PERM-04] Security/RBAC: Bệnh nhân gọi POST /api/permissions -> Bị từ chối với mã 1009 (Not Access)', async () => {
      const res = await apiClients.userRole.post(
        '/api/permissions',
        { name: `hack.perm.${Date.now()}` },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });

  // ==========================================================================
  // PHẦN 2: ROLE - PERMISSION MAPPING (/api/roles/:roleId/permissions)
  // ==========================================================================
  describe('2. Role-Permissions Mapping (/api/roles/:roleId/permissions)', () => {
    it('[TC-ROLE-PERM-01] Happy Path: Gán quyền vào Role, lấy danh sách quyền của Role và gỡ quyền thành công (Code 1000)', async () => {
      // Tạo một permission tạm để gán
      const permRes = await apiClients.userRole.post(
        '/api/permissions',
        {
          name: `role.map.${Date.now()}`,
          description: 'Quyền test gán vào Role Bác sĩ',
        },
        { token: sessions.admin.token }
      );
      const permId = permRes.body?.data?.id || permRes.body?.data?.permission_id;

      if (permId) {
        testCaseTeardown.register({
          description: `Cleanup permission ${permId}`,
          execute: async () => {
            await apiClients.userRole.delete(`/api/permissions/${permId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // 1. Gán quyền vào Role (Role ID = 2 - Doctor)
        const assignRes = await apiClients.userRole.post(
          '/api/roles/2/permissions',
          { permission_ids: [permId], permission_id: permId },
          { token: sessions.admin.token }
        );
        expectResponseCode(assignRes.body.code, RESPONSE_CODES.OK);

        // 2. Xem danh sách quyền của Role 2
        const getRes = await apiClients.userRole.get('/api/roles/2/permissions', {
          token: sessions.admin.token,
        });
        expectResponseCode(getRes.body.code, RESPONSE_CODES.OK);

        // 3. Gỡ quyền khỏi Role 2
        const removeRes = await apiClients.userRole.delete(
          `/api/roles/2/permissions/${permId}`,
          { token: sessions.admin.token }
        );
        expectResponseCode(removeRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-ROLE-PERM-02] Negative Case (Not Found): Gán quyền cho Role ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.userRole.post(
        '/api/roles/999999/permissions',
        { permission_ids: [1] },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, [
        RESPONSE_CODES.NOT_FOUND,
        RESPONSE_CODES.INVALID_PARAMETER_VALUE,
      ]);
    });
  });

  // ==========================================================================
  // PHẦN 3: BRANCHES CRUD (/api/branches)
  // ==========================================================================
  describe('3. Branches CRUD (/api/branches)', () => {
    it('[TC-BRANCH-01] Happy Path: Admin tạo mới Chi nhánh bệnh viện, xem danh sách, xem chi tiết, sửa và xóa (Code 1000)', async () => {
      const branchCode = `CN_${Date.now()}`;
      const createRes = await apiClients.orgFacility.post(
        '/api/branches',
        {
          name: `Cơ sở Giải Phóng ${Date.now()}`,
          code: branchCode,
          address: '78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội',
          phone: '02438693731',
          is_active: true,
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);

      const branchId = createRes.body?.data?.id || createRes.body?.data?.branch_id;
      expect(branchId).toBeTruthy();

      if (branchId) {
        testCaseTeardown.register({
          description: `Cleanup branch ${branchId}`,
          execute: async () => {
            await apiClients.orgFacility.delete(`/api/branches/${branchId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // GET list
        const listRes = await apiClients.orgFacility.get('/api/branches', {
          token: sessions.admin.token,
        });
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // GET detail
        const detailRes = await apiClients.orgFacility.get(`/api/branches/${branchId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);

        // PUT edit
        const editRes = await apiClients.orgFacility.put(
          `/api/branches/${branchId}`,
          {
            name: `Cơ sở Giải Phóng (Đã cập nhật)`,
            address: '78 Giải Phóng, Đống Đa, Hà Nội',
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // DELETE
        const delRes = await apiClients.orgFacility.delete(`/api/branches/${branchId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-BRANCH-02] Negative Case (Missing Parameter): Tạo Chi nhánh thiếu tên chi nhánh -> Trả về mã 1002', async () => {
      const res = await apiClients.orgFacility.post(
        '/api/branches',
        { address: 'Địa chỉ không có tên chi nhánh' },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-BRANCH-03] Negative Case (Not Found): Xem chi tiết Chi nhánh ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.orgFacility.get('/api/branches/99999999', {
        token: sessions.admin.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-BRANCH-04] Security/RBAC: Bệnh nhân gọi DELETE /api/branches/1 -> Bị chặn với mã 1009', async () => {
      const res = await apiClients.orgFacility.delete('/api/branches/1', {
        token: sessions.patient.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });
});
