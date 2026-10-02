package expo.modules.volumekey

import android.content.Context
import android.view.KeyEvent
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityHandler

class VolumeKeyPackage : Package {
  override fun createReactActivityHandlers(activityContext: Context): List<ReactActivityHandler> =
    listOf(VolumeKeyHandler())
}

/**
 * Khi app đang mở: nút tăng/giảm âm lượng KHÔNG đổi âm lượng nữa — mỗi lần nhấn (nhả phím) báo JS
 * để bật/hủy nghe lệnh. Phím tắt của TalkBack (giữ cả hai phím) vẫn chạy vì TalkBack nhận phím
 * trước app.
 */
class VolumeKeyHandler : ReactActivityHandler {
  private fun isVolumeKey(keyCode: Int) =
    keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN

  private fun module() = VolumeKeyModule.active?.get()

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean =
    isVolumeKey(keyCode) && module() != null

  override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean =
    isVolumeKey(keyCode) && module() != null

  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
    if (!isVolumeKey(keyCode)) return false
    val module = module() ?: return false
    if (!event.isCanceled) module.emitPress()
    return true
  }
}
