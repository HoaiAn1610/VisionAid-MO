# Hướng dẫn sử dụng VisionAid (ứng dụng điện thoại cho người khiếm thị)

> Tài liệu dành cho **người khiếm thị** và **người hướng dẫn** (người chăm sóc, nhân viên trung tâm) cùng đọc trong buổi làm quen đầu tiên. Mọi thao tác trong ứng dụng đều có giọng nói phản hồi bằng tiếng Việt và rung — **không cần nhìn màn hình**.
>
> Phiên bản tài liệu: 08/10/2026 — khớp ứng dụng Sprint 9. Nền tảng: **Android 10 trở lên**.

---

## 1. Trước khi bắt đầu

### 1.1 Cần chuẩn bị

| Thứ cần có                                                                                   | Vì sao                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Túi đeo ngực (chest strap)** giữ điện thoại ngang ngực, **camera sau hướng ra phía trước** | Khoảng cách gần / xa và hướng trái / phải được tính theo tư thế này. Cầm tay hoặc để trong túi quần thì cảnh báo không chính xác   |
| **Gậy trắng** hoặc gậy thông minh                                                            | VisionAid **hỗ trợ**, không **thay thế** gậy (xem mục 10)                                                                          |
| Tài khoản do **người chăm sóc tạo trên trang web** VisionAid                                 | Ứng dụng điện thoại chỉ dành cho người khiếm thị; đăng ký, mua gói, thêm số liên hệ khẩn cấp, thêm ảnh người quen đều làm trên web |
| Gói dịch vụ còn hạn (hoặc đang dùng thử)                                                     | Hết gói quá 3 ngày: vẫn dẫn đường và gọi khẩn cấp được, các tính năng khác tạm dừng. Chưa từng có gói: **chỉ gọi khẩn cấp**        |
| Gói giọng nói tiếng Việt của Google                                                          | Để nhận lệnh giọng nói khi **không có mạng** (Android 13 trở lên). Ứng dụng tự tải khi có Wi-Fi                                    |

### 1.2 Lần đầu mở ứng dụng

1. **Đăng nhập** bằng email và mật khẩu người chăm sóc cung cấp (người hướng dẫn hỗ trợ nhập).
2. **Đồng ý chính sách bảo mật**: ứng dụng đọc nội dung, chạm nút lớn để đồng ý. Chính sách nói rõ ứng dụng dùng vị trí, ảnh người quen (do người chăm sóc tải lên), ảnh hiện trường khi té ngã và video camera trong cuộc gọi với người chăm sóc.
3. **Cho phép các quyền** khi ứng dụng hỏi — mỗi quyền đều được giải thích bằng giọng nói trước:
   - **Micro**: ra lệnh bằng giọng nói.
   - **Camera**: phát hiện vật cản, đọc chữ, nhận diện người quen.
   - **Vị trí** (chọn **"Luôn cho phép"** khi được hỏi lần hai): người chăm sóc biết bạn ở đâu, báo khi đến nơi quen.
   - **Gọi điện**: tự gọi người thân khi khẩn cấp, không cần tìm nút gọi.
   - **Thông báo**: nhận thông báo đến nơi quen khi màn hình tắt.

Khi sẵn sàng, ứng dụng nói: _"VisionAid đã sẵn sàng…"_ và tự bật nghe lệnh.

---

## 2. Điều khiển không cần nhìn

| Cách                                            | Làm gì                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Nói lệnh** ngay khi mở ứng dụng               | Ứng dụng tự nghe sau lời chào và sau mỗi kết quả (đọc chữ, nhận diện…)                                                                 |
| **Bấm phím tăng hoặc giảm âm lượng**            | Khi ứng dụng đang mở: bắt đầu / hủy nghe lệnh. Đang đếm ngược té ngã: **hủy cảnh báo**. Đang gọi người chăm sóc: **kết thúc cuộc gọi** |
| Nút **"Ra lệnh giọng nói"** trên màn hình chính | Giống phím âm lượng                                                                                                                    |
| Nói **"Ok Google, mở VisionAid"**               | Mở ứng dụng rảnh tay (trợ lý Google)                                                                                                   |

> Vì phím âm lượng dùng để ra lệnh, **âm lượng đổi bằng giọng nói**: "tăng âm lượng" / "giảm âm lượng". Ứng dụng không cho âm lượng xuống dưới 30% để bạn luôn nghe được phản hồi.

**Dùng cùng TalkBack:** khi TalkBack bật, ứng dụng **không tự mở micro** (để không nghe nhầm giọng TalkBack thành lệnh) — hãy bấm phím âm lượng để ra lệnh. Chạm **hai lần** để bấm nút như mọi ứng dụng khác. Khi có cảnh báo té ngã hay cuộc gọi, TalkBack tự chuyển tới nút cần bấm.

### 2.1 Danh sách lệnh giọng nói

| Nói                                                           | Ứng dụng làm                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| "bắt đầu", "dẫn đường"                                        | Bắt đầu dẫn đường (cảnh báo vật cản)                            |
| "dừng lại", "kết thúc"                                        | Dừng dẫn đường                                                  |
| "đọc chữ", "đọc biển"                                         | Chụp và đọc chữ trước mặt                                       |
| "quét mã", "quét QR"                                          | Đọc mã QR                                                       |
| "đây là ai", "ai đây"                                         | Nhận diện người quen trước mặt                                  |
| "tôi đang ở đâu"                                              | Đọc địa chỉ hiện tại                                            |
| "gọi khẩn cấp", "cứu tôi"                                     | Gọi khẩn cấp — **hỏi xác nhận**, nói **"đồng ý"** trong 10 giây |
| "tôi ổn"                                                      | Hủy cảnh báo té ngã đang đếm ngược                              |
| "gọi người chăm sóc"                                          | Gọi video cho người chăm sóc chính                              |
| "kết thúc cuộc gọi"                                           | Kết thúc cuộc gọi (khi đang gọi: bấm phím âm lượng)             |
| "chế độ tối giản" / "chế độ đầy đủ"                           | Đổi chế độ cảnh báo (mục 3.3)                                   |
| "đọc nhanh hơn" / "đọc chậm hơn"                              | Đổi tốc độ giọng đọc                                            |
| "tăng âm lượng" / "giảm âm lượng" (hoặc "to lên" / "nhỏ lại") | Đổi âm lượng điện thoại                                         |
| "lặp lại"                                                     | Đọc lại thông báo gần nhất                                      |
| "trợ giúp"                                                    | Đọc danh sách lệnh                                              |

Nói ngắn, rõ, giữ đúng dấu. Nếu không hiểu, ứng dụng nói _"Tôi chưa hiểu, vui lòng nói lại"_ — **ứng dụng không bao giờ đoán** lệnh.

---

## 3. Dẫn đường — cảnh báo vật cản

### 3.1 Bắt đầu / dừng

Nói **"bắt đầu"** (hoặc chạm nút lớn màu vàng **"Bắt đầu dẫn đường"**). Ứng dụng bật camera, giữ màn hình sáng và bắt đầu chia sẻ vị trí thường xuyên hơn cho người chăm sóc. Nói **"dừng lại"** để kết thúc.

### 3.2 Bạn sẽ nghe gì

- **Vật ở gần** — ví dụ _"Xe máy ở gần"_: đọc **ngay lập tức**, kể cả khi không có mạng. Đây là cảnh báo quan trọng nhất.
- **Vật ở xa hơn** — hướng dẫn tránh, ví dụ _"Có ô tô phía bên phải, hãy bước sang trái"_, _"Dừng lại, có vật cản phía trước"_, _"Đường thông thoáng, tiếp tục đi"_. Có mạng thì máy chủ quyết định hướng tránh, mất mạng thì điện thoại tự quyết định theo cùng quy tắc — bạn nghe câu giống nhau.
- Ứng dụng **chỉ báo gần / phía trước / xa**, không bao giờ đọc số mét.
- Mỗi vật không bị nhắc lại liên tục (tối thiểu vài giây), trừ khi vật **tiến lại gần hơn**.

### 3.3 Hai chế độ

- **Đầy đủ**: báo mọi vật nhận diện được (người, ghế, cột, xe…).
- **Tối giản**: chỉ báo vật nguy hiểm — **xe đạp, xe máy, ô tô, xe buýt, xe tải**. Dùng khi đông người để bớt ồn.
- **Pin dưới 10%**: ứng dụng tự chuyển sang Tối giản và báo một lần.

### 3.4 Các thông báo cần chú ý

| Bạn nghe                                                    | Ý nghĩa — nên làm gì                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"Camera không hoạt động, cảnh báo vật cản đang tạm dừng…"_ | Camera ngừng gửi hình (lỗi, bị ứng dụng khác dùng). **Dừng lại, dùng gậy**, nói "dừng lại" rồi "bắt đầu" lại. Khi có hình lại ứng dụng báo _"Camera đã hoạt động lại"_    |
| _"Tạm dừng cảnh báo vật cản"_                               | Bạn vừa mở màn khác (đọc chữ, QR, người quen, cài đặt…) trong lúc dẫn đường — camera đang dùng cho việc đó. Quay về màn chính, ứng dụng báo _"Tiếp tục cảnh báo vật cản"_ |
| _"Ứng dụng đã chạy nền, tạm dừng cảnh báo vật cản…"_        | Bạn vừa thoát ra màn hình chính / khóa máy. Mở lại VisionAid để tiếp tục                                                                                                  |
| _"Định vị trên điện thoại đang tắt…"_                       | Người chăm sóc không thấy vị trí của bạn. Nhờ bật **Vị trí** trong cài đặt nhanh                                                                                          |
| _"Chưa có gói dịch vụ…"_                                    | Chưa có gói nên chưa dẫn đường được — liên hệ người chăm sóc. **Gọi khẩn cấp vẫn dùng được**                                                                              |

---

## 4. Đọc chữ, mã QR, nhận diện người quen

- **Đọc chữ** ("đọc chữ"): hướng camera vào biển, giấy, bao bì; ứng dụng chụp và đọc. Có mạng: đọc tiếng Việt tốt hơn. Không có mạng: vẫn đọc được nhưng kém hơn với tiếng Việt có dấu. Không đọc rõ → _"Không đọc rõ, vui lòng chụp lại ở nơi đủ sáng"_.
- **Mã QR** ("quét mã"): đọc nội dung. Nếu là đường link, ứng dụng đọc tên trang và **hỏi trước khi mở**.
- **Người quen** ("đây là ai"): hướng camera vào mặt người trước mặt, cách khoảng một sải tay. Cần mạng. Ứng dụng đọc tên và quan hệ (ví dụ _"Lan, con gái, ở phía trước"_), hoặc _"Không nhận ra người này"_. Ảnh chụp để nhận diện **bị xóa ngay** khỏi điện thoại. Danh sách người quen do người chăm sóc thêm trên web.

---

## 5. Vị trí

- **"Tôi đang ở đâu"**: đọc địa chỉ hiện tại. Không có mạng → đọc địa chỉ gần nhất đã lưu kèm giờ ghi nhận, và nhắc rằng có thể không còn chính xác.
- **Đến nơi quen**: khi đến nơi người chăm sóc đã lưu (nhà, trung tâm, chợ…), ứng dụng đọc tên nơi đó — kể cả khi màn hình đang tắt.
- Ứng dụng chia sẻ vị trí cho người chăm sóc **thường xuyên khi đang dẫn đường** và **thưa hơn lúc khác** để tiết kiệm pin. Thông báo thường trực _"VisionAid đang chia sẻ vị trí"_ là bình thường.

---

## 6. Khẩn cấp

### 6.1 Gọi khẩn cấp

- Nói **"gọi khẩn cấp"** → ứng dụng hỏi _"Bạn có chắc…? Nói 'đồng ý' để xác nhận"_ → nói **"đồng ý"** (hoặc "có", "xác nhận") trong **10 giây**. Không trả lời → tự hủy.
- Hoặc chạm nút đỏ **"Gọi khẩn cấp"** trên màn hình chính → chạm **"Xác nhận gửi"**.
- Sau khi xác nhận: ứng dụng **gửi cảnh báo kèm vị trí** cho người chăm sóc và **tự gọi điện** cho người liên hệ ưu tiên số 1 — **ngay lập tức, không chờ mạng**. Người chăm sóc cũng có thể nhận cuộc gọi video để nhìn qua camera của bạn (mục 7).
- **Mất mạng**: vẫn gọi điện được; cảnh báo được giữ lại và **tự gửi khi có mạng** — không bao giờ bị mất.
- **Số khẩn cấp 112, 113, 114, 115**: Android không cho ứng dụng tự gọi các số này. Ứng dụng mở sẵn bàn phím gọi với số đã điền và hướng dẫn chạm nút gọi màu xanh ở giữa phía dưới màn hình. Nếu có cả số người thân, ứng dụng gọi người thân trước.

### 6.2 Phát hiện té ngã

- **Chỉ hoạt động khi đang dẫn đường** (cần camera).
- Ứng dụng chỉ báo té ngã khi có **cả hai dấu hiệu**: điện thoại rơi và va chạm mạnh, **rồi** hình ảnh camera đứng yên khoảng 5 giây. Một dấu hiệu riêng lẻ (vấp nhẹ, đặt điện thoại xuống) không báo.
- Khi phát hiện: máy **rung mỗi giây**, đọc _"Phát hiện té ngã. Nói tôi ổn, hoặc chạm vào màn hình để hủy cảnh báo"_, rồi đếm _"10"_, _"5"_.
- **Hủy trong 15 giây** bằng một trong các cách: **chạm bất kỳ đâu trên màn hình** (TalkBack: chạm hai lần), nói **"tôi ổn"**, hoặc **bấm phím âm lượng**. Ứng dụng nói _"Đã hủy cảnh báo"_.
- Không hủy → hết 15 giây ứng dụng **gửi cảnh báo** cho người chăm sóc kèm vị trí và **một ảnh nhỏ chụp hiện trường lúc té ngã** (để người chăm sóc biết bạn ở đâu). Nếu bạn đã hủy, ảnh **không bao giờ** được gửi. Không có mạng → ứng dụng tự gọi người liên hệ ưu tiên số 1.

---

## 7. Gọi video với người chăm sóc

- **Người chăm sóc gọi bạn**: ứng dụng đọc _"… đang gọi. Tự động nghe máy"_ và **tự nhận** — bạn không cần làm gì.
- **Bạn gọi**: nói **"gọi người chăm sóc"**.
- **Khi khẩn cấp**: hệ thống tự mở cuộc gọi video với người chăm sóc chính.
- Trong cuộc gọi: người chăm sóc **nhìn thấy camera sau** của bạn (đường phía trước) và nói chuyện với bạn qua **loa ngoài**; bạn không cần nhìn màn hình. Cảnh báo vật cản **tạm dừng** trong lúc gọi (camera đang dùng cho cuộc gọi) và tự bật lại khi gọi xong.
- **Kết thúc**: bấm **phím âm lượng**, hoặc chạm nút lớn **"Kết thúc cuộc gọi"**. Không ai nghe máy sau khoảng 45 giây → _"Người chăm sóc chưa nghe máy"_.
- Cuộc gọi cần mạng; tối đa 60 phút mỗi cuộc.

---

## 8. Cài đặt

Chạm biểu tượng bánh răng trên màn hình chính:

- **Tốc độ đọc** (chậm hơn / nhanh hơn) và **âm lượng giọng đọc** (nhỏ hơn / to hơn): ứng dụng đọc thử bằng mức mới. Cài đặt được lưu và giữ nguyên khi mở lại ứng dụng hay đổi điện thoại (khi có mạng).
- **Chế độ cảnh báo**: Đầy đủ / Tối giản.
- **Đổi mật khẩu**: nhập mật khẩu hiện tại và mật khẩu mới (ít nhất 8 ký tự, có chữ hoa, chữ thường, chữ số, ký tự đặc biệt). Đổi xong cần **đăng nhập lại**.
- **Đăng xuất**.

---

## 9. Khi không có mạng

| Tính năng                | Không có mạng                                                   |
| ------------------------ | --------------------------------------------------------------- |
| Cảnh báo vật cản ở gần   | ✅ Bình thường                                                  |
| Hướng dẫn tránh vật ở xa | ✅ Điện thoại tự quyết định                                     |
| Lệnh giọng nói           | ⚠️ Android 13 trở lên có gói tiếng Việt: được; máy cũ: dùng nút |
| Đọc mã QR                | ✅                                                              |
| Đọc chữ                  | ⚠️ Được, nhưng tiếng Việt kém hơn                               |
| Nhận diện người quen     | ❌ Cần mạng                                                     |
| "Tôi đang ở đâu"         | ⚠️ Địa chỉ đã lưu gần nhất                                      |
| Gọi khẩn cấp             | ✅ Gọi điện được; cảnh báo tự gửi khi có mạng                   |
| Phát hiện té ngã         | ✅ Phát hiện được; hết giờ tự gọi người thân                    |
| Gọi video người chăm sóc | ❌ Cần mạng                                                     |

---

## 10. Giới hạn và lưu ý an toàn

> **Đọc kỹ cùng người hướng dẫn trước khi ra đường.**

1. **Luôn dùng kèm gậy trắng hoặc gậy thông minh.** VisionAid là công cụ hỗ trợ, không thay thế gậy hay người dẫn đường.
2. **Bắt buộc đeo điện thoại bằng túi đeo ngực**, camera sau hướng ra trước, ngang ngực. Cầm tay hoặc để trong túi: cảnh báo sai hoặc không có.
3. **Điểm mù của camera** — ứng dụng **không phát hiện được**:
   - hố, ổ gà, mép vỉa hè, bậc thang đi xuống (camera nhìn ngang, không nhìn xuống chân);
   - vật treo cao (biển báo, cành cây), vật ở hai bên ngoài góc nhìn;
   - vật lao tới rất nhanh từ phía sau hoặc bên cạnh.
4. **Ánh sáng yếu, mưa, ngược sáng**: độ chính xác giảm rõ rệt.
5. **Khoảng cách chỉ là ước lượng** "gần / phía trước / xa", không chính xác như thước đo.
6. **Phát hiện té ngã chỉ hoạt động khi đang dẫn đường.** Ngoài lúc dẫn đường, hãy dùng lệnh "gọi khẩn cấp".
7. **Số khẩn cấp 112–115**: ứng dụng không tự gọi được — cần chạm nút gọi trên bàn phím gọi (mục 6.1).
8. **Không có SOS bằng cử chỉ** (lắc máy…): chỉ dùng nút, giọng nói, hoặc tự động khi té ngã.
9. **Pin**: dẫn đường dùng camera liên tục nên tốn pin. Sạc đầy trước khi ra ngoài; dưới 10% ứng dụng tự chuyển chế độ Tối giản.
10. **Gói dịch vụ hết hạn**: hết hạn quá 3 ngày chỉ còn dẫn đường và gọi khẩn cấp; chưa có gói chỉ còn gọi khẩn cấp.

---

## 11. Xử lý sự cố

| Vấn đề                                | Cách xử lý                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Không nghe thấy giọng đọc             | Nói "tăng âm lượng"; kiểm tra điện thoại không ở chế độ im lặng; vào Cài đặt → âm lượng giọng đọc |
| Ứng dụng không nhận lệnh khi mất mạng | Máy dưới Android 13 hoặc chưa có gói tiếng Việt → dùng nút; nhờ kết nối Wi-Fi để ứng dụng tải gói |
| "Camera không hoạt động…" lặp lại     | Đóng hẳn ứng dụng khác đang dùng camera (gọi video, máy ảnh), dừng rồi bắt đầu dẫn đường lại      |
| Không nhận ra người quen              | Đến gần hơn, đủ sáng, nhìn thẳng; nhờ người chăm sóc thêm ảnh rõ mặt trên web                     |
| Gọi khẩn cấp nhưng không gọi được ai  | Nhờ người chăm sóc kiểm tra **danh sách số liên hệ khẩn cấp** trên web                            |
| "Phiên đăng nhập đã hết hạn"          | Đăng nhập lại (người hướng dẫn hỗ trợ)                                                            |

---

## 12. Quyền riêng tư

- Hình ảnh camera khi dẫn đường **chỉ xử lý trên điện thoại**, không gửi đi.
- Ảnh chụp để đọc chữ / nhận diện người quen được gửi lên máy chủ VisionAid để xử lý; ảnh nhận diện người quen **xóa ngay** khỏi điện thoại sau khi có kết quả.
- Ảnh hiện trường té ngã **chỉ gửi khi cảnh báo được gửi đi** (không gửi khi bạn đã hủy).
- Vị trí và cảnh báo chỉ người chăm sóc được liên kết với bạn (hoặc trung tâm quản lý) xem được.
- Trong cuộc gọi video, người chăm sóc thấy hình từ camera sau của bạn.
