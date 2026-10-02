import { BusinessRules } from '@/constants/businessRules';
import { CONFIRMATION_WORDS, VoiceCommands, type VoiceCommandDef } from '@/constants/voiceCommands';

/** Một phương án nhận dạng từ STT (Google trả nhiều phương án; Vosk trả một). */
export interface SpeechAlternative {
  transcript: string;
  /** 0–1. Không có hoặc ≤ 0 = engine không báo (Vosk, Google trên máy) → không dùng để loại. */
  confidence?: number;
}

/**
 * Chuẩn hóa để so khớp: Unicode NFC (STT có thể trả dấu dạng tổ hợp), chữ thường, bỏ dấu câu,
 * gộp khoảng trắng. GIỮ dấu tiếng Việt — bỏ dấu làm "có" / "cô" / "cỏ" thành một (§12).
 */
export function normalizeTranscript(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizedCommands = VoiceCommands.map((c) => ({
  command: c,
  keywords: c.keywords.map(normalizeTranscript),
}));
const confirmationWords = new Set(CONFIRMATION_WORDS.map(normalizeTranscript));

function isConfident(alt: SpeechAlternative, minConfidence: number): boolean {
  return alt.confidence === undefined || alt.confidence <= 0 || alt.confidence >= minConfidence;
}

/** Khớp nguyên từ: "có" không khớp "cóc". */
function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * Tìm lệnh trong các phương án nhận dạng (theo thứ tự engine trả về). Phương án đầu tiên khớp
 * đúng MỘT lệnh thì dùng. Khớp nhiều lệnh khác nhau / confidence thấp / không khớp → null:
 * KHÔNG đoán mò (§5.8), caller đọc "Tôi chưa hiểu, vui lòng nói lại".
 */
export function matchIntent(
  alternatives: readonly SpeechAlternative[],
  minConfidence: number = BusinessRules.VOICE_MIN_CONFIDENCE,
): VoiceCommandDef | null {
  for (const alt of alternatives) {
    if (!isConfident(alt, minConfidence)) continue;
    const text = normalizeTranscript(alt.transcript);
    const matched = normalizedCommands
      .filter((c) => c.keywords.some((k) => containsPhrase(text, k)))
      .map((c) => c.command);
    if (matched.length === 1) return matched[0] ?? null;
  }
  return null;
}

/**
 * Xác nhận lệnh nguy hiểm (BR-14): cả câu phải ĐÚNG BẰNG một từ trong danh sách cố định.
 * "không có", "có lẽ", "cô" → không phải xác nhận. Chỉ xét phương án ĐẦU: phương án phụ của "cô"
 * thường có "có" — dùng nó sẽ tự xác nhận gọi khẩn cấp.
 */
export function isConfirmation(
  alternatives: readonly SpeechAlternative[],
  minConfidence: number = BusinessRules.VOICE_MIN_CONFIDENCE,
): boolean {
  const top = alternatives[0];
  if (!top || !isConfident(top, minConfidence)) return false;
  return confirmationWords.has(normalizeTranscript(top.transcript));
}
