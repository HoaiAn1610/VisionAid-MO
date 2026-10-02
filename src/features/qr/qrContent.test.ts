import { Strings } from '@/constants/strings.vi';

import { describeQr } from './qrContent';

describe('describeQr', () => {
  it('URL → chỉ đọc tên miền (bỏ www), giữ URL đầy đủ để hỏi trước khi mở', () => {
    expect(describeQr(' https://www.Example.com/path?x=1 ')).toEqual({
      kind: 'Url',
      url: 'https://www.Example.com/path?x=1',
      domain: 'example.com',
      speech: Strings.qr.url('example.com'),
    });
  });

  it('chỉ http/https mới là URL (javascript:, file: … là văn bản, không bao giờ mở)', () => {
    expect(describeQr('javascript:alert(1)').kind).toBe('Text');
    expect(describeQr('file:///sdcard/a.txt').kind).toBe('Text');
  });

  it('số điện thoại → đọc từng chữ số', () => {
    expect(describeQr('tel:+84 901-234')).toMatchObject({
      kind: 'Phone',
      speech: Strings.qr.phone('+ 8 4 9 0 1 2 3 4'),
    });
  });

  it('email và Wi-Fi → đọc phần có nghĩa', () => {
    expect(describeQr('mailto:a@b.vn?subject=hi').speech).toBe(Strings.qr.email('a@b.vn'));
    expect(describeQr('WIFI:T:WPA;S:Nha\\;Toi;P:secret;;')).toMatchObject({
      kind: 'Wifi',
      speech: Strings.qr.wifi('Nha;Toi'), // không đọc mật khẩu
    });
  });

  it('văn bản dài → đọc 300 ký tự đầu và báo còn dài', () => {
    const info = describeQr('a'.repeat(400));
    expect(info.kind).toBe('Text');
    expect(info.speech).toBe(Strings.qr.text('a'.repeat(300) + Strings.qr.truncated));
  });
});
