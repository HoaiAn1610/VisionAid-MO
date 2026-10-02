import { speechService } from '@/services/speech/SpeechService';
import { logger } from '@/utils/logger';

import { startConfirmation } from './confirmationFlow';

export interface VoiceConfirmation {
  /** Thời điểm xác nhận, hoặc null nếu bị từ chối / hết 10 s / hủy. */
  result: Promise<Date | null>;
  /** Hủy từ bên ngoài (chạm nút, rời màn hình). `silent`: không đọc câu "đã hủy". */
  cancel(silent?: boolean): void;
}

/**
 * Hỏi rồi nghe lặp tới khi người dùng trả lời "đồng ý / có / xác nhận", từ chối, hoặc hết 10 s
 * (BR-14). Dùng cho lệnh nguy hiểm và mọi hành động cần hỏi trước (mở đường dẫn trong mã QR…).
 */
export function confirmByVoice(prompt: string, cancelledMessage: string): VoiceConfirmation {
  const flow = startConfirmation({ prompt, cancelledMessage });
  void flow.result.then(() => speechService.abort()); // có kết quả khi mic còn mở → đóng mic
  const result = (async () => {
    while (!flow.settled) {
      const outcome = await speechService.listenOnce().catch((e: unknown) => {
        logger.warn('Confirmation listen failed', e);
        return null;
      });
      logger.debug('Confirmation heard', {
        alternatives: outcome?.alternatives,
        echo: outcome?.discardedAsEcho,
      });
      if (!outcome) flow.cancel();
      else flow.hear(outcome.alternatives);
    }
    const r = await flow.result;
    return r.status === 'Confirmed' ? new Date(r.confirmedAt) : null;
  })();
  return { result, cancel: (silent) => flow.cancel(silent) };
}
