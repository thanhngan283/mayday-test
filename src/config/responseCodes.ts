/**
 * BỘ MÃ PHẢN HỒI ĐÃ GỘP MỚI NHẤT CỦA HỆ THỐNG DR.MAYDAY (CONSOLIDATED RESPONSE CODES)
 * Nguồn: Tài liệu "3. response code.html" & "TestCaseDesign.md"
 *
 * QUY TẮC BẮT BUỘC:
 * Khi kiểm tra `expect(String(response.body.code)).toBe(...)` hoặc `expectCode(response, ...)`,
 * TUYỆT ĐỐI chỉ sử dụng bộ mã đã gộp dưới đây, KHÔNG dùng các mã phân tán cũ (2001, 3001, 4001...).
 */
export const RESPONSE_CODES = {
  /**
   * 1000: Thành công (OK)
   * Xử lý thành công
   */
  OK: '1000',

  /**
   * 1001: Lỗi mất kết nối DB / thực thi SQL (Can not connect to DB)
   * Gộp từ: 9902
   */
  DB_CONNECTION_ERROR: '1001',

  /**
   * 1002: Lỗi thiếu tham số bắt buộc (Parameter is not enough)
   * Gộp từ: 2001, 4006, 4007, 5005, 6001, 7004, 7005, 8001, 8002, 8101, 8102, 9101
   */
  MISSING_PARAMETER: '1002',

  /**
   * 1003: Lỗi sai kiểu tham số (Parameter type is invalid)
   * Gộp từ: 2002, 2007, 6002
   */
  INVALID_PARAMETER_TYPE: '1003',

  /**
   * 1004: Lỗi giá trị không hợp lệ (Parameter value is invalid)
   * Gộp từ: 2003, 2004, 2005, 2006, 4004, 4009, 5003, 5004, 7006, 7007, 9003
   */
  INVALID_PARAMETER_VALUE: '1004',

  /**
   * 1005: Lỗi không xác định (Unknown error)
   */
  UNKNOWN_ERROR: '1005',

  /**
   * 1006: Cỡ file vượt mức cho phép (File size is too big)
   * Gộp từ: 6003
   */
  FILE_TOO_BIG: '1006',

  /**
   * 1007: Upload file thất bại (Upload File Failed!)
   * Gộp từ: 6007
   */
  UPLOAD_FAILED: '1007',
  UPLOAD_FILE_FAILED: '1007',

  /**
   * 1008: Số lượng images vượt quá quy định (Maximum number of images)
   * Gộp từ: 6004
   */
  MAX_IMAGES_EXCEEDED: '1008',

  /**
   * 1009: Lỗi phân quyền / Truy cập từ chối (Not access / Permission denied)
   * Gộp từ: 3101, 3102, 3103, 3104, 3105, 3106
   */
  PERMISSION_DENIED: '1009',
  NOT_ACCESS: '1009',

  /**
   * 1010: Lỗi hành động đã được thực hiện trước đây (Action has been done previously by this user)
   * Gộp từ: 4003 (Bệnh án đã hoàn thành), 4005 (Bệnh án đã có BS khác tiếp nhận),
   *         4105 (Template đang dùng), 5002 (Đã chấm UAS7 ngày này), 6006 (Ảnh đã liên kết), 8003 (Đã kê đơn)
   */
  ACTION_ALREADY_DONE: '1010',
  ACTION_HAS_BEEN_DONE: '1010',

  /**
   * 9992: Lỗi không tìm thấy đối tượng (Post is not existed / Not found)
   * Gộp từ: 3007, 4001, 4008, 4101, 4103, 4104, 6005, 7001, 7002, 7003, 8103, 9102
   */
  NOT_FOUND: '9992',

  /**
   * 9993: Mã xác thực OTP không đúng hoặc hết hạn (Code verify is incorrect)
   * Gộp từ: 3004, 3005
   */
  VERIFY_CODE_INCORRECT: '9993',

  /**
   * 9994: Không có dữ liệu / Hết dữ liệu (No Data or end of list data)
   * Gộp từ: 4002, 5001
   */
  NO_DATA: '9994',

  /**
   * 9995: Người dùng chưa xác thực / Sai mật khẩu (User is not validated)
   * Gộp từ: 3008, 3009
   */
  USER_NOT_VALIDATED: '9995',
  USER_IS_NOT_VALIDATED: '9995',

  /**
   * 9996: Lỗi dữ liệu đã tồn tại (User existed)
   * Gộp từ: 3006 (Trùng SĐT), 4102 (Trùng mã template)
   */
  ALREADY_EXISTS: '9996',
  USER_EXISTED: '9996',

  /**
   * 9997: Phương thức không hợp lệ (Method is invalid)
   */
  INVALID_METHOD: '9997',

  /**
   * 9998: Lỗi Token (Sai token / Hết hạn / Chưa đăng nhập)
   * Gộp từ: 3001, 3002, 3003
   */
  INVALID_TOKEN: '9998',

  /**
   * 9999: Lỗi hệ thống nội bộ / Exception (Exception error / Internal server error)
   * Gộp từ: 9001, 9002, 9901, 9903
   */
  INTERNAL_ERROR: '9999',
  EXCEPTION_ERROR: '9999',
} as const;

export type ResponseCodeValue = (typeof RESPONSE_CODES)[keyof typeof RESPONSE_CODES];

/**
 * Hàm tiện ích chuẩn hóa giá trị `response.body.code` về dạng chuỗi (vì BE có thể trả về number 1000 hoặc string "1000")
 * nhưng vẫn đảm bảo giá trị đúng tuyệt đối với bộ mã chuẩn hóa.
 */
export function normalizeCode(code: unknown): string {
  return code !== undefined && code !== null ? String(code) : '';
}

export function expectResponseCode(
  actualCode: unknown,
  expectedCode: ResponseCodeValue | readonly ResponseCodeValue[]
): void {
  const normalized = normalizeCode(actualCode);
  if (Array.isArray(expectedCode)) {
    expect(expectedCode).toContain(normalized);
  } else {
    expect(normalized).toBe(expectedCode);
  }
}
