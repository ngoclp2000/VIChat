# VIChat Monorepo

Monorepo cung cấp kiến trúc nền tảng cho ứng dụng chat/voice/video đa tenant với SDK nhúng, backend realtime và ứng dụng tham chiếu web.

## Cấu trúc dự án

```
.
├── apps
│   ├── backend      # Fastify API + realtime gateway + token service
│   └── web          # Ứng dụng web React (Vite) sử dụng SDK
├── packages
│   ├── sdk-web      # Web SDK (TypeScript) quản lý kết nối, outbox offline
│   └── shared       # Kiểu dữ liệu chia sẻ giữa FE & BE
├── tsconfig.base.json
└── package.json
```

## Yêu cầu

- Node.js ≥ 18
- npm ≥ 9 (hỗ trợ workspaces)

## Thiết lập

```bash
npm install
```

Các package được cài đặt đồng thời thông qua workspace.

## Phát triển Backend

```bash
npm run dev --workspace apps/backend
```

Backend cung cấp:

- `POST /v1/auth/token`: cấp JWT ngắn hạn theo tenant.
- `GET /realtime`: kết nối WebSocket dùng chung cho tin nhắn/presence/call signalling.
- `POST /v1/conversations`: tạo hội thoại mẫu và broadcast sự kiện presence.
- `GET /healthz`: kiểm tra trạng thái dịch vụ.

## Phát triển Web

```bash
npm run dev --workspace apps/web
```

Ứng dụng React demo khởi tạo SDK, mở hội thoại mẫu và hiển thị luồng tin nhắn realtime. Khi khởi chạy ở môi trường local, frontend sẽ tự gọi `POST /v1/auth/token` để xin JWT demo trước khi mở WebSocket, vì vậy hãy đảm bảo backend được start trước.

## SDK Web

Gói `@vichat/sdk` triển khai các tính năng chính:

- `ChatKit.init` khởi tạo phiên, xác thực JWT và mở một kết nối realtime chia sẻ.
- Outbox lưu trong IndexedDB/memory để hàng đợi offline, tự flush khi kết nối lại.
- API cấp cao `sendText`, `startCall`, `setTyping`, `joinRoom`.
- Hệ thống sự kiện `message`, `presence`, `typing`, `call`, `state`.

## Kiểu dữ liệu dùng chung

`@vichat/shared` định nghĩa các interface xuyên suốt (message payload, presence, call signalling, media metadata…) giúp đồng bộ giữa client và server.

## Build & kiểm thử

```bash
npm run build
```

Chạy lint/test riêng cho từng workspace:

```bash
npm run lint --workspace apps/backend
npm run lint --workspace apps/web
npm run test --workspace packages/sdk-web
```

## Định hướng mở rộng

- Bổ sung lưu trữ phân tán (Cassandra/Scylla) và event bus Kafka theo mô tả kiến trúc.
- Tách signalling WebRTC chuyên biệt và tích hợp SFU (LiveKit/mediasoup).
- Mở rộng SDK mobile/desktop dựa trên shared core (packages/shared).
- Hoàn thiện E2EE với libsignal/MLS và key transparency service.
