# Spec: Authentication (mobile ↔ backend)

> Đối chiếu từ source `VisionAid-BE` (module `Auth`, `Users`, `Shared`) và `docs/api/openapi.json` ngày 2026-09-27.
> Mục **"Cần Backend chốt"** ở cuối là các điểm chặn; các mục khác là hợp đồng hiện tại, mobile code theo đó.

## 1. Định dạng chung

- JSON dùng camelCase; enum là **tên C# PascalCase** (`"VisuallyImpaired"`, `"Android"`), vì backend dùng `JsonStringEnumConverter` mặc định.
- Response thành công: `ApiResponse<T> { success, message, data, errors[] }`.
- Lỗi do exception: `application/problem+json` (RFC 7807) từ `GlobalExceptionMiddleware`:

| Exception                              | Status | title                                                     |
| -------------------------------------- | ------ | --------------------------------------------------------- |
| ValidationException (FluentValidation) | 400    | Validation Error (`errors`: `{ PropertyName: string[] }`) |
| UnauthorizedAccessException            | 401    | Unauthorized                                              |
| ForbiddenException                     | 403    | Forbidden                                                 |
| NotFoundException                      | 404    | Not Found                                                 |
| ConflictException / concurrency        | 409    | Conflict                                                  |
| BusinessRuleException                  | 422    | Business Rule Violation                                   |
| Khác                                   | 500    | Internal Server Error                                     |

- Một số action trả `BadRequest(ApiResponse)` / `Unauthorized(ApiResponse)` (không phải ProblemDetails) khi `result.Success == false`. **Client phải xử lý cả hai dạng lỗi.**
- `DateTimeOffset` được serialize theo giờ Việt Nam (`+07:00`, `VietnamDateTimeOffsetConverter`).
- Rate limit `"auth"`: 10 request/phút cho `login`, `register`, `forgot-password`. Vượt ngưỡng → 429 (body không theo ProblemDetails).

## 2. Endpoints

### POST `/api/auth/login` (anonymous)

```jsonc
// request
{
  "email": "string",            // bắt buộc, email hợp lệ, ≤ 255
  "password": "string",         // bắt buộc, ≤ 100
  "device": {                   // nullable ở backend — mobile LUÔN gửi
    "clientDeviceId": "uuid",   // từ SecureStore
    "fcmToken": "string|null",  // FCM được đăng ký NGAY tại login (không có endpoint /fcm-tokens riêng)
    "deviceType": "Android",
    "deviceModel": "string|null",
    "appVersion": "string|null"
  }
}
// 200 → ApiResponse<AuthTokenResponse>
{
  "accessToken": "jwt",
  "refreshToken": "base64 64 bytes",
  "expiresAt": "…+07:00",       // ⚠️ hạn của REFRESH token (30 ngày), KHÔNG phải access token
  "userId": "uuid",
  "email": "string",
  "role": "VisuallyImpaired",
  "organizationId": "uuid|null",
  "privacyConsentAcceptedAt": "…+07:00|null",
  "privacyPolicyVersion": "1.0|null"
}
```

| Lỗi                                                           | Status | Ý nghĩa với mobile                                 |
| ------------------------------------------------------------- | ------ | -------------------------------------------------- |
| Sai email/mật khẩu (cùng một thông báo để tránh dò tài khoản) | 401    | TTS "Email hoặc mật khẩu không đúng"               |
| Tài khoản bị khóa                                             | 403    | TTS "Tài khoản đã bị khóa, liên hệ người chăm sóc" |
| Validation                                                    | 400    | Đọc lỗi theo field                                 |
| Rate limit                                                    | 429    | TTS "Thử lại sau một phút"                         |

Backend **không chặn role** ở login. Mobile kiểm tra `role`: khác `VisuallyImpaired` → gọi `logout` (để revoke token vừa cấp) → TTS `Strings.auth.wrongRole`.

### POST `/api/auth/refresh` (anonymous)

```jsonc
{ "refreshToken": "string", "clientDeviceId": "uuid" } // → 200 ApiResponse<AuthTokenResponse> (cặp token MỚI)
```

- Rotation: token cũ bị revoke (`ReplacedBy` = token mới). **Gửi lại token cũ = reuse → server revoke TẤT CẢ phiên của user.**
- Mọi lỗi refresh trả **403** (không phải 401): token không tồn tại, reuse, hết hạn, user bị khóa/xóa.
- ⇒ Client: refresh trả 401 **hoặc** 403 → xóa token → về Login + TTS `sessionExpired`.

### POST `/api/auth/logout` (Bearer)

```jsonc
{ "clientDeviceId": "uuid" } // → 200 ApiResponse (data null)
```

Revoke mọi refresh token + tắt FCM token của device này. Mobile bỏ qua lỗi mạng (logout local vẫn chạy).

### POST `/api/auth/accept-privacy-policy` (Bearer)

```jsonc
{ "policyVersion": "1.0" } // → 200 ApiResponse (data null)
```

### POST `/api/auth/change-password` (Bearer)

```jsonc
{ "currentPassword": "string", "newPassword": "string" }
```

### GET `/api/users/me` (Bearer) → `ApiResponse<UserResponse>`

```jsonc
{ "id", "email", "fullName", "phoneNumber", "role", "organizationId", "isActive",
  "avatarUrl", "lastLoginAt", "deletedAt", "createdAt", "updatedAt",
  "privacyConsentAcceptedAt", "privacyPolicyVersion" }
```

## 3. JWT

- HS256, access token **15 phút** (production) / 60 phút (Development), refresh token 30 ngày.
- Claims: `ClaimTypes.NameIdentifier`, `ClaimTypes.Email`, `ClaimTypes.Role` (key là URI dài) + `organization_id`.
- Mobile **không decode JWT**: lấy `userId`/`role` từ body của login/refresh.

## 4. Luồng phía mobile

```
Khởi động: có token? → GET /users/me
  ├ 401 → refresh (single-flight) → OK: retry | 401/403: logout local
  ├ role ≠ VisuallyImpaired → logout + TTS wrongRole
  ├ privacyConsentAcceptedAt == null hoặc privacyPolicyVersion ≠ EXPO_PUBLIC_PRIVACY_POLICY_VERSION → Privacy Consent
  └ OK → Home
```

Interceptor: 401 ở request thường → refresh **một lần** (single-flight) → lưu CẢ cặp token mới → retry. Không refresh lại cho chính request `/auth/refresh`.

## 5. Cần Backend chốt (đánh số GAP khớp CLAUDE.md mục 19)

| #              | Vấn đề                                                                                                   | Đề xuất                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ~~Q1 (GAP-1)~~ | ✅ Đã xử lý (backend commit `f4e2592`): hai field privacy có trong `UserResponse` và `AuthTokenResponse` | —                                                                                  |
| Q2             | `expiresAt` trong token response là hạn refresh token                                                    | Giữ nguyên thì mobile ghi chú; hoặc thêm `accessTokenExpiresAt`                    |
| Q3 (GAP-2)     | Login không chặn role cho app mobile                                                                     | Chấp nhận (mobile tự chặn), hoặc thêm header `X-Client: mobile` để backend trả 403 |
| Q4 (GAP-13)    | Lỗi đôi khi là ProblemDetails, đôi khi là `ApiResponse` với `success:false`                              | Thống nhất một dạng; tạm thời mobile xử lý cả hai                                  |
| Q5 (GAP-8)     | Server chỉ có HTTP (`51.210.176.94:5002`)                                                                | Cần HTTPS + domain trước khi build staging/production                              |
