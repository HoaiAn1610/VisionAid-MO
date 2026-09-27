# ADR 0001: Chạy YOLOv8n on-device bằng TFLite (react-native-fast-tflite) thay vì ONNX Runtime

- **Trạng thái:** ✅ Chấp nhận (Accepted), 2026-09-27, sau khi đo trên Samsung Galaxy S20 FE (mục 5).
- **Ngày:** 2026-09-27
- **Liên quan:** CLAUDE.md §2 (Tech stack), §9.1 (Obstacle Detection), §16.11–12 (Performance); Risk #2 của dự án.

## 1. Bối cảnh

Phát hiện vật cản phải chạy **offline, real-time**: ≤ 500 ms/chu kỳ trên Android tầm trung, TTS ≤ 1 s kể từ lúc phát hiện, và inference **không được chạy trên JS thread** (CLAUDE.md §16.11). Tài liệu dự án chọn `onnxruntime-react-native`, với phương án dự phòng là `react-native-fast-tflite`, rồi mới tới xử lý trên server.

Môi trường hiện tại: Expo SDK 57, React Native 0.86 (New Architecture), thiết bị test Samsung Galaxy S20 FE (SM-G780G, Snapdragon 865).

## 2. Các phương án

| Tiêu chí                                     | A. `onnxruntime-react-native` 1.24                                                                      | B. `react-native-fast-tflite` 3.0 + VisionCamera 4.7                                                           | C. Detection trên server                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Chạy trong frame processor (ngoài JS thread) | ❌ Chỉ có `InferenceSession.run()` bất đồng bộ trên JS thread; không có API worklet hay frame processor | ✅ `runSync()` gọi trực tiếp trong worklet của frame processor (tài liệu chính thức có ví dụ)                  | —                                             |
| Đưa frame camera vào model                   | Phải chép từng frame sang JS thread (không có plugin sẵn)                                               | `vision-camera-resize-plugin`: cắt, xoay, resize và đổi sang RGB float32 **ở native**                          | Upload ảnh                                    |
| Tăng tốc phần cứng Android                   | NNAPI/XNNPACK (không có trong README RN)                                                                | GPU delegate (`android-gpu`, OpenCL) + NNAPI, bật qua config plugin Expo                                       | —                                             |
| Offline                                      | ✅                                                                                                      | ✅                                                                                                             | ❌ Vi phạm yêu cầu offline-first              |
| Độ trễ mạng                                  | —                                                                                                       | —                                                                                                              | ❌ 1–4 s qua mạng di động, vượt ngân sách 1 s |
| Rủi ro tích hợp                              | Cao: phải tự viết frame processor plugin native                                                         | Trung bình: tổ hợp có tài liệu, nhưng buộc dùng **VisionCamera v4** (bản tích hợp cho v5 hiện không công khai) | Thấp về code, nhưng hỏng yêu cầu sản phẩm     |

## 3. Quyết định

Chọn **phương án B**: YOLOv8n chuyển sang **TFLite**, chạy bằng `react-native-fast-tflite` 3.0 trong frame processor của **VisionCamera 4.7.x** (`react-native-worklets-core`), tiền xử lý bằng `vision-camera-resize-plugin`.

Pipeline:

```
Camera (YUV) → runAtTargetFps(5) → resize plugin: cắt vuông giữa, xoay dọc, 320×320 RGB float32
→ fast-tflite runSync (CPU / GPU / NNAPI) → decode [1, 84, 2100] + NMS theo class (TS worklet)
→ runOnJS → TtsService (Sprint 3)
```

## 4. Hệ quả

- **Chuyển đổi model:** Ultralytics chỉ export TFLite trên Linux/macOS. Trên Windows dùng đường **PyTorch → ONNX (Ultralytics) → TFLite (onnx2tf)**; hoặc export trên Colab hay Linux. Model đặt ở `assets/models/*.tflite`, được bundle như asset (Metro `assetExts`).
- **Kích thước input 320** (2100 anchor) thay vì 640 (8400 anchor): nhanh hơn khoảng 4 lần, đổi lại vật ở xa bị nhận kém hơn. Chấp nhận được vì chỉ cần phân loại Near/Medium/Far và ưu tiên vật gần.
- **Phụ thuộc VisionCamera v4:** khi fast-tflite công bố tích hợp VisionCamera v5 thì cân nhắc nâng cấp (ghi lại trong nợ kỹ thuật).
- **Xung đột worklet (đã gặp khi chạy thật 2026-09-27):** Reanimated 4 + `react-native-worklets` được npm cài kèm như peer của expo-router/VisionCamera. Plugin Babel của nó giành biến đổi các hàm `'worklet'` → frame processor của worklets-core báo _"cannot be shared"_; nếu chỉ tắt plugin thì `libworklets.so` abort lúc khởi động (`installUnpackers`). Giải pháp: `babel-preset-expo` với `{ reanimated: false, worklets: false }` **và** loại hai gói khỏi autolinking (`react-native.config.js`). **Không dùng Reanimated trong app** khi còn ở VisionCamera 4. Cũng không dùng `runAtTargetFps` của VisionCamera (helper nội bộ không được biên dịch thành worklet) → tự điều tiết FPS bằng `useSharedValue`.
- **QR:** cùng VisionCamera 4.7, dùng code scanner on-device (ML Kit) cho Sprint 5, không cần thêm thư viện.
- CLAUDE.md §2/§3 cần cập nhật: đổi `onnxruntime-react-native` → `react-native-fast-tflite`, `yolov8n_int8.onnx` → `yolov8n_*.tflite`.

## 5. Kết quả đo (Samsung Galaxy S20 FE SM-G780G, Android 13, 2026-09-27)

Công cụ: màn **Cài đặt → Thử nghiệm phát hiện vật cản** (chỉ bản dev), input 320×320, mục tiêu 5 FPS, số liệu trên 30 mẫu gần nhất. Mỗi cấu hình chạy khoảng 12–15 giây; cảnh thay đổi giữa các lần đo nên số dao động khoảng ±25%.

| Model       | Delegate | Inference TB (ms) | p95 (ms)    | Toàn chu kỳ TB (ms) | FPS đạt / 5 |
| ----------- | -------- | ----------------- | ----------- | ------------------- | ----------- |
| float16     | CPU      | 80 – 104          | 94 – 126    | 98 – 127            | 4.6 – 4.7   |
| **float16** | **GPU**  | **29 – 33**       | **32 – 42** | **64 – 69**         | 4.6 – 4.7   |
| float16     | NNAPI    | 108               | 130         | 131                 | 4.5         |
| float32     | CPU      | 107               | 130         | 130                 | 4.6         |
| float32     | GPU      | 31 – 33           | 33 – 44     | 66 – 68             | 4.6         |

Tiền xử lý (resize plugin, native) khoảng 8 ms; hậu xử lý (decode + NMS trong worklet JS) 13–29 ms.

**Kết luận:**

- **Mọi cấu hình đều đạt** tiêu chí ≤ 500 ms, dư hơn 3 lần kể cả trên CPU.
- Chọn **float16 + GPU delegate** (nhanh gấp khoảng 3 lần CPU), **tự lùi về CPU** nếu máy không tạo được GPU delegate. NNAPI không nhanh hơn CPU và đã bị khóa từ Android 15 → không dùng.
- Bỏ model float32 khỏi app (không nhanh hơn float16 trên GPU, nặng gấp đôi: 12.7MB so với 6.4MB).
- Nhận diện đúng trên cảnh thật (bed 70%, suitcase 52%, laptop…); box khớp vị trí, nên hướng xoay khung hình đúng.
- Còn dư ngân sách: có thể tăng lên 8–10 FPS hoặc input 416 nếu cần nhận vật ở xa tốt hơn (quyết định ở Sprint 3 khi đo pin).

## 6. Cách export model (lặp lại được)

Chạy trong venv Python riêng (Windows cũng được; Ultralytics chặn export TFLite trên Windows nên đi đường ONNX → onnx2tf):

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics "onnx2tf[tensorflow]" sng4onnx onnx_graphsurgeon

yolo export model=yolov8n.pt format=onnx imgsz=320 opset=17 simplify=True
# BẮT BUỘC dùng backend tf_converter — backend mặc định flatbuffer_direct (onnx2tf 2.6.9)
# sinh model lỗi ở CONV_2D đầu tiên khi nạp vào TFLite Interpreter.
onnx2tf -i yolov8n.onnx -o tflite_out -tb tf_converter
# → tflite_out/yolov8n_float32.tflite (12.7MB), yolov8n_float16.tflite (6.4MB)
```

**Đã kiểm chứng (2026-09-27):** input `[1,320,320,3]` float32 NHWC (0–1), output `[1,84,2100]` float32, toạ độ theo pixel của input. Trên `bus.jpg` (cắt vuông giữa, 320px), bộ giải mã TypeScript của app (`yoloDecoder.ts`) cho ra bus 0.90, person 0.89/0.82/0.80, trùng với PyTorch.

INT8 (`onnx2tf -oiqt` + dữ liệu hiệu chỉnh) chưa làm; chỉ làm nếu float16 không đạt mục tiêu ở mục 5.
