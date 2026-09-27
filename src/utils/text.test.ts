import { normalizeTranscript } from './text';

describe('normalizeTranscript', () => {
  it('lowercase, bỏ dấu câu, gộp khoảng trắng — GIỮ dấu tiếng Việt', () => {
    expect(normalizeTranscript('  Gọi   KHẨN cấp!! ')).toBe('gọi khẩn cấp');
  });

  it('không làm "có" / "cô" / "cỏ" trùng nhau', () => {
    const words = ['Có', 'Cô', 'Cỏ'].map(normalizeTranscript);
    expect(new Set(words).size).toBe(3);
  });

  it('chuẩn hóa Unicode NFC (tổ hợp dấu tách rời → dựng sẵn)', () => {
    expect(normalizeTranscript('có')).toBe('có');
  });
});
