import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

/**
 * ============================================================================
 * TUẦN 5: MODULE CHI TIẾT BIỂU MẪU - SECTIONS & QUESTIONS (6 APIs)
 * ============================================================================
 * Danh sách 6 API theo phân phối Tuần 5 (`1. Weekly API.html`):
 * 1. POST   /api/templates/:templateId/sections   (set_template_section)
 * 2. PUT    /api/sections/:id                     (edit_template_section)
 * 3. DELETE /api/sections/:id                     (delete_template_section)
 * 4. POST   /api/sections/:sectionId/questions    (set_template_question)
 * 5. PUT    /api/questions/:id                    (edit_template_question)
 * 6. DELETE /api/questions/:id                    (delete_template_question)
 *
 * Đặc tả UI đối chiếu (`12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html`):
 * - Cấu trúc 8 Section của Bệnh án Phản vệ (Phần I -> Phần VIII).
 * - Ràng buộc câu hỏi điều kiện (Conditional Visibility):
 *   + Câu hỏi cha `trieu_chung_ho_hap_co_khong_pv` ("Có" | "Không")
 *   + Câu hỏi con `trieu_chung_ho_hap_hien_tai_pv` (`parent_question_id`, `show_if_answer: "Có"`)
 * - Ràng buộc câu hỏi cho phép đính kèm ảnh (`allow_image: true`, `trigger_image_upload: true`) cho `anh_san_phu_pv`.
 */
describe('Week 5 - Template Sections & Conditional Questions CRUD (Real API, Zero Mocking)', () => {
  const suiteTeardown = new TeardownRegistry();
  const testCaseTeardown = new TeardownRegistry();
  let sessions: MultiRoleSessions;
  let sharedTemplateId = 1;
  let sharedSectionId = 1;

  beforeAll(async () => {
    sessions = await setupMultiRoleSessions(suiteTeardown);

    // Khởi tạo 1 Template Bệnh án Phản vệ thực tế để gắn Sections & Questions
    const tplRes = await apiClients.template.post(
      '/api/templates',
      {
        name: `Biểu mẫu Phản vệ Tuần 5 ${Date.now()}`,
        code: `TPL_W5_${Date.now()}`,
        type: 'PHAN_VE',
        description: 'Biểu mẫu dùng cho kiểm thử Sections & Conditional Questions',
      },
      { token: sessions.admin.token }
    );
    const createdTplId = tplRes.body?.data?.id || tplRes.body?.data?.template_id;
    if (createdTplId) {
      sharedTemplateId = createdTplId;
      suiteTeardown.register({
        description: `Cleanup shared template ${sharedTemplateId}`,
        execute: async () => {
          await apiClients.template.delete(`/api/templates/${sharedTemplateId}`, {
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
  // PHẦN 1: TEMPLATE SECTIONS CRUD
  // ==========================================================================
  describe('1. Template Sections CRUD (POST /api/templates/:templateId/sections, PUT/DELETE /api/sections/:id)', () => {
    it('[TC-SEC-01] Happy Path: Tạo Section "Phần III — Khám lâm sàng theo hệ cơ quan", cập nhật và xóa thành công (Code 1000)', async () => {
      const createRes = await apiClients.template.post(
        `/api/templates/${sharedTemplateId}/sections`,
        {
          name: 'Phần III — Khám lâm sàng theo hệ cơ quan (Da - Niêm mạc, Hô hấp, Tim mạch, Tiêu hóa, Thần kinh)',
          description: 'Đánh giá triệu chứng theo từng cơ quan để phân độ phản vệ Sampson',
          sort_order: 3,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(createRes.body.code, RESPONSE_CODES.OK);
      const sectionId = createRes.body?.data?.id || createRes.body?.data?.section_id;
      expect(sectionId).toBeTruthy();

      if (sectionId) {
        sharedSectionId = sectionId;
        testCaseTeardown.register({
          description: `Cleanup section ${sectionId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/sections/${sectionId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // PUT edit section
        const editRes = await apiClients.template.put(
          `/api/sections/${sectionId}`,
          {
            name: 'Phần III — Khám lâm sàng chuyên sâu (Cập nhật)',
            sort_order: 3,
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // DELETE section
        const delRes = await apiClients.template.delete(`/api/sections/${sectionId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-SEC-02] Negative Case (Missing Parameter): Tạo Section không truyền trường name -> Trả về mã 1002', async () => {
      const res = await apiClients.template.post(
        `/api/templates/${sharedTemplateId}/sections`,
        { sort_order: 1 },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-SEC-03] Negative Case (Not Found): Tạo Section cho Template ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.template.post(
        '/api/templates/99999999/sections',
        { name: 'Section Mồ Côi', sort_order: 1 },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-SEC-04] Security/RBAC: Bệnh nhân gọi POST tạo Section -> Bị từ chối với mã 1009', async () => {
      const res = await apiClients.template.post(
        `/api/templates/${sharedTemplateId}/sections`,
        { name: 'Section Do Bệnh Nhân Tạo', sort_order: 1 },
        { token: sessions.patient.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });

  // ==========================================================================
  // PHẦN 2: TEMPLATE QUESTIONS CRUD & CONDITIONAL UI LOGIC
  // ==========================================================================
  describe('2. Template Questions CRUD & UI Conditional Logic (POST /api/sections/:sectionId/questions, PUT/DELETE /api/questions/:id)', () => {
    let activeSectionId = 1;

    beforeAll(async () => {
      const secRes = await apiClients.template.post(
        `/api/templates/${sharedTemplateId}/sections`,
        {
          name: 'Phần 3.2 — Hô hấp & Phần II — Dị nguyên nghi ngờ',
          sort_order: 2,
        },
        { token: sessions.admin.token }
      );
      const secId = secRes.body?.data?.id || secRes.body?.data?.section_id;
      if (secId) {
        activeSectionId = secId;
        suiteTeardown.register({
          description: `Cleanup active section ${activeSectionId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/sections/${activeSectionId}`, {
              token: sessions.admin.token,
            });
          },
        });
      } else {
        activeSectionId = sharedSectionId;
      }
    });

    it('[TC-QUES-01] Happy Path & UI Conditional Chain: Tạo câu hỏi cha `trieu_chung_ho_hap_co_khong_pv` và câu hỏi con `trieu_chung_ho_hap_hien_tai_pv` phụ thuộc `show_if_answer: "Có"` (Code 1000)', async () => {
      // 1. Tạo câu hỏi cha: "Có triệu chứng hô hấp không?"
      const parentRes = await apiClients.template.post(
        `/api/sections/${activeSectionId}/questions`,
        {
          question_code: 'trieu_chung_ho_hap_co_khong_pv',
          question_text: 'Bệnh nhân có triệu chứng hô hấp không?',
          question_type: 'single_choice',
          options: ['Có', 'Không'],
          is_required: true,
          sort_order: 1,
        },
        { token: sessions.admin.token }
      );
      expectResponseCode(parentRes.body.code, RESPONSE_CODES.OK);
      const parentId = parentRes.body?.data?.id || parentRes.body?.data?.question_id;

      if (parentId) {
        testCaseTeardown.register({
          description: `Cleanup parent question ${parentId}`,
          execute: async () => {
            await apiClients.template.delete(`/api/questions/${parentId}`, {
              token: sessions.admin.token,
            });
          },
        });

        // 2. Tạo câu hỏi con chỉ hiển thị khi câu hỏi cha chọn "Có"
        const childRes = await apiClients.template.post(
          `/api/sections/${activeSectionId}/questions`,
          {
            question_code: 'trieu_chung_ho_hap_hien_tai_pv',
            question_text: 'Triệu chứng hô hấp hiện tại',
            question_type: 'multiple_choice',
            options: [
              'Ngứa mũi',
              'Hắt hơi',
              'Chảy nước mũi',
              'Nghẹt mũi',
              'Khàn tiếng',
              'Khó thở thanh quản',
              'Thở rít',
              'Khò khè',
              'Khó thở',
              'Tím tái',
              'Ngừng thở',
            ],
            parent_question_id: parentId,
            show_if_answer: 'Có',
            is_required: false,
            sort_order: 2,
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(childRes.body.code, RESPONSE_CODES.OK);
        const childId = childRes.body?.data?.id || childRes.body?.data?.question_id;

        if (childId) {
          testCaseTeardown.register({
            description: `Cleanup child question ${childId}`,
            execute: async () => {
              await apiClients.template.delete(`/api/questions/${childId}`, {
                token: sessions.admin.token,
              });
            },
          });
        }
      }
    });

    it('[TC-QUES-02] Happy Path (Image Upload Trigger Question): Tạo câu hỏi `anh_san_phu_pv` với `allow_image: true` và `trigger_image_upload: true` (Code 1000)', async () => {
      const res = await apiClients.template.post(
        `/api/sections/${activeSectionId}/questions`,
        {
          question_code: 'anh_san_phu_pv',
          question_text: 'Ảnh chụp tổn thương sẩn phù / phù mạch thực tế',
          question_type: 'image_upload',
          allow_image: true,
          trigger_image_upload: true,
          is_required: false,
          sort_order: 3,
        },
        { token: sessions.admin.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const qId = res.body?.data?.id || res.body?.data?.question_id;

      if (qId) {
        // PUT edit question
        const editRes = await apiClients.template.put(
          `/api/questions/${qId}`,
          {
            question_text: 'Ảnh chụp tổn thương sẩn phù / phù mạch (Tối đa 5 ảnh)',
            allow_image: true,
          },
          { token: sessions.admin.token }
        );
        expectResponseCode(editRes.body.code, RESPONSE_CODES.OK);

        // DELETE question
        const delRes = await apiClients.template.delete(`/api/questions/${qId}`, {
          token: sessions.admin.token,
        });
        expectResponseCode(delRes.body.code, RESPONSE_CODES.OK);
      }
    });

    it('[TC-QUES-03] Negative Case (Missing Parameter): Tạo Question thiếu `question_text` hoặc `question_type` -> Trả về mã 1002', async () => {
      const res = await apiClients.template.post(
        `/api/sections/${activeSectionId}/questions`,
        { sort_order: 99 },
        { token: sessions.admin.token }
      );
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-QUES-04] Negative Case (Not Found): Xóa Question ID không tồn tại -> Trả về mã 9992', async () => {
      const res = await apiClients.template.delete('/api/questions/99999999', {
        token: sessions.admin.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_FOUND);
    });

    it('[TC-QUES-05] Security/RBAC: Bệnh nhân gọi DELETE /api/questions/:id -> Bị chặn với mã 1009', async () => {
      const res = await apiClients.template.delete('/api/questions/1', {
        token: sessions.patient.token,
      });
      expectResponseCode(res.body.code, RESPONSE_CODES.NOT_ACCESS);
    });
  });
});
