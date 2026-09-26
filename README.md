# VisionAid Mobile (VIU)

Ứng dụng di động cho người khiếm thị: React Native + Expo SDK 57, Expo Router, TypeScript strict. Đặc tả đầy đủ nằm trong [`CLAUDE.md`](./CLAUDE.md).

## Cài đặt

```bash
npm install
cp .env.example .env.local   # mặc định trỏ tới server backend đã deploy
```

## Chạy trên Android (Development Build, không dùng Expo Go)

```bash
npm run android        # expo run:android: prebuild + build + cài lên thiết bị/emulator
npm start              # chỉ chạy Metro cho bản dev client đã cài
```

Build trên cloud: `npx eas-cli@latest build --profile development --platform android`

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (expo + prettier) |
| `npm run format` | Prettier |
| `npm test` / `npm run test:coverage` | Jest (jest-expo) |
| `npm run doctor` | expo-doctor |

## Cấu trúc

- `app/`: màn hình (Expo Router), giữ mỏng
- `src/features/`: logic theo domain
- `src/services/`: singleton services (TTS, haptics, storage, network...)
- `src/constants/`: enums, business rules, voice commands, chuỗi tiếng Việt
