import { renderHook } from '@testing-library/react-native';

import { cameraHold, useCameraUser } from './cameraHold';

jest.useFakeTimers();

describe('cameraHold', () => {
  afterEach(() => cameraHold.release());

  it('không có camera dẫn đường → giữ ngay, báo không cần bật lại', async () => {
    await expect(cameraHold.hold()).resolves.toBe(false);
    expect(cameraHold.isHeld()).toBe(true);
    cameraHold.release();
    expect(cameraHold.isHeld()).toBe(false);
  });

  it('camera dẫn đường đang chạy → chờ camera nhả rồi mới trả, báo cần bật lại', async () => {
    const user = await renderHook(() => useCameraUser(true));
    const held = cameraHold.hold();
    await jest.advanceTimersByTimeAsync(400);
    await expect(held).resolves.toBe(true);
    user.unmount();
  });
});
