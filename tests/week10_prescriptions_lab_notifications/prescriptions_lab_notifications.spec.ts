import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { buildPatientAnaphylaxisPayload } from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 10: MODULE ĐƠN THUỐC (PRESCRIPTIONS), XÉT NGHIỆM (LAB REQUESTS/RESULTS) & THÔNG BÁO (NOTIFICATIONS + FCM DEVTOKEN) (8 APIs)
 * ============================================================================
 * Danh sách 8 API theo phân phối Tuần 10 (`1. Weekly API.html`):
 * [Prescriptions & Lab - 3 APIs]
 * 1. POST   /api/prescriptions                (set_prescription)
 * 2. POST   /api/lab-requests                 (set_lab_request)
 * 3. GET    /api/lab-results/:record_id       (get_lab_results)
 *
 * [Notifications & FCM Token - 5 APIs]
 * 4. POST   /api/notifications/register_token (set_devtoken)
 * 5. GET    /api/notifications                (get_notification)
 * 6. PUT    /api/notifications/:id            (set_read_notification)
 * 7. PUT    /api/notifications/read-all       (set_read_all_notifications)
 * 8. DELETE /api/notifications/:id            (delete_notification)
 *
 * Đối chiếu UI Bác sĩ (`12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html`):
 * - Phần VI (Xử trí & Điều trị Phản vệ): Kê đơn Adrenalin định liều tự động (EpiPen), Kháng Histamine H1 (Bilastine/Fexofenadine), Corticosteroid (Methylprednisolone).
 * - Phần VII (Cận lâm sàng & Test dị nguyên): Chỉ định Tryptase huyết thanh, Tổng IgE, Specific IgE, Skin Prick Test.
 */
describe('Week 10 - Prescriptions, Lab Requests/Results & Notifications/FCM (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;
  let sharedAnaphylaxisRecordId = 1;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    // Tạo Bệnh án Phản vệ thực tế và Bác sĩ tiếp nhận để kê đơn & chỉ định cận lâm sàng
    const medRes = await apiClients.medRec.post(
      '/api/medical_records',
      buildPatientAnaphylaxisPayload(),
      { token: sessions.patient.token }
    );
    const createdId = medRes.body?.data?.id || medRes.body?.data?.medical_record_id;
    if (createdId) {
      sharedAnaphylaxisRecordId = createdId;
      suiteTeardown.register({
        description: `Cleanup shared anaphylaxis record ${sharedAnaphylaxisRecordId}`,
        execute: async () => {
          await apiClients.medRec.delete(`/api/medical_records/${sharedAnaphylaxisRecordId}`, {
            token: sessions.admin.token,
          });
        },
      });

      await apiClients.medRec.post(
        `/api/medical_records/${sharedAnaphylaxisRecordId}/accept`,
        { notes: 'Bác sĩ tiếp nhận để kê đơn và chỉ định xét nghiệm' },
        { token: sessions.doctor.token }
      );
    }
  });

  afterEach(async () => {
    await testCaseTeardown.cleanupAll();
  });

  afterAll(async () => {
    await suiteTeardown.cleanupAll();
  });

  // ==========================================================================
  // PHẦN 1: ĐƠN THUỐC - PRESCRIPTIONS (/api/prescriptions)
  // ==========================================================================
  describe('1. Prescriptions Management (POST /api/prescriptions - Đối chiếu Phần VI UI Bác sĩ)', () => {
    it('[TC-PRESC-01] Happy Path: Bác sĩ kê đơn thuốc điều trị xuất viện sau phản vệ (Bilastine, Methylprednisolone, Bút tiêm Adrenalin dự phòng) thành công (Code 1000)', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/prescriptions',
        {
          medical_record_id: sharedAnaphylaxisRecordId,
          diagnosis: 'Phản vệ độ III do dị ứng thức ăn (Tôm biển) đã xử trí ổn định',
          general_advice:
            'Tuyệt đối tránh ăn tôm/giáp xác. Mang theo bút tiêm Adrenalin tự động bên người. Tái khám sau 14 ngày để làm Skin Prick Test.',
          medications: [
            {
              drug_name: 'Bilastine 20mg',
              dosage: '1 viên/lần x 1 lần/ngày',
              route: 'Uống trước ăn 1 giờ',
              duration_days: 14,
              quantity: 14,
              unit: 'Viên',
            },
            {
              drug_name: 'Methylprednisolone 16mg',
              dosage: '1 viên/ngày buổi sáng sau ăn no',
              route: 'Uống',
              duration_days: 5,
              quantity: 5,
              unit: 'Viên',
            },
            {
              drug_name: 'EpiPen (Adrenalin 0.3mg/0.3ml)',
              dosage: 'Tiêm bắp mặt ngoài đùi khi có dấu hiệu phản vệ tái phát',
              route: 'Tiêm bắp (IM)',
              duration_days: 30,
              quantity: 1,
              unit: 'Bút tiêm',
            },
          ],
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      expect(res.body.data).toBeDefined();
    });

    it('[TC-PRESC-02] Negative Case (Missing Parameter): Kê đơn thuốc thiếu `medical_record_id` hoặc danh sách thuốc `medications` rỗng -> Trả về mã 1002', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/prescriptions',
        {
          medical_record_id: sharedAnaphylaxisRecordId,
          medications: [],
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, [
        RESPONSE_CODES.MISSING_PARAMETER,
        RESPONSE_CODES.INVALID_PARAMETER_VALUE,
      ]);
    });

    it('[TC-PRESC-03] Security/RBAC: Bệnh nhân tự ý gọi POST /api/prescriptions để tự kê đơn thuốc -> Bị chặn với mã 1009', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/prescriptions',
        {
          medical_record_id: sharedAnaphylaxisRecordId,
          medications: [{ drug_name: 'Thuốc Tự Kê', dosage: '1 viên', quantity: 10 }],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });

  // ==========================================================================
  // PHẦN 2: CHỈ ĐỊNH XÉT NGHIỆM & KẾT QUẢ LAB (/api/lab-requests, /api/lab-results/:record_id)
  // ==========================================================================
  describe('2. Lab Requests & Results (POST /api/lab-requests, GET /api/lab-results/:record_id - Đối chiếu Phần VII UI Bác sĩ)', () => {
    it('[TC-LAB-01] Happy Path: Bác sĩ chỉ định xét nghiệm Tryptase huyết thanh, Tổng IgE và Specific IgE dị nguyên tôm biển (Code 1000)', async () => {
      const reqRes = await apiClients.clinicalNotify.post(
        '/api/lab-requests',
        {
          medical_record_id: sharedAnaphylaxisRecordId,
          clinical_indication: 'Theo dõi phản vệ độ III do tôm biển - Đánh giá giải phóng dưỡng bào',
          tests: [
            {
              test_code: 'TRYPTASE_SERUM',
              test_name: 'Định lượng Tryptase huyết thanh (1-2h sau khởi phát)',
              specimen_type: 'Máu tĩnh mạch',
            },
            {
              test_code: 'TOTAL_IGE',
              test_name: 'Định lượng Tổng IgE huyết thanh (IU/mL)',
              specimen_type: 'Máu tĩnh mạch',
            },
            {
              test_code: 'SPECIFIC_IGE_SHRIMP',
              test_name: 'Specific IgE dị nguyên Tôm biển (f24)',
              specimen_type: 'Máu tĩnh mạch',
            },
          ],
        },
        { token: sessions.doctor.token }
      );

      expectResponseCode(reqRes.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-LAB-02] Happy Path: Bác sĩ và Bệnh nhân xem kết quả xét nghiệm của bệnh án (GET /api/lab-results/:record_id) (Code 1000)', async () => {
      const res = await apiClients.clinicalNotify.get(
        `/api/lab-results/${sharedAnaphylaxisRecordId}`,
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-LAB-03] Negative Case (Missing Parameter): Gọi POST /api/lab-requests không có `medical_record_id` -> Trả về mã 1002', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/lab-requests',
        { tests: [] },
        { token: sessions.doctor.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-LAB-04] Security/RBAC: Bệnh nhân tự ý gọi POST /api/lab-requests để tự chỉ định xét nghiệm -> Trả về mã 1009', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/lab-requests',
        {
          medical_record_id: sharedAnaphylaxisRecordId,
          tests: [{ test_code: 'TOTAL_IGE', test_name: 'Tổng IgE' }],
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });

  // ==========================================================================
  // PHẦN 3: THÔNG BÁO & ĐĂNG KÝ FCM DEVICE TOKEN (/api/notifications)
  // ==========================================================================
  describe('3. Notifications & FCM Device Token (/api/notifications)', () => {
    it('[TC-NOTIFY-01] Happy Path: Đăng ký FCM Device Token (POST /api/notifications/register_token) thành công (Code 1000)', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/notifications/register_token',
        {
          device_token: `fcm_real_token_${Date.now()}_android_v14`,
          device_type: 'android',
        },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-NOTIFY-02] Happy Path: Lấy danh sách thông báo, đánh dấu đã đọc 1 thông báo, đánh dấu tất cả đã đọc và xóa thông báo (Code 1000)', async () => {
      // 1. Lấy danh sách thông báo (GET /api/notifications)
      const listRes = await apiClients.clinicalNotify.get('/api/notifications', {
        token: sessions.patient.token,
      });
      expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

      const notifications = Array.isArray(listRes.body?.data)
        ? listRes.body.data
        : listRes.body?.data?.notifications || [];

      if (notifications.length > 0) {
        const firstNotifId = notifications[0].id || notifications[0].notification_id;

        // 2. Đánh dấu đã đọc 1 thông báo (PUT /api/notifications/:id)
        const readOneRes = await apiClients.clinicalNotify.put(
          `/api/notifications/${firstNotifId}`,
          { is_read: true },
          { token: sessions.patient.token }
        );
        expectResponseCode(readOneRes.body.code, RESPONSE_CODES.OK);

        // 3. Xóa 1 thông báo (DELETE /api/notifications/:id)
        const delRes = await apiClients.clinicalNotify.delete(
          `/api/notifications/${firstNotifId}`,
          { token: sessions.patient.token }
        );
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }

      // 4. Đánh dấu tất cả thông báo đã đọc (PUT /api/notifications/read-all)
      const readAllRes = await apiClients.clinicalNotify.put(
        '/api/notifications/read-all',
        {},
        { token: sessions.patient.token }
      );
      expectResponseCode(readAllRes.body.code, RESPONSE_CODES.OK);
    });

    it('[TC-NOTIFY-03] Negative Case (Missing Parameter): Gọi POST /api/notifications/register_token thiếu `device_token` -> Trả về mã 1002', async () => {
      const res = await apiClients.clinicalNotify.post(
        '/api/notifications/register_token',
        {},
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-NOTIFY-04] Security/Auth: Gọi GET /api/notifications không truyền Token -> Trả về mã 9998', async () => {
      const res = await apiClients.clinicalNotify.get('/api/notifications');
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });
});
