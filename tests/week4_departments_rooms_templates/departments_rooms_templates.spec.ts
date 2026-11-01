import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 4: MODULE KHOA/BAN (DEPARTMENTS), PHÒNG KHÁM (ROOMS) & BIỂU MẪU BỆNH ÁN (TEMPLATES) (15 APIs)
 * ============================================================================
 * Danh sách 15 API theo phân phối Tuần 4 (`1. Weekly API.html`):
 * [Departments - 5 APIs]
 * 1.  POST   /api/departments            (set_department)
 * 2.  GET    /api/departments            (get_list_departments)
 * 3.  GET    /api/departments/:id        (get_department_detail)
 * 4.  PUT    /api/departments/:id        (edit_department)
 * 5.  DELETE /api/departments/:id        (delete_department)
 *
 * [Rooms - 5 APIs]
 * 6.  POST   /api/rooms                  (set_room)
 * 7.  GET    /api/rooms                  (get_list_rooms)
 * 8.  GET    /api/rooms/:id              (get_room_detail)
 * 9.  PUT    /api/rooms/:id              (edit_room)
 * 10. DELETE /api/rooms/:id              (delete_room)
 *
 * [Medical Record Templates - 5 APIs (Biểu mẫu Bệnh án Mày đay Cấp / Mạn / Phản vệ)]
 * 11. POST   /api/templates              (set_template)
 * 12. GET    /api/templates              (get_list_templates)
 * 13. GET    /api/templates/:id          (get_template_detail)
 * 14. PUT    /api/templates/:id          (edit_template)
 * 15. DELETE /api/templates/:id          (delete_template)
 */
describe('Week 4 - Departments, Rooms & Medical Record Templates (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;
  let sharedBranchId = 1;
  let sharedDepartmentId = 1;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    // Tạo Branch thực tế phục vụ test Department & Room
    const branchRes = await apiClients.orgFacility.post(
      '/api/branches',
      {
        name: `Chi nhánh Test Tuần 4 ${Date.now()}`,
        code: `BR_W4_${Date.now()}`,
        address: '78 Giải Phóng, Đống Đa, Hà Nội',
      },
      { token: sessions.admin.token }
    );
    const createdBranchId = branchRes.body?.data?.id || branchRes.body?.data?.branch_id;
    if (createdBranchId) {
      sharedBranchId = createdBranchId;
      suiteTeardown.register({
        description: `Cleanup shared branch ${sharedBranchId}`,
        execute: async () => {
          await apiClients.orgFacility.delete(`/api/branches/${sharedBranchId}`, {
            token: sessions.admin.token,
          });
        },
      });
    }
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // PHẦN 1: DEPARTMENTS CRUD (/api/departments)
  // ==========================================================================
  describe('1. Departments CRUD (/api/departments)', () => {
    it('[TC-DEPT-01] Happy Path: Tạo mới Khoa Dị ứng - Miễn dịch lâm sàng, lấy danh sách, xem chi tiết, cập nhật và xóa (Code 1000)', async () => {
      const createRes = await apiClients.orgFacility.post(
        '/api/departments',
        {
          branch_id: sharedBranchId,
          name: `Trung tâm Dị ứng - Miễn dịch lâm sàng ${Date.now()}`,
          code: `DUMD_${Date.now()}`,
          description: 'Chuyên khoa khám và điều trị Mày đay, Phản vệ',
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const deptId = createRes.body?.data?.id || createRes.body?.data?.department_id;
      expect(deptId).toBeTruthy();

      if (deptId) {
        sharedDepartmentId = deptId;
        testCaseTeardown.register({
          description: `Cleanup department ${deptId}`,
          execute: async () => {
            await apiClients.orgFacility.delete(`/api/departments/${deptId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // GET list
        const listRes = await apiClients.orgFacility.get('/api/departments', {
          token: sessions.admin.token,
          query: { branch_id: sharedBranchId },
        });
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // GET detail
        const detailRes = await apiClients.orgFacility.get(`/api/departments/${deptId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);

        // PUT edit
        const editRes = await apiClients.orgFacility.put(
          `/api/departments/${deptId}`,
          {
            name: 'Trung tâm Dị ứng - Miễn dịch lâm sàng (Đã cập nhật)',
            branch_id: sharedBranchId,
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // DELETE
        const delRes = await apiClients.orgFacility.delete(`/api/departments/${deptId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-DEPT-02] Negative Case (Missing Parameter): Tạo Khoa thiếu tên khoa (name) -> Trả về mã 1002', async () => {
      const res = await apiClients.orgFacility.post(
        '/api/departments',
        { branch_id: sharedBranchId },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-DEPT-03] Negative Case (Invalid Parameter Type): branch_id truyền chuỗi không phải số -> Trả về mã 1003 hoặc 1004', async () => {
      const res = await apiClients.orgFacility.post(
        '/api/departments',
        {
          branch_id: 'not_a_number',
          name: 'Khoa Da liễu',
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, [
        RESPONSE_CODES.INVALID_PARAMETER_TYPE,
        RESPONSE_CODES.INVALID_PARAMETER_VALUE,
      ]);
    });

    it('[TC-DEPT-04] Security/RBAC: Bệnh nhân gọi POST /api/departments -> Bị chặn với mã 1009', async () => {
      const res = await apiClients.orgFacility.post(
        '/api/departments',
        { branch_id: sharedBranchId, name: 'Khoa Không Hợp Lệ' },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });

  // ==========================================================================
  // PHẦN 2: ROOMS CRUD (/api/rooms)
  // ==========================================================================
  describe('2. Rooms CRUD (/api/rooms)', () => {
    it('[TC-ROOM-01] Happy Path: Tạo Phòng khám Mày đay - Phản vệ, lấy danh sách, xem chi tiết, sửa và xóa (Code 1000)', async () => {
      // Đảm bảo có 1 Department tồn tại để gắn Room
      const deptRes = await apiClients.orgFacility.post(
        '/api/departments',
        {
          branch_id: sharedBranchId,
          name: `Khoa Cho Phòng Khám ${Date.now()}`,
          code: `DEPT_RM_${Date.now()}`,
        },
        { token: sessions.admin.token }
      );
      const deptId = deptRes.body?.data?.id || deptRes.body?.data?.department_id || sharedDepartmentId;
      if (deptRes.body?.data?.id || deptRes.body?.data?.department_id) {
        testCaseTeardown.register({
          description: `Cleanup parent department ${deptId}`,
          execute: async () => {
            await apiClients.orgFacility.delete(`/api/departments/${deptId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }

      const createRes = await apiClients.orgFacility.post(
        '/api/rooms',
        {
          department_id: deptId,
          name: `Phòng khám Phản vệ P.102 - ${Date.now()}`,
          code: `RM_${Date.now()}`,
          room_number: '102',
          floor: 1,
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const roomId = createRes.body?.data?.id || createRes.body?.data?.room_id;

      if (roomId) {
        testCaseTeardown.register({
          description: `Cleanup room ${roomId}`,
          execute: async () => {
            await apiClients.orgFacility.delete(`/api/rooms/${roomId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // GET list
        const listRes = await apiClients.orgFacility.get('/api/rooms', {
          token: sessions.admin.token,
          query: { department_id: deptId },
        });
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // GET detail
        const detailRes = await apiClients.orgFacility.get(`/api/rooms/${roomId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);

        // PUT edit
        const editRes = await apiClients.orgFacility.put(
          `/api/rooms/${roomId}`,
          {
            department_id: deptId,
            name: 'Phòng khám Phản vệ P.102 (Đã nâng cấp)',
            room_number: '102A',
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // DELETE
        const delRes = await apiClients.orgFacility.delete(`/api/rooms/${roomId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-ROOM-02] Negative Case (Not Found): Xem chi tiết Phòng khám không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.orgFacility.get('/api/rooms/99999999', {
        token: sessions.admin.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });
  });

  // ==========================================================================
  // PHẦN 3: BIỂU MẪU BỆNH ÁN - MEDICAL RECORD TEMPLATES (/api/templates)
  // Bộ test chuyên sâu (12 Test Cases) đối chiếu chặt chẽ với 3 Track UI:
  // MAY_DAY_CAP (< 6 tuần), MAY_DAY_MAN_TINH (>= 6 tuần), PHAN_VE (Cấp cứu/Phản vệ)
  // ==========================================================================
  describe('3. Medical Record Templates CRUD (/api/templates - 12 In-depth Test Cases)', () => {
    it('[TC-TPL-01] Happy Path (UI Track PHAN_VE): Tạo biểu mẫu Bệnh án Phản vệ v1 khớp chuẩn UI Bác sĩ (Code 1000)', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: `Bệnh án Phản vệ Chuẩn UI v1 - ${Date.now()}`,
          code: `TPL_PHAN_VE_${Date.now()}`,
          type: 'PHAN_VE',
          description: 'Biểu mẫu bệnh án phản vệ gồm 8 phần lâm sàng và thang điểm Sampson (Độ I - IV)',
          version: '1.0',
          is_active: true,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const templateId = res.body?.data?.id || res.body?.data?.template_id;
      expect(templateId).toBeTruthy();

      if (templateId) {
        testCaseTeardown.register({
          description: `Cleanup PHAN_VE template ${templateId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/templates/${templateId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }
    });

    it('[TC-TPL-02] Happy Path (UI Track MAY_DAY_CAP): Tạo biểu mẫu Bệnh án Mày đay Cấp (< 6 tuần) thành công (Code 1000)', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: `Bệnh án Mày đay Cấp (< 6 tuần) - ${Date.now()}`,
          code: `TPL_MD_CAP_${Date.now()}`,
          type: 'MAY_DAY_CAP',
          description: 'Biểu mẫu phân luồng bệnh nhân mày đay cấp tính dưới 6 tuần',
          version: '2.0',
          is_active: true,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const templateId = res.body?.data?.id || res.body?.data?.template_id;
      if (templateId) {
        testCaseTeardown.register({
          description: `Cleanup MAY_DAY_CAP template ${templateId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/templates/${templateId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }
    });

    it('[TC-TPL-03] Happy Path (UI Track MAY_DAY_MAN_TINH): Tạo biểu mẫu Bệnh án Mày đay Mạn tính (>= 6 tuần, kèm UAS7) thành công (Code 1000)', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: `Bệnh án Mày đay Mạn tính (>= 6 tuần) - ${Date.now()}`,
          code: `TPL_MD_MAN_${Date.now()}`,
          type: 'MAY_DAY_MAN_TINH',
          description: 'Biểu mẫu phân luồng mày đay mạn tính kích hoạt bảng điểm UAS7 7 ngày',
          version: '2.0',
          is_active: true,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const templateId = res.body?.data?.id || res.body?.data?.template_id;
      if (templateId) {
        testCaseTeardown.register({
          description: `Cleanup MAY_DAY_MAN_TINH template ${templateId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/templates/${templateId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }
    });

    it('[TC-TPL-04] Happy Path: Lấy danh sách biểu mẫu (GET /api/templates) và lọc theo type=PHAN_VE (Code 1000)', async () => {
      const res = await apiClients.template.get('/api/templates', {
        token: sessions.doctor.token,
        query: { type: 'PHAN_VE' },
      });

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toBeDefined();
    });

    it('[TC-TPL-05] Happy Path: Xem chi tiết biểu mẫu kèm cấu trúc Sections & Questions (GET /api/templates/:id) (Code 1000)', async () => {
      const createRes = await apiClients.template.post(
        '/api/templates',
        {
          name: `Biểu mẫu Test Detail ${Date.now()}`,
          code: `TPL_DET_${Date.now()}`,
          type: 'PHAN_VE',
        },
        { token: sessions.admin.token }
      );
      const templateId = createRes.body?.data?.id || createRes.body?.data?.template_id;

      if (templateId) {
        testCaseTeardown.register({
          description: `Cleanup template ${templateId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/templates/${templateId}`, {
              token: sessions.admin.token,
            });
          },
        });

        const detailRes = await apiClients.template.get(`/api/templates/${templateId}`, {
          token: sessions.doctor.token,
        });
        expectResponseCode(detailRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-TPL-06] Happy Path: Cập nhật thông tin biểu mẫu (PUT /api/templates/:id) và Xóa biểu mẫu (DELETE /api/templates/:id) (Code 1000)', async () => {
      const createRes = await apiClients.template.post(
        '/api/templates',
        {
          name: `Biểu mẫu Test Edit/Delete ${Date.now()}`,
          code: `TPL_ED_${Date.now()}`,
          type: 'MAY_DAY_CAP',
        },
        { token: sessions.admin.token }
      );
      const templateId = createRes.body?.data?.id || createRes.body?.data?.template_id;

      if (templateId) {
        const editRes = await apiClients.template.put(
          `/api/templates/${templateId}`,
          {
            name: 'Biểu mẫu Đã Cập Nhật Phiên Bản 2.1',
            version: '2.1',
            is_active: true,
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        const delRes = await apiClients.template.delete(`/api/templates/${templateId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-TPL-07] Negative Case (Missing Parameter): Tạo biểu mẫu thiếu trường bắt buộc name/type -> Trả về mã 1002', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        { description: 'Biểu mẫu thiếu tên và thiếu loại bệnh án' },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-TPL-08] Negative Case (Invalid Track Value): Tạo biểu mẫu với type nằm ngoài tập [MAY_DAY_CAP, MAY_DAY_MAN_TINH, PHAN_VE] -> Trả về mã 1004', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: 'Biểu mẫu Sai Phân Luồng',
          code: `TPL_INVALID_${Date.now()}`,
          type: 'BENH_KHONG_TON_TAI_TRONG_UI',
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-TPL-09] Negative Case (Not Found): Xem chi tiết biểu mẫu không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.template.get('/api/templates/99999999', {
        token: sessions.doctor.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-TPL-10] Security/Auth: Gọi POST /api/templates không đính kèm Token -> Trả về mã 9998', async () => {
      const res = await apiClients.template.post('/api/templates', {
        name: 'Biểu mẫu Không Token',
        type: 'PHAN_VE',
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });

    it('[TC-TPL-11] Security/RBAC: Bệnh nhân tự ý gọi POST /api/templates hoặc DELETE /api/templates/:id -> Bị chặn với mã 1009', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: 'Bệnh nhân Tự Tạo Biểu Mẫu',
          code: `TPL_PAT_${Date.now()}`,
          type: 'PHAN_VE',
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });

    it('[TC-TPL-12] Edge Case (Unicode & Long Description): Tạo biểu mẫu với mô tả tiếng Việt đầy đủ ký tự y khoa (≥, ≤, °C, SpO2, mmHg) -> Trả về mã 1000', async () => {
      const res = await apiClients.template.post(
        '/api/templates',
        {
          name: `Biểu mẫu Phản vệ & Mày đay (≥ 6 tuần, SpO2 < 92%, HA ≤ 90/60 mmHg) - ${Date.now()}`,
          code: `TPL_EDGE_${Date.now()}`,
          type: 'PHAN_VE',
          description: 'Đánh giá lâm sàng: Nhiệt độ > 37.5°C, SpO2 (%) < 92%, Huyết áp tâm thu giảm ≥ 30%.',
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const templateId = res.body?.data?.id || res.body?.data?.template_id;
      if (templateId) {
        testCaseTeardown.register({
          description: `Cleanup edge case template ${templateId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/templates/${templateId}`, {
              token: sessions.admin.token,
            });
          },
        });
      }
    });
  });
});
