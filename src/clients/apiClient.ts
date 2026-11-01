import request, { Response, Test } from 'supertest';
import { ENV, getBaseUrl, ServiceModule } from '../config/env';

/**
 * Real API Client sử dụng Supertest kết nối trực tiếp tới hệ thống Backend thực tế.
 * TUYỆT ĐỐI KHÔNG sử dụng bất kỳ thư viện mocking nào (Zero Mocking).
 * Hỗ trợ Dynamic Base URL cho từng phân hệ và ghi log chi tiết phục vụ báo cáo HTML.
 */
export class RealApiClient {
  private readonly baseUrl: string;
  private readonly serviceName: ServiceModule;

  constructor(service: ServiceModule = 'DEFAULT') {
    this.serviceName = service;
    this.baseUrl = getBaseUrl(service);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private applyCommonHeaders(req: Test, token?: string, customHeaders?: Record<string, string>): Test {
    req.set('Accept', 'application/json');
    if (token !== undefined) {
      // Cho phép truyền chuỗi rỗng hoặc token sai format để test kịch bản 9998
      const authHeader = token.startsWith('Bearer ') || token === '' ? token : `Bearer ${token}`;
      if (authHeader !== '') {
        req.set('Authorization', authHeader);
      }
    }
    if (customHeaders) {
      for (const [key, value] of Object.entries(customHeaders)) {
        req.set(key, value);
      }
    }
    req.timeout({ response: ENV.API_TIMEOUT_MS, deadline: ENV.API_TIMEOUT_MS + 5000 });
    return req;
  }

  private logExchange(method: string, endpoint: string, payload: unknown, res: Response): void {
    if (!ENV.ENABLE_HTTP_TRACE) return;
    const summary = {
      service: this.serviceName,
      request: `${method.toUpperCase()} ${this.baseUrl}${endpoint}`,
      requestPayload: payload ?? null,
      httpStatus: res.status,
      responseBody: res.body,
    };
    // console.info được jest-html-reporters thu thập vào mục Console Log của từng Test Case
    console.info(`[API TRACE] ${JSON.stringify(summary)}`);
  }

  public async get(
    endpoint: string,
    options?: { token?: string; query?: Record<string, any>; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).get(endpoint);
    this.applyCommonHeaders(req, options?.token, options?.headers);
    if (options?.query) {
      req.query(options.query);
    }
    const res = await req;
    this.logExchange('GET', endpoint, options?.query, res);
    return res;
  }

  public async post(
    endpoint: string,
    body?: string | Record<string, any>,
    options?: { token?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).post(endpoint);
    if (typeof body === 'string') {
      // Phục vụ test case gửi malformed JSON string để kiểm tra mã lỗi 1003
      req.set('Content-Type', 'application/json');
    }
    this.applyCommonHeaders(req, options?.token, options?.headers);
    const res = body !== undefined ? await req.send(body) : await req.send({});
    this.logExchange('POST', endpoint, body, res);
    return res;
  }

  public async put(
    endpoint: string,
    body?: string | Record<string, any>,
    options?: { token?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).put(endpoint);
    if (typeof body === 'string') {
      req.set('Content-Type', 'application/json');
    }
    this.applyCommonHeaders(req, options?.token, options?.headers);
    const res = body !== undefined ? await req.send(body) : await req.send({});
    this.logExchange('PUT', endpoint, body, res);
    return res;
  }

  public async patch(
    endpoint: string,
    body?: string | Record<string, any>,
    options?: { token?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).patch(endpoint);
    if (typeof body === 'string') {
      req.set('Content-Type', 'application/json');
    }
    this.applyCommonHeaders(req, options?.token, options?.headers);
    const res = body !== undefined ? await req.send(body) : await req.send({});
    this.logExchange('PATCH', endpoint, body, res);
    return res;
  }

  public raw() {
    return request(this.baseUrl);
  }

  public async uploadFile(
    endpoint: string,
    fieldName: string,
    fileBuffer: Buffer,
    filename: string,
    fields?: Record<string, any>,
    options?: { token?: string; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).post(endpoint);
    this.applyCommonHeaders(req, options?.token, options?.headers);
    if (fields) {
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined && val !== null) {
          req.field(key, String(val));
        }
      }
    }
    req.attach(fieldName, fileBuffer, { filename, contentType: 'image/png' });
    const res = await req;
    this.logExchange('POST [MULTIPART]', endpoint, { filename, fields }, res);
    return res;
  }

  public async delete(
    endpoint: string,
    options?: { token?: string; body?: Record<string, any>; headers?: Record<string, string> }
  ): Promise<Response> {
    const req = request(this.baseUrl).delete(endpoint);
    this.applyCommonHeaders(req, options?.token, options?.headers);
    const res = options?.body ? await req.send(options.body) : await req;
    this.logExchange('DELETE', endpoint, options?.body, res);
    return res;
  }
}

export const apiClients = {
  auth: new RealApiClient('AUTH'),
  userRole: new RealApiClient('USER_ROLE'),
  orgPermission: new RealApiClient('ORG_PERMISSION'),
  orgFacility: new RealApiClient('ORG_PERMISSION'),
  template: new RealApiClient('TEMPLATE'),
  medrec: new RealApiClient('MEDREC'),
  medRec: new RealApiClient('MEDREC'),
  lesion: new RealApiClient('LESION'),
  imageUas7: new RealApiClient('IMAGE_UAS7'),
  lesionUas7: new RealApiClient('IMAGE_UAS7'),
  prescriptionLabNoti: new RealApiClient('PRESCRIPTION_LAB_NOTI'),
  clinicalNotify: new RealApiClient('PRESCRIPTION_LAB_NOTI'),
  ai: new RealApiClient('AI_SERVICE'),
};
