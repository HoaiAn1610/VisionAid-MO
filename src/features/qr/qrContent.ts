import { Strings } from '@/constants/strings.vi';

/** Đọc tối đa ngần này ký tự nội dung QR dạng văn bản (đọc dài quá người dùng khó theo dõi). */
const MAX_SPOKEN_CHARS = 300;

export type QrKind = 'Url' | 'Phone' | 'Email' | 'Wifi' | 'Text';

export interface QrInfo {
  /** Gửi lên backend làm `QrType` (≤ 50 ký tự). */
  kind: QrKind;
  /** Chỉ có với Url — http/https, để hỏi trước khi mở. */
  url: string | null;
  domain: string | null;
  /** Câu TTS. */
  speech: string;
}

/**
 * Phân loại nội dung QR và tạo câu đọc (§9.3). URL: chỉ đọc tên miền, KHÔNG tự mở — luôn hỏi.
 * Tên miền lấy bằng regex vì URL của React Native không hỗ trợ `hostname`.
 */
export function describeQr(raw: string): QrInfo {
  const content = raw.trim();
  const url = /^(https?):\/\/([^/?#:\s]+)/i.exec(content);
  if (url) {
    const domain = (url[2] ?? '').toLowerCase().replace(/^www\./, '');
    return { kind: 'Url', url: content, domain, speech: Strings.qr.url(domain) };
  }
  const phone = /^tel:([+\d\s().-]+)$/i.exec(content);
  if (phone) {
    // Đọc từng chữ số: "0 9 0 1…" — TTS đọc cả cụm thành "chín trăm linh một triệu…"
    const digits = (phone[1] ?? '')
      .replace(/[^\d+]/g, '')
      .split('')
      .join(' ');
    return { kind: 'Phone', url: null, domain: null, speech: Strings.qr.phone(digits) };
  }
  const email = /^mailto:([^?\s]+)/i.exec(content);
  if (email) {
    return { kind: 'Email', url: null, domain: null, speech: Strings.qr.email(email[1] ?? '') };
  }
  // Định dạng WIFI:T:WPA;S:<tên mạng>;P:<mật khẩu>;; — ký tự đặc biệt được thoát bằng "\"
  const wifi = /^WIFI:.*?S:((?:\\.|[^;])*)/i.exec(content);
  if (wifi) {
    const ssid = (wifi[1] ?? '').replace(/\\(.)/g, '$1'); // không đọc mật khẩu
    return { kind: 'Wifi', url: null, domain: null, speech: Strings.qr.wifi(ssid) };
  }
  const spoken =
    content.length > MAX_SPOKEN_CHARS
      ? content.slice(0, MAX_SPOKEN_CHARS) + Strings.qr.truncated
      : content;
  return { kind: 'Text', url: null, domain: null, speech: Strings.qr.text(spoken) };
}
