// CLAUDE.md mục 12 — danh sách đề xuất, chốt lại với team.
// Từ khóa viết thường, GIỮ dấu tiếng Việt (matcher không bỏ dấu).
export type VoiceIntent =
  | 'START_NAVIGATION'
  | 'STOP_NAVIGATION'
  | 'READ_TEXT'
  | 'SCAN_QR'
  | 'RECOGNIZE_FACE'
  | 'WHERE_AM_I'
  | 'EMERGENCY'
  | 'MODE_MINIMAL'
  | 'MODE_FULL'
  | 'I_AM_OK'
  | 'SPEED_UP'
  | 'SLOW_DOWN'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'HELP'
  | 'REPEAT';

export interface VoiceCommandDef {
  intent: VoiceIntent;
  keywords: readonly string[];
  requiresConfirmation: boolean;
}

export const VoiceCommands: readonly VoiceCommandDef[] = [
  { intent: 'START_NAVIGATION', keywords: ['bắt đầu', 'dẫn đường'], requiresConfirmation: false },
  { intent: 'STOP_NAVIGATION', keywords: ['dừng lại', 'kết thúc'], requiresConfirmation: false },
  { intent: 'READ_TEXT', keywords: ['đọc chữ', 'đọc biển'], requiresConfirmation: false },
  { intent: 'SCAN_QR', keywords: ['quét mã', 'quét qr'], requiresConfirmation: false },
  { intent: 'RECOGNIZE_FACE', keywords: ['đây là ai', 'ai đây'], requiresConfirmation: false },
  { intent: 'WHERE_AM_I', keywords: ['tôi đang ở đâu'], requiresConfirmation: false },
  { intent: 'EMERGENCY', keywords: ['gọi khẩn cấp', 'cứu tôi'], requiresConfirmation: true },
  { intent: 'MODE_MINIMAL', keywords: ['chế độ tối giản'], requiresConfirmation: false },
  { intent: 'MODE_FULL', keywords: ['chế độ đầy đủ'], requiresConfirmation: false },
  { intent: 'I_AM_OK', keywords: ['tôi ổn'], requiresConfirmation: false },
  { intent: 'SPEED_UP', keywords: ['đọc nhanh hơn'], requiresConfirmation: false },
  { intent: 'SLOW_DOWN', keywords: ['đọc chậm hơn'], requiresConfirmation: false },
  {
    intent: 'VOLUME_UP',
    keywords: ['to lên', 'tăng âm lượng', 'nói to'],
    requiresConfirmation: false,
  },
  {
    intent: 'VOLUME_DOWN',
    keywords: ['nhỏ lại', 'giảm âm lượng', 'nói nhỏ'],
    requiresConfirmation: false,
  },
  { intent: 'HELP', keywords: ['trợ giúp'], requiresConfirmation: false },
  { intent: 'REPEAT', keywords: ['lặp lại'], requiresConfirmation: false },
];

/** Từ xác nhận cho lệnh nguy hiểm — chỉ chấp nhận danh sách cố định (BR-14). */
export const CONFIRMATION_WORDS: readonly string[] = ['có', 'đồng ý', 'xác nhận'];

/** Từ từ chối trong lúc chờ xác nhận → hủy ngay, không chờ hết thời gian. */
export const REJECTION_WORDS: readonly string[] = ['không', 'hủy', 'thôi'];
