import { isConfirmation, matchIntent, normalizeTranscript } from './intentMatcher';

const say = (transcript: string, confidence?: number) => [{ transcript, confidence }];
const intentOf = (transcript: string, confidence?: number) =>
  matchIntent(say(transcript, confidence))?.intent ?? null;

describe('normalizeTranscript', () => {
  it('chữ thường, bỏ dấu câu, gộp khoảng trắng — GIỮ dấu tiếng Việt', () => {
    expect(normalizeTranscript('  Bắt   ĐẦU, dẫn đường! ')).toBe('bắt đầu dẫn đường');
  });

  it('dấu dạng tổ hợp (NFD) từ STT → khớp dạng dựng sẵn (NFC)', () => {
    expect(normalizeTranscript('có'.normalize('NFD'))).toBe('có');
  });
});

describe('matchIntent', () => {
  it.each([
    ['bắt đầu', 'START_NAVIGATION'],
    ['Dẫn đường cho tôi', 'START_NAVIGATION'],
    ['dừng lại', 'STOP_NAVIGATION'],
    ['đọc chữ giúp tôi', 'READ_TEXT'],
    ['quét QR', 'SCAN_QR'],
    ['đây là ai vậy', 'RECOGNIZE_FACE'],
    ['Tôi đang ở đâu?', 'WHERE_AM_I'],
    ['cứu tôi với', 'EMERGENCY'],
    ['chế độ tối giản', 'MODE_MINIMAL'],
    ['tôi ổn', 'I_AM_OK'],
    ['đọc chậm hơn', 'SLOW_DOWN'],
    ['lặp lại', 'REPEAT'],
  ])('"%s" → %s', (text, intent) => {
    expect(intentOf(text)).toBe(intent);
  });

  it('lệnh nguy hiểm được đánh dấu cần xác nhận', () => {
    expect(matchIntent(say('gọi khẩn cấp'))?.requiresConfirmation).toBe(true);
    expect(matchIntent(say('bắt đầu'))?.requiresConfirmation).toBe(false);
  });

  it('giữ dấu: thiếu dấu hoặc sai dấu thì KHÔNG khớp', () => {
    expect(intentOf('bat dau')).toBeNull();
    expect(intentOf('dung lai')).toBeNull();
    expect(intentOf('tôi ôn')).toBeNull(); // "ôn" ≠ "ổn"
  });

  it('khớp nguyên từ, không khớp một phần từ', () => {
    expect(intentOf('trợ giúpp')).toBeNull();
  });

  it('khớp NHIỀU lệnh khác nhau → không đoán', () => {
    expect(intentOf('bắt đầu rồi dừng lại')).toBeNull();
  });

  it('câu không chứa lệnh nào → null', () => {
    expect(intentOf('hôm nay trời đẹp quá')).toBeNull();
  });

  it('confidence dưới ngưỡng → null; engine không báo confidence (≤ 0 / không có) → vẫn khớp', () => {
    expect(intentOf('bắt đầu', 0.3)).toBeNull();
    expect(intentOf('bắt đầu', 0.8)).toBe('START_NAVIGATION');
    expect(intentOf('bắt đầu', -1)).toBe('START_NAVIGATION');
    expect(intentOf('bắt đầu')).toBe('START_NAVIGATION');
  });

  it('phương án đầu không khớp → thử phương án sau (Google maxAlternatives)', () => {
    const alts = [
      { transcript: 'bắt đâu', confidence: 0.7 },
      { transcript: 'bắt đầu', confidence: 0.6 },
    ];
    expect(matchIntent(alts)?.intent).toBe('START_NAVIGATION');
  });
});

describe('isConfirmation (BR-14: chỉ nhận từ cố định)', () => {
  it.each(['có', 'Có.', 'đồng ý', 'xác nhận'])('"%s" → xác nhận', (text) => {
    expect(isConfirmation(say(text))).toBe(true);
  });

  it.each(['cô', 'cỏ', 'cọ', 'co', 'không có', 'có lẽ', 'không', ''])(
    '"%s" → KHÔNG xác nhận',
    (text) => {
      expect(isConfirmation(say(text))).toBe(false);
    },
  );

  it('chỉ xét phương án đầu: "có" ở phương án phụ không được tính', () => {
    expect(
      isConfirmation([
        { transcript: 'cô', confidence: 0.6 },
        { transcript: 'có', confidence: 0.5 },
      ]),
    ).toBe(false);
  });

  it('"có" nhưng confidence thấp → không xác nhận', () => {
    expect(isConfirmation(say('có', 0.2))).toBe(false);
  });
});
