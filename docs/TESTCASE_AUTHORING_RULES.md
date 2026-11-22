# Dr.Mayday API Automation Testing — Rules & Standards for Agents

> **Purpose:** This document defines the **mandatory rules, coding patterns, response code contracts, and domain constraints** for writing new Black-box Real API Automation Test cases in this repository (`D:\doAnWork`). Any AI agent or QA engineer authoring new `.spec.ts` files MUST follow every rule in this document.

---

## 1. Role, Scope & Strict Workspace Boundaries

1. **Role:** Senior QA Automation Engineer writing **Black-box Real API Automation Tests** using **TypeScript, Jest, and Supertest**.
2. **Do NOT touch application or DB code:** Never write or modify Backend code (Node.js/NestJS/Spring Boot), Frontend code, SQL schemas, migrations, or seed scripts.
3. **Strict Folder Separation:**
   * `D:\doAn` = **Read-only specification & documentation folder** (API specs, UI designs, `Bảng mã lỗi.html`, DB docs). **NEVER create or edit files inside `D:\doAn`.**
   * `D:\doAnWork` = **Work output folder** where all test code, fixtures, utilities, configs, and test documentation live.

---

## 2. Core Engineering Principles (Non-Negotiable)

### 2.1. Real API Testing (Zero Mocking)
* Every test MUST send real HTTP requests to a live Backend server.
* **STRICTLY FORBIDDEN:** `nock`, `msw`, `jest.mock`, stubbed HTTP responses, or fake in-memory adapters.
* Always use the shared `apiClients` exported from [src/clients/apiClient.ts](../src/clients/apiClient.ts):
  * `apiClients.auth` (`AUTH_BASE_URL`)
  * `apiClients.userRole` (`USER_ROLE_BASE_URL`)
  * `apiClients.orgPermission` (`ORG_PERMISSION_BASE_URL`)
  * `apiClients.template` (`TEMPLATE_BASE_URL`)
  * `apiClients.medrec` (`MEDREC_BASE_URL`)
  * `apiClients.lesion` (`LESION_BASE_URL`)
  * `apiClients.imageUas7` (`IMAGE_UAS7_BASE_URL`)
  * `apiClients.prescriptionLabNoti` (`PRESCRIPTION_LAB_NOTI_BASE_URL`)
  * `apiClients.ai` (`AI_SERVICE_BASE_URL`)
* **Never hardcode URLs or ports** (e.g., `http://localhost:3000`). All URLs are dynamically resolved via `src/config/env.ts` from `.env`.
* **HTTP Tracing:** Because `RealApiClient` automatically logs `[API TRACE]` (method, URL, payload, `httpStatus`, raw `responseBody`) on every call when `ENABLE_HTTP_TRACE=true`, avoid bypassing `apiClients` methods with `.raw()` unless strictly required for multi-file multipart uploads.

### 2.2. State Management (Real API Setup & LIFO Teardown)
* **Setup (`beforeAll` / `beforeEach`):** Obtain live JWT tokens via `setupMultiRoleSessions(suiteTeardown)` from [src/utils/authHelper.ts](../src/utils/authHelper.ts) (which logs in `admin`, `doctor`, `secondDoctor` and dynamically creates/logs in `patient` and `otherPatient` for IDOR testing).
* **Teardown (`afterEach` / `afterAll`):**
  * Maintain two registries per suite: `const suiteTeardown = new TeardownRegistry();` and `const testCaseTeardown = new TeardownRegistry();`.
  * **Immediately** after any test creates a persistent DB entity (user, medical record, template, section, question, branch, department, room, lesion episode/location/photo, image, notification), register its cleanup via `testCaseTeardown.register*(id, token)` (or `suiteTeardown` for suite-scoped data).
  * `TeardownRegistry.cleanupAll()` executes deletions in **LIFO (Last-In-First-Out)** order to respect foreign-key constraints and leave the Database clean.
* **Unique Test Data:** Always generate unique phones via `generateValidVnPhone('09')` and append `Date.now()` to unique codes/names so repeated runs never collide with stale data.

---

## 3. Folder Structure & Naming Conventions

### 3.1. 10-Week Module Structure (`tests/`)
Place every new test file in its matching weekly folder (aligned with `1. Weekly API.html`):

| Folder (`D:\doAnWork\tests\`) | Scope / APIs |
| :--- | :--- |
| `week1_auth/` | `signup`, `login`, `logout`, `forgot_password`, `reset_password`, `create_staff` |
| `week2_users_roles/` | `profile` (GET/PUT), `admin/users` CRUD, `roles` |
| `week3_permissions_branches/` | `permissions`, `role_permissions`, `branches` CRUD |
| `week4_departments_rooms_templates/` | `departments`, `rooms`, `templates` CRUD |
| `week5_template_details/` | `template sections` & `template questions` CRUD |
| `week6_medrec_create_read/` | `classify-questions`, `classify`, `selfcreate`, `all`, `detail`, `summary`, `accept` |
| `week7_medrec_process_manage/` | `answers` (GET/POST/PUT), `edit`, `status`, `history`, `delete` |
| `week8_lesion_episodes_locations/` | `lesion-episodes`, `lesion-locations` |
| `week9_images_uas7/` | `lesion-photos`, `image-attachments`, `answer-images`, `uas7-scores` |
| `week10_prescriptions_lab_notifications/` | `prescriptions`, `lab-requests`, `lab-results`, `notifications`, `register_token` |
| `advanced_scenarios/` | Cross-cutting Concurrency/Race Condition, Token Blacklist, Auto-Calculated & UI Conditional rules |

### 3.2. Test File & Case Naming Rules
* **File suffix:** Always `*.spec.ts`.
* **Grouping:** One top-level `describe('Week X - <Module> (Real API, Zero Mocking)', ...)` and one nested `describe('<N>. <METHOD> <ENDPOINT> (<Vietnamese Summary>)', ...)` per API endpoint.
* **Test Case ID format:** Every `it(...)` MUST start with a unique tag and state category + expected code:
  ```ts
  it('[TC-<MODULE>-01] Happy Path: <Mô tả ngắn gọn> (Code 1000)', async () => { ... });
  it('[TC-<MODULE>-02] Negative Case (Missing Param): <Mô tả> -> Trả về mã 1002', async () => { ... });
  it('[TC-<MODULE>-03] Security/RBAC: <Mô tả> -> Trả về mã 1009', async () => { ... });
  ```

---

## 4. Mandatory Test Coverage Matrix (10–15 Cases per Core API)

Every core API endpoint MUST cover all **4 standard groups** (plus Clinical UI / Advanced rules where applicable):

1. **Happy Path (`1000`):** Valid full payload, valid minimal payload (optional fields omitted), valid filtering/pagination.
2. **Negative / Validation Cases:**
   * Missing required fields or empty lists (`1002`)
   * Wrong data types (string instead of number/array) or malformed JSON string (`1003`)
   * Invalid values: out-of-range scores (UAS7 `0..3`, VAS `0..10`, SpO2 `0..100`), invalid VN phone prefix (`03/05/07/08/09`), invalid date `YYYY-MM-DD`, invalid enum (`1004`)
   * Non-existent ID (`9992`)
   * Duplicate unique resource (`9996`)
   * Repeated one-time action / modifying completed record (`1010`)
3. **Security, Authorization & IDOR:**
   * Missing `Authorization` header, malformed JWT, expired/logged-out JWT (`9998`)
   * Role violation / RBAC (Patient calling Doctor/Admin API, Doctor calling Admin API) (`1009`)
   * IDOR: `sessions.otherPatient` attempting to view/edit/delete `sessions.patient`'s record (`1009` or `9992`)
   * Privilege escalation (e.g., passing `role_id: 1` during public `signup`)
4. **Edge Cases:**
   * Boundary numeric values (`0`, max limit, huge `page=99999`)
   * Vietnamese Unicode & medical symbols (`≥`, `≤`, `°C`, `IU/mL`, `mmHg`)
   * SQL Injection / XSS strings in search/text fields (must NOT return HTTP 500 / `9999`)

---

## 5. Mandatory UI & Clinical Domain Cross-Referencing Rules

When writing tests for Medical Records, Templates, Answers, Lesions, or UAS7, cross-check against `12_9_Thiet_ke_giao_dien_Bac_si_BA_phanve_v1.html` and `12_9_Thiet_ke_giao_dien_Benh_nhan_App_v2_khop.html`:

1. **Classification / Routing Tracks (`b1_phan_loai_track` / `b2_phan_loai_track`):**
   * Red-flag symptoms (dyspnea, stridor, tongue/throat swelling, hypotension, syncope) $\rightarrow$ **`PHAN_VE`**
   * Wheals/angioedema duration **$< 6$ weeks** (no red flags) $\rightarrow$ **`MAY_DAY_CAP`**
   * Wheals/angioedema duration **$\ge 6$ weeks** (no red flags) $\rightarrow$ **`MAY_DAY_MAN_TINH`** *(unlocks UAS7 scoring)*
   * Contradictory routing payloads (e.g., `< 6 weeks` forcing `MAY_DAY_MAN_TINH`) MUST be tested for rejection (`1004`) or server override.
2. **Conditional Visibility (Parent–Child UI Fields):**
   * Example: When `trieu_chung_ho_hap_co_khong_pv = "Không"`, child fields (`trieu_chung_ho_hap_hien_tai_pv`, `tien_su_benh_nen_ho_hap_pv`, `dien_bien_ho_hap_pv`) are hidden on UI and MUST NOT contain data.
   * Test BOTH:
     * Positive: parent `"Không"` with no child fields (`1000`); parent `"Có"` with child fields (`1000`).
     * Negative: parent `"Không"` while still sending child fields $\rightarrow$ expect BE to reject (`1004`) OR accept (`1000`) and automatically nullify/strip the child fields.
3. **Complex Paired Fields & Image Arrays:**
   * Suspected trigger groups: `yeu_to_nghi_ngo_pv_thuc_an` paired with `thoi_gian_tiep_xuc_khoi_phat_pv_thuc_an` and `tien_su_phan_ung_yeu_to_pv_thuc_an`.
   * Clinical photo arrays: `anh_san_phu` / `anh_san_phu_pv`.
4. **Read-Only & Auto-Calculated Fields (Tamper Resistance):**
   * Never trust client-supplied computed values. Explicitly send forged values for system-calculated fields (`nlr`, `plr`, `uas7_tong`, `aas7_tong`) alongside valid raw inputs (`neutrophils`, `lymphocytes`, `platelets`, `wheal_score`, `itch_score`).
   * Expect BE to **ignore** the forged values and compute the real values server-side (e.g., `expect(Number(res.body.data.nlr)).not.toBe(9999.9)` and `uas7_tong <= 42`).

---

## 6. Advanced Scenario Rules

### 6.1. Concurrency / Race Condition (`Promise.all`)
* Use `Promise.all([req1, req2, ...])` to fire **2 or 3 identical requests at the exact same millisecond** targeting a unique constraint (`bhyt_so_the`, `phone`, `template_code`, or 2 doctors calling `accept` on the same medical record).
* **Do NOT assert by index** (`res1 === "1000"` and `res2 === "9996"`), because race winners are non-deterministic!
* **Always count across the array of normalized codes:**
  ```ts
  const codes = [normalizeCode(res1.body.code), normalizeCode(res2.body.code)];
  expect(codes.filter((c) => c === RESPONSE_CODES.OK)).toHaveLength(1);
  expect(codes.filter((c) => c === RESPONSE_CODES.ALREADY_EXISTS)).toHaveLength(1); // or ACTION_ALREADY_DONE for doctor accept
  ```
* Register cleanup for whichever response(s) returned a created ID.

### 6.2. Token Lifecycle & Blacklist
Always verify all 4 steps to prevent both security leaks and false positives:
1. **Login:** `POST /api/auth/login` $\rightarrow$ extract `tokenA` (`1000`).
2. **Anti-False-Positive Check:** Call a protected endpoint (`GET /api/profile`) **3 consecutive times** (and/or 3 concurrent calls) with `tokenA` $\rightarrow$ ALL must return `1000`.
3. **Revoke:** Call `POST /api/auth/logout` with `tokenA` $\rightarrow$ returns `1000`.
4. **Barrier Validation:** Call protected endpoints again with `tokenA` $\rightarrow$ MUST be blocked with `9998`.

---

## 7. Consolidated Response Code Contract (STRICT)

**NEVER assert legacy codes (`2001`, `3001`, `4001`, `5001`, `6001`, `7001`, `8001`, `9001`, `9901`, etc.) and NEVER hardcode code literals.**  
Always assert via `expectResponseCode(res.body.code, RESPONSE_CODES.<KEY>)` from [src/config/responseCodes.ts](../src/config/responseCodes.ts), strictly aligned with `D:\doAn\response_code\Bảng mã lỗi.html`:

| Code | Constant (`RESPONSE_CODES.*`) | HTTP Hint | Exact Scenarios to Assert |
| :---: | :--- | :---: | :--- |
| **`1000`** | `OK` | 200 | Success for Read, Create, Update, Delete |
| **`1001`** | `DB_CONNECTION_ERROR` | 500 | DB connection / SQL error *(no normal test case; never expect on success)* |
| **`1002`** | `MISSING_PARAMETER` | 400 | Missing required field, empty list (`answers: []`, `medications: []`), **missing upload file**, missing name |
| **`1003`** | `INVALID_PARAMETER_TYPE` | 400 | Wrong data type, malformed JSON body, unsupported upload file format |
| **`1004`** | `INVALID_PARAMETER_VALUE` | 400 | Invalid length, enum, date/phone format, out-of-range value, invalid status transition, UI conditional violation |
| **`1005`** | `UNKNOWN_ERROR` | 500 | Unknown server error *(no normal test case)* |
| **`1006`** | `FILE_TOO_BIG` | 413 | Uploaded image file exceeds 10 MB |
| **`1007`** | `UPLOAD_FAILED` | 502 | Object storage (MinIO) error during upload *(do NOT use for missing file — use `1002`)* |
| **`1008`** | `MAX_IMAGES_EXCEEDED` | 400 | Exceeds max image count per upload batch or per answer |
| **`1009`** | `PERMISSION_DENIED` | 403 | Wrong role (RBAC), accessing another user's data (IDOR), locked account, rate-limit exceeded, **cannot delete due to FK dependencies** |
| **`1010`** | `ACTION_ALREADY_DONE` | 409 | Already accepted, already completed/closed, UAS7 already submitted today, image already attached/in use, prescription already exists |
| **`9992`** | `NOT_FOUND` | 404 | Non-existent user, medical record, template, section, question, option, answer, lesion, image, notification, role, permission, branch, department, room |
| **`9993`** | `VERIFY_CODE_INCORRECT` | 400 | Incorrect or expired OTP code |
| **`9994`** | `NO_DATA` | 409 | Missing prerequisite / ineligible state (no active chronic record for UAS7) |
| **`9995`** | `USER_NOT_VALIDATED` | 401 | Wrong password on login, wrong old password on password change |
| **`9996`** | `ALREADY_EXISTS` | 409 | Duplicate `phone`, role/permission/branch/dept/room name, `template_code`, `question_id`, `bhyt_so_the` |
| **`9997`** | `INVALID_METHOD` | 405 | Wrong HTTP verb *(no normal test case)* |
| **`9998`** | `INVALID_TOKEN` | 401 | Missing token, invalid/tampered token, expired token, blacklisted (logged-out) token |
| **`9999`** | `INTERNAL_ERROR` | 500 | Unhandled server exception *(no normal test case)* |

> **Canonical Constant Style:** Prefer the primary constant names above (`PERMISSION_DENIED`, `ACTION_ALREADY_DONE`, `ALREADY_EXISTS`, `UPLOAD_FAILED`, `USER_NOT_VALIDATED`) over aliases (`NOT_ACCESS`, `USER_EXISTED`, etc.) when writing new tests so the codebase stays uniform.

---

## 8. Standard Test File Template (Copy-Paste Boilerplate)

```typescript
import { apiClients } from '../../src/clients/apiClient';
import { RESPONSE_CODES, expectResponseCode } from '../../src/config/responseCodes';
import { MultiRoleSessions, setupMultiRoleSessions } from '../../src/utils/authHelper';
import { TeardownRegistry } from '../../src/utils/teardownRegistry';

describe('Week X - <Module Name> (Real API, Zero Mocking)', () => {
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

  describe('1. POST /api/<resource> (<Mô tả API>)', () => {
    it('[TC-<MOD>-01] Happy Path: <Mô tả ngắn gọn> (Code 1000)', async () => {
      const res = await apiClients.medrec.post(
        '/api/<resource>',
        { /* valid payload */ },
        { token: sessions.patient.token }
      );

      expectResponseCode(res.body.code, RESPONSE_CODES.OK);
      const createdId = res.body?.data?.id;
      expect(createdId).toBeTruthy();

      if (createdId) {
        testCaseTeardown.register(`Cleanup <resource> ${createdId}`, async () => {
          await apiClients.medrec.delete(`/api/<resource>/${createdId}`, {
            token: sessions.admin.token,
          });
        });
      }
    });

    it('[TC-<MOD>-02] Negative Case (Missing Param): Thiếu trường bắt buộc -> Trả về mã 1002', async () => {
      const res = await apiClients.medrec.post('/api/<resource>', {}, { token: sessions.patient.token });
      expectResponseCode(res.body.code, RESPONSE_CODES.MISSING_PARAMETER);
    });

    it('[TC-<MOD>-03] Security/Auth: Không truyền Token -> Trả về mã 9998', async () => {
      const res = await apiClients.medrec.post('/api/<resource>', {});
      expectResponseCode(res.body.code, RESPONSE_CODES.INVALID_TOKEN);
    });
  });
});
```

---

## 9. Agent Definition-of-Done Checklist

Before finishing any new test suite or test case addition, the agent MUST verify:
- [ ] **Zero Mocking:** No mock libraries or stubbed responses introduced.
- [ ] **Strict Folder Separation:** Nothing created or modified inside `D:\doAn`.
- [ ] **Teardown Registered:** Every created resource is registered in `testCaseTeardown` or `suiteTeardown`.
- [ ] **Consolidated Codes Only:** All assertions use `RESPONSE_CODES.*` matching Section 7 (`Bảng mã lỗi.html`).
- [ ] **Coverage:** 10–15 test cases per core API covering Happy Path, Validation, Auth/RBAC/IDOR, Edge Cases, and UI/Advanced rules where applicable.
- [ ] **TypeScript Compilation Passes:** Run `npm.cmd run typecheck` (or `npm run typecheck`) inside `D:\doAnWork` and confirm **0 errors**.
- [ ] **Documentation Updated:** Include a Markdown Test Case Design summary table for the newly added cases.
