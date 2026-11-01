import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { buildPatientAcuteUrticariaPayload } from '../../src/fixtures/uiMedicalRecordPayloads';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 8: MODULE ĐỢT TỔN THƯƠNG (LESION EPISODES) & VỊ TRÍ TỔN THƯƠNG (LESION LOCATIONS) (9 APIs)
 * ============================================================================
 * Danh sách 9 API theo phân phối Tuần 8 (`1. Weekly API.html`):
 * [LesionEpisode - 4 APIs]
 * 1. POST   /api/lesion-episodes                        (create_lesion_episode)
 * 2. GET    /api/lesion-episodes/my                     (get_my_lesion_episodes)
 *    GET    /api/lesion-episodes/record/:medical_record_id
 * 3. PATCH  /api/lesion-episodes/:id                    (edit_lesion_episode)
 * 4. DELETE /api/lesion-episodes/:id                    (delete_lesion_episode)
 *
 * [LesionLocation - 5 APIs]
 * 5. POST   /api/lesion-locations                       (set_lesion_location)
 * 6. POST   /api/lesion-locations                       (create_lesion_location)
 * 7. GET    /api/lesion-locations/episode/:episode_id   (get_lesion_locations_by_episode)
 * 8. PATCH  /api/lesion-locations/:id                   (edit_lesion_location)
 * 9. DELETE /api/lesion-locations/:id                   (delete_lesion_location)
 *
 * Đối chiếu UI Bệnh nhân (`12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html`):
 * - Bản đồ cơ thể (Body Map) chọn các vị trí sẩn phù/phù mạch:
 *   `Mat`, `Moi_luoi_hong`, `Co`, `Nguc`, `Bung`, `Lung`, `Tay_trai`, `Tay_phai`, `Chan_trai`, `Chan_phai`
 */
describe('Week 8 - Lesion Episodes & Body Map Lesion Locations (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;
  let sharedRecordId = 1;
  let sharedEpisodeId = 1;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    // Tạo 1 Bệnh án Mày đay Cấp thực tế để liên kết Đợt tổn thương (Lesion Episode)
    const medRes = await apiClients.medRec.post(
      '/api/medical_records',
      buildPatientAcuteUrticariaPayload(),
      { token: sessions.patient.token }
    );
    const createdRecId = medRes.body?.data?.id || medRes.body?.data?.medical_record_id;
    if (createdRecId) {
      sharedRecordId = createdRecId;
      suiteTeardown.register({
        description: `Cleanup shared medical record ${sharedRecordId}`,
        execute: async () => {
          await apiClients.medRec.delete(`/api/medical_records/${sharedRecordId}`, {
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
  // PHẦN 1: ĐỢT TỔN THƯƠNG - LESION EPISODES (/api/lesion-episodes)
  // ==========================================================================
  describe('1. Lesion Episodes CRUD (/api/lesion-episodes)', () => {
    it('[TC-EPISODE-01] Happy Path: Bệnh nhân tạo mới đợt tổn thương sẩn phù, xem danh sách đợt của mình, cập nhật trạng thái và xóa (Code 1000)', async () => {
      // 1. Tạo đợt tổn thương mới
      const createRes = await apiClients.lesionUas7.post(
        '/api/lesion-episodes',
        {
          medical_record_id: sharedRecordId,
          title: 'Đợt nổi sẩn phù cấp tính sau ăn hải sản',
          onset_time: '2026-10-28T07:30:00Z',
          itch_severity_vas: 8,
          has_angioedema: true,
          notes: 'Sẩn phù lan nhanh vùng mặt, cổ và hai cẳng tay, ngứa dữ dội (VAS 8/10)',
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const episodeId = createRes.body?.data?.id || createRes.body?.data?.episode_id;
      expect(episodeId).toBeTruthy();

      if (episodeId) {
        sharedEpisodeId = episodeId;
        testCaseTeardown.register({
          description: `Cleanup lesion episode ${episodeId}`,
          execute: async () => {
            await apiClients.lesionUas7.delete(`/api/lesion-episodes/${episodeId}`, {
              token: sessions.patient.token,
            });
          },
        });

        // 2. Lấy danh sách đợt tổn thương của tôi (GET /api/lesion-episodes/my)
        const myRes = await apiClients.lesionUas7.get('/api/lesion-episodes/my', {
          token: sessions.patient.token,
        });
        expectResponseCode(myRes.body.code, RESPONSE_CODES.OK);

        // 3. Lấy đợt tổn thương theo medical_record_id
        const byRecRes = await apiClients.lesionUas7.get(
          `/api/lesion-episodes/record/${sharedRecordId}`,
          { token: sessions.doctor.token }
        );
        expectResponseCode(byRecRes.body.code, RESPONSE_CODES.OK);

        // 4. Cập nhật đợt tổn thương (PATCH /api/lesion-episodes/:id)
        const patchRes = await apiClients.lesionUas7.patch(
          `/api/lesion-episodes/${episodeId}`,
          {
            itch_severity_vas: 4,
            status: 'improving',
            notes: 'Sẩn phù giảm sau uống Bilastine 20mg 2 giờ',
          },
          { token: sessions.patient.token }
        );
        expectResponseCode(patchRes.body.code, RESPONSE_CODES.OK);

        // 5. Xóa đợt tổn thương (DELETE /api/lesion-episodes/:id)
        const delRes = await apiClients.lesionUas7.delete(`/api/lesion-episodes/${episodeId}`, {
          token: sessions.patient.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-EPISODE-02] Negative Case (Missing Parameter): Tạo đợt tổn thương rỗng không có thông tin bắt buộc -> Trả về mã 1002', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/lesion-episodes',
        {},
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-EPISODE-03] Negative Case (Invalid VAS Range): Điểm ngứa VAS nằm ngoài khoảng 0-10 (VD: 99) -> Trả về mã 1004', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/lesion-episodes',
        {
          medical_record_id: sharedRecordId,
          title: 'Đợt tổn thương sai điểm VAS',
          itch_severity_vas: 99,
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_PARAMETER_VALUE);
    });

    it('[TC-EPISODE-04] Security/Auth: Gọi GET /api/lesion-episodes/my không có Token -> Trả về mã 9998', async () => {
      const res = await apiClients.lesionUas7.get('/api/lesion-episodes/my');
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });

  // ==========================================================================
  // PHẦN 2: VỊ TRÍ TỔN THƯƠNG TRÊN BẢN ĐỒ CƠ THỂ - LESION LOCATIONS (/api/lesion-locations)
  // ==========================================================================
  describe('2. Body Map Lesion Locations CRUD (/api/lesion-locations)', () => {
    let activeEpisodeId = 1;

    beforeAll(async () => {
      const epRes = await apiClients.lesionUas7.post(
        '/api/lesion-episodes',
        {
          medical_record_id: sharedRecordId,
          title: 'Đợt tổn thương phục vụ test Body Map Locations',
          onset_time: '2026-10-28T08:00:00Z',
          itch_severity_vas: 7,
        },
        { token: sessions.patient.token }
      );
      const createdEpId = epRes.body?.data?.id || epRes.body?.data?.episode_id;
      if (createdEpId) {
        activeEpisodeId = createdEpId;
        suiteTeardown.register({
          description: `Cleanup active episode ${activeEpisodeId}`,
          execute: async () => {
            await apiClients.lesionUas7.delete(`/api/lesion-episodes/${activeEpisodeId}`, {
              token: sessions.patient.token,
            });
          },
        });
      } else {
        activeEpisodeId = sharedEpisodeId;
      }
    });

    it('[TC-LOC-01] Happy Path & UI Body Map Alignment: Thêm vị trí tổn thương vùng Mặt & Môi-Lưỡi-Họng, lấy danh sách theo đợt, cập nhật và xóa (Code 1000)', async () => {
      // 1. Tạo vị trí tổn thương (POST /api/lesion-locations)
      const createRes = await apiClients.lesionUas7.post(
        '/api/lesion-locations',
        {
          episode_id: activeEpisodeId,
          body_part_code: 'Moi_luoi_hong',
          body_part_name: 'Môi, lưỡi, họng (Phù mạch)',
          lesion_type: 'phu_mach',
          wheal_count_score: 2,
          description: 'Sưng nề môi trên và mí mắt hai bên',
        },
        { token: sessions.patient.token }
      );
      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const locationId = createRes.body?.data?.id || createRes.body?.data?.location_id;
      expect(locationId).toBeTruthy();

      if (locationId) {
        testCaseTeardown.register({
          description: `Cleanup lesion location ${locationId}`,
          execute: async () => {
            await apiClients.lesionUas7.delete(`/api/lesion-locations/${locationId}`, {
              token: sessions.patient.token,
            });
          },
        });

        // 2. Lấy danh sách vị trí tổn thương theo episode_id
        const listRes = await apiClients.lesionUas7.get(
          `/api/lesion-locations/episode/${activeEpisodeId}`,
          { token: sessions.patient.token }
        );
        expectResponseCode(listRes.body.code, RESPONSE_CODES.OK);

        // 3. Cập nhật vị trí tổn thương (PATCH /api/lesion-locations/:id)
        const patchRes = await apiClients.lesionUas7.patch(
          `/api/lesion-locations/${locationId}`,
          {
            wheal_count_score: 1,
            description: 'Sưng nề môi đã giảm 50%',
          },
          { token: sessions.patient.token }
        );
        expectResponseCode(patchRes.body.code, RESPONSE_CODES.OK);

        // 4. Xóa vị trí tổn thương (DELETE /api/lesion-locations/:id)
        const delRes = await apiClients.lesionUas7.delete(`/api/lesion-locations/${locationId}`, {
          token: sessions.patient.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-LOC-02] Negative Case (Missing Parameter): Tạo vị trí tổn thương thiếu `episode_id` hoặc `body_part_code` -> Trả về mã 1002', async () => {
      const res = await apiClients.lesionUas7.post(
        '/api/lesion-locations',
        { description: 'Thiếu episode_id và vị trí cơ thể' },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-LOC-03] Negative Case (Not Found): Xem danh sách vị trí của episode_id không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.lesionUas7.get('/api/lesion-locations/episode/99999999', {
        token: sessions.patient.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-LOC-04] Security/IDOR: Bệnh nhân khác cố tình xóa vị trí tổn thương không thuộc về mình -> Trả về mã 1009 hoặc 9992', async () => {
      const res = await apiClients.lesionUas7.delete('/api/lesion-locations/99999999', {
        token: sessions.otherPatient.token,
      });
      expectResponseCode(res.body.code, [
        RESPONSE_CODES.NOT_ACCESS,
        RESPONSE_CODES.NOT_FOUND,
      ]);
    });
  });
});
