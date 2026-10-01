# Benchmarks — Obstacle Detection (Sprint 3)

Mục tiêu (CLAUDE.md §9.1, §17): **≤ 500 ms/chu kỳ**, **TTS ≤ 1 s** từ lúc phát hiện, **pin ≤ 20%/giờ**.

## 1. Thiết bị

| Máy                              | SoC            | RAM | Android |
| -------------------------------- | -------------- | --- | ------- |
| Samsung Galaxy S20 FE (SM-G780G) | Snapdragon 865 | 6GB | 13      |

> Máy mục tiêu trong tài liệu là Galaxy A-series 4GB RAM. Nếu nhóm có máy tầm trung, đo lại mục 2–4 trên máy đó.

## 2. Inference (✅ đã đo — 2026-09-27)

Đo bằng màn Detector Lab (build dev), model `yolov8n_float16.tflite`, 320×320, 5 fps mục tiêu. Chi tiết: ADR 0001 §5.

| Delegate           | Inference TB (ms) | p95 (ms) | Toàn chu kỳ TB (ms) | Đạt ≤ 500 ms |
| ------------------ | ----------------- | -------- | ------------------- | ------------ |
| **GPU** (mặc định) | 29 – 33           | 32 – 42  | 64 – 69             | ✅           |
| CPU (dự phòng)     | 80 – 104          | 94 – 126 | 98 – 127            | ✅           |

Tiền xử lý (resize, native) khoảng 8 ms; decode + NMS (worklet) 13–29 ms.
Trong app thật, `inferenceTimeMs` của mỗi cảnh báo được gửi lên server kèm detection event → xem thống kê qua dữ liệu `obstacle_detection_events`.

## 3. TTS latency (✅ đã đo — 2026-10-01)

Từ lúc phát hiện → bắt đầu đọc = **chu kỳ detection** (mục 2) + **chờ trong hàng đợi TTS → engine bắt đầu phát**.
Phần sau được log ở build dev: dòng `TTS latency { priority, ms }` trên console Metro (`TtsService`, sự kiện `onStart`).

Cách đo: bật dẫn đường, đưa lần lượt 20 vật (người, ghế, xe...) vào khung hình, ghi lại các giá trị `ms` có `priority` 1 (DANGER) và 4 (INFO).

| Lượt | Số mẫu | TB (ms) | p95 (ms) | + chu kỳ GPU (ms)      | Đạt ≤ 1000 ms |
| ---- | ------ | ------- | -------- | ---------------------- | ------------- |
| 1    | 22     | 113     | 205      | khoảng 180 TB, 270 p95 | ✅            |

Câu đầu tiên sau khi mở app mất khoảng 2.7 s (engine TTS khởi động lần đầu) — không tính vào kết quả, nhưng là lý do app đọc câu chào ngay khi vào Home để "làm nóng" engine trước khi dẫn đường.

## 4. Pin / giờ (✅ đạt ở 3 fps — 2026-10-01)

Cách đo (không cắm sạc trong lúc đo — sạc qua USB làm sai kết quả):

1. Sạc lên ≥ 80%, độ sáng màn hình cố định khoảng 50%, tắt các app khác, bật Wi-Fi.
2. Cắm cáp, chạy `adb shell dumpsys battery | grep level` → ghi mức pin đầu. Rút cáp.
3. Bấm **Bắt đầu dẫn đường** trên Home, cầm máy hướng camera ra trước (hoặc kê cố định) trong **30 phút**.
4. Bấm Dừng, cắm cáp, đọc lại mức pin. Pin/giờ = (đầu − cuối) × 2.
5. Đo thêm nhiệt độ: `adb shell dumpsys battery | grep temperature` (đơn vị 0.1 °C).

| Ngày       | Chế độ | Delegate   | Pin đầu | Pin cuối | Thời gian | Pin/giờ       | Nhiệt độ cuối | Đạt ≤ 20%       |
| ---------- | ------ | ---------- | ------- | -------- | --------- | ------------- | ------------- | --------------- |
| 2026-10-01 | Full   | GPU, 5 fps | 100%    | 89%      | 32 phút   | khoảng 21–22% | 38.7 °C       | ❌ (vượt nhẹ)   |
| 2026-10-01 | Full   | GPU, 3 fps | 94%     | 84%      | 31 phút   | khoảng 19–20% | 34.3 °C       | ✅ (sát ngưỡng) |

Lượt 1 bắt đầu từ 100% (đoạn đầu thường tụt chậm) nên con số thật có thể cao hơn một chút. Vượt 20%/giờ → giảm `TARGET_INFERENCE_FPS` (`useObstacleDetector.ts`) từ 5 xuống **3** (CLAUDE.md §9.1 gợi ý 2–4 fps) rồi đo lại. Độ trễ xấu nhất ở 3 fps: khoảng 330 ms chờ frame + 65 ms chu kỳ + 200 ms TTS ≈ 0.6 s, vẫn ≤ 1 s.

Phần tiêu hao không giảm theo fps: màn hình luôn sáng (keep-awake) và camera preview 720p. Nếu máy tầm trung (A-series) vượt 20%/giờ: giảm camera xuống 480p hoặc tắt preview/giảm độ sáng màn hình trong phiên (người dùng không cần nhìn màn hình).
