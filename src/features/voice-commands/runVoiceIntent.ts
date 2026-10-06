import { BusinessRules } from '@/constants/businessRules';
import type { DetectionMode } from '@/constants/enums';
import { Strings } from '@/constants/strings.vi';
import { VoiceCommands, type VoiceIntent } from '@/constants/voiceCommands';

/** "đọc nhanh hơn" / "đọc chậm hơn" đổi tốc độ từng nấc này (§12). */
const SPEED_STEP = 0.25;
/** "tăng âm lượng" / "giảm âm lượng" đổi âm lượng media từng nấc này (khoảng 2/15 nấc của Android). */
const VOLUME_STEP = 0.15;
/**
 * Phím âm lượng đã thành nút ra lệnh → không cho âm lượng xuống mức không nghe thấy, nếu không
 * người dùng sẽ không nghe được chính câu trả lời của lệnh "tăng âm lượng".
 */
export const MIN_MEDIA_VOLUME = 0.3;

export interface VoiceContext {
  say(text: string): void;
  navigationActive: boolean;
  startNavigation(): void;
  stopNavigation(): void;
  openQrScanner(): void;
  openTextReader(): void;
  openFaceRecognizer(): void;
  openLocation(): void;
  /** Lệnh "gọi khẩn cấp" đã được xác nhận (BR-14) → gửi SOS ngay. */
  openEmergency(): void;
  setDetectionMode(mode: DetectionMode): void;
  speechRate: number;
  setSpeechRate(rate: number): void;
  /** Câu TTS gần nhất TRƯỚC lượt ra lệnh này (cho lệnh "lặp lại"). */
  lastAnnouncement: string | null;
  /** Âm lượng media 0..1; `null` nếu máy không hỗ trợ đổi âm lượng. */
  mediaVolume: number | null;
  setMediaVolume(volume: number): void;
}

/**
 * Thực thi một lệnh đã khớp (và đã xác nhận nếu là lệnh nguy hiểm). Luôn có phản hồi TTS (§5.4).
 * @returns false nếu tính năng của lệnh chưa có (voice log ghi `Failed`).
 */
export function runVoiceIntent(intent: VoiceIntent, ctx: VoiceContext): boolean {
  if (NOT_IMPLEMENTED.has(intent)) {
    ctx.say(Strings.voice.notImplemented);
    return false;
  }
  execute(intent, ctx);
  return true;
}

// TODO(Sprint 7): hủy cảnh báo té ngã
const NOT_IMPLEMENTED = new Set<VoiceIntent>(['I_AM_OK']);

function execute(intent: VoiceIntent, ctx: VoiceContext): void {
  switch (intent) {
    case 'SCAN_QR':
      return ctx.openQrScanner(); // màn quét tự đọc hướng dẫn
    case 'READ_TEXT':
      return ctx.openTextReader();
    case 'RECOGNIZE_FACE':
      return ctx.openFaceRecognizer();
    case 'WHERE_AM_I':
      return ctx.openLocation();
    case 'EMERGENCY':
      return ctx.openEmergency();
    case 'START_NAVIGATION':
      return ctx.startNavigation(); // tự báo "bắt đầu dẫn đường"
    case 'STOP_NAVIGATION':
      return ctx.navigationActive ? ctx.stopNavigation() : ctx.say(Strings.voice.notNavigating);
    case 'MODE_MINIMAL':
      ctx.setDetectionMode('Minimal');
      return ctx.say(Strings.voice.modeMinimal);
    case 'MODE_FULL':
      ctx.setDetectionMode('Full');
      return ctx.say(Strings.voice.modeFull);
    case 'SPEED_UP':
    case 'SLOW_DOWN': {
      const faster = intent === 'SPEED_UP';
      const next = Math.min(
        BusinessRules.TTS_MAX_SPEED,
        Math.max(BusinessRules.TTS_MIN_SPEED, ctx.speechRate + (faster ? SPEED_STEP : -SPEED_STEP)),
      );
      if (next === ctx.speechRate) {
        return ctx.say(faster ? Strings.voice.fastest : Strings.voice.slowest);
      }
      ctx.setSpeechRate(next);
      return ctx.say(faster ? Strings.voice.faster : Strings.voice.slower);
    }
    case 'VOLUME_UP':
    case 'VOLUME_DOWN': {
      const current = ctx.mediaVolume;
      if (current === null) return ctx.say(Strings.errors.unavailable);
      const louder = intent === 'VOLUME_UP';
      if (louder ? current >= 0.99 : current <= MIN_MEDIA_VOLUME + 0.01) {
        return ctx.say(louder ? Strings.voice.loudest : Strings.voice.quietest);
      }
      ctx.setMediaVolume(
        Math.min(1, Math.max(MIN_MEDIA_VOLUME, current + (louder ? VOLUME_STEP : -VOLUME_STEP))),
      );
      return ctx.say(louder ? Strings.voice.louder : Strings.voice.quieter);
    }
    case 'HELP':
      return ctx.say(Strings.voice.help(VoiceCommands.map((c) => c.keywords[0]).join(', ')));
    case 'REPEAT':
      return ctx.say(ctx.lastAnnouncement ?? Strings.voice.nothingToRepeat);
  }
}
