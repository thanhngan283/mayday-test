import { MedicalRecordAnswerInput, TrackClassification } from '../types/medrec.types';

/**
 * Bộ hàm đối chiếu logic nghiệp vụ trên giao diện UI (UI Cross-Reference Validators)
 * Dựa trên 2 tài liệu thiết kế giao diện chính thức:
 * - File App Bệnh nhân: 22_9_Thiet_ke_giao_dien_Benh_nhan_App_v3 / 12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html
 * - File Bệnh án Phản vệ Bác sĩ: 22_9_Thiet_ke_BS_BA_phanve_v1_sua22.9 / 12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html
 */

/**
 * 1. Kiểm tra logic điều hướng (Routing Track):
 * Biến `b1_phan_loai_track` / `b2_phan_loai_track` phụ thuộc vào thời gian kéo dài bệnh (> 6 tuần hay < 6 tuần)
 * và dấu hiệu báo động đỏ phản vệ (`b0_ket_qua_canh_bao`).
 */
export function resolveExpectedTrackFromUI(params: {
  hasRedFlagAnaphylaxis?: boolean;
  isOver6Weeks: boolean;
}): {
  b1_phan_loai_track: TrackClassification;
  expectedTemplatePrefix: string;
} {
  if (params.hasRedFlagAnaphylaxis) {
    return {
      b1_phan_loai_track: 'PHAN_VE',
      expectedTemplatePrefix: 'TMPL_ANAPHYLAXIS',
    };
  }
  if (params.isOver6Weeks) {
    return {
      b1_phan_loai_track: 'MAY_DAY_MAN_TINH',
      expectedTemplatePrefix: 'TMPL_CHRONIC',
    };
  }
  return {
    b1_phan_loai_track: 'MAY_DAY_CAP',
    expectedTemplatePrefix: 'TMPL_ACUTE',
  };
}

/**
 * 2. Kiểm tra logic ẩn/hiện trường có điều kiện (Conditional Visibility) ở Mục 2.2 - Triệu chứng hô hấp:
 * Theo tài liệu Thiết kế BS BA Phản vệ (Mục 2.2):
 * Nếu `trieu_chung_ho_hap_co_khong_pv` === "Không" (hoặc "NO"), thì 3 trường con:
 * - `trieu_chung_ho_hap_hien_tai_pv`
 * - `tien_su_benh_nen_ho_hap_pv`
 * - `dien_bien_ho_hap_pv`
 * KHÔNG ĐƯỢC PHÉP có dữ liệu (phải không gửi lên hoặc rỗng/null).
 */
export const RESPIRATORY_CHILD_FIELDS = [
  'trieu_chung_ho_hap_hien_tai_pv',
  'tien_su_benh_nen_ho_hap_pv',
  'dien_bien_ho_hap_pv',
] as const;

export function validateRespiratoryConditionalRule(answers: MedicalRecordAnswerInput[]): {
  isValid: boolean;
  violatedFields: string[];
} {
  const parentAnswer = answers.find((a) => a.question_id === 'trieu_chung_ho_hap_co_khong_pv');
  if (!parentAnswer) {
    return { isValid: true, irrigated: false, violatedFields: [] } as any;
  }

  const parentVal = String(parentAnswer.answer_text ?? parentAnswer.option_id ?? '').trim().toLowerCase();
  const isNegative = parentVal === 'không' || parentVal === 'no' || parentVal === '0';

  if (!isNegative) {
    return { isValid: true, violatedFields: [] };
  }

  const violatedFields: string[] = [];
  for (const childKey of RESPIRATORY_CHILD_FIELDS) {
    const childAns = answers.find((a) => a.question_id === childKey);
    if (childAns) {
      const hasText = childAns.answer_text !== undefined && childAns.answer_text !== null && childAns.answer_text !== '';
      const hasOption = childAns.question_option_id !== undefined && childAns.question_option_id !== null;
      const hasValue =
        childAns.answer_value !== undefined &&
        childAns.answer_value !== null &&
        (Array.isArray(childAns.answer_value)
          ? childAns.answer_value.length > 0
          : Object.keys(childAns.answer_value).length > 0);

      if (hasText || hasOption || hasValue) {
        violatedFields.push(childKey);
      }
    }
  }

  return {
    isValid: violatedFields.length === 0,
    violatedFields,
  };
}

/**
 * 3. Kiểm tra logic bóc tách dữ liệu phức tạp ở Mục 3 - Định hướng căn nguyên (Thức ăn):
 * Khi `yeu_to_nghi_ngo_pv_thuc_an` = "Có", bắt buộc phải đi kèm thông tin tên dị nguyên thức ăn
 * và `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an` (số dương, tính bằng phút/giờ) + `tien_su_phan_ung_yeu_to_pv_thuc_an`.
 * Nếu `yeu_to_nghi_ngo_pv_thuc_an` = "Không", trường phụ `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an` phải ẩn/rỗng.
 */
export function validateSuspectedFoodAllergenStructure(answers: MedicalRecordAnswerInput[]): {
  isValid: boolean;
  reason?: string;
} {
  const foodSuspect = answers.find((a) => a.question_id === 'yeu_to_nghi_ngo_pv_thuc_an');
  const exposureTime = answers.find((a) => a.question_id === 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an');

  if (!foodSuspect) return { isValid: true };

  const isPositive =
    foodSuspect.answer_text?.toLowerCase().startsWith('có') ||
    (foodSuspect.answer_value as any)?.status === 'Có';

  if (!isPositive && exposureTime && exposureTime.answer_text) {
    return {
      isValid: false,
      reason: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an must be empty when yeu_to_nghi_ngo_pv_thuc_an is Không',
    };
  }

  if (isPositive && exposureTime) {
    const numericVal = Number(exposureTime.answer_text ?? (exposureTime.answer_value as any)?.value);
    if (Number.isNaN(numericVal) || numericVal < 0) {
      return {
        isValid: false,
        reason: 'thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an must be a non-negative number',
      };
    }
  }

  return { isValid: true };
}
