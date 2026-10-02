package expo.modules.volumekey

import android.content.Context
import android.media.AudioManager
import android.view.KeyEvent
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityHandler

class VolumeKeyPackage : Package {
  override fun createReactActivityHandlers(activityContext: Context): List<ReactActivityHandler> =
    listOf(VolumeKeyHandler(activityContext))
}

/**
 * Nhấn giữ nút giảm âm lượng → báo JS (bật nghe lệnh giọng nói). Phải giữ phím xuống để Android
 * nhận ra nhấn giữ, nên nhấn ngắn được tự giảm âm lượng lại khi nhả phím.
 * Chỉ hoạt động khi app đang mở (sự kiện phím của Activity).
 */
class VolumeKeyHandler(context: Context) : ReactActivityHandler {
  // Lazy: handler được tạo trước Activity.onCreate, lúc đó chưa lấy được system service
  private val audio by lazy { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
  private var longPressed = false

  private fun module() = VolumeKeyModule.active?.get()

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode != KeyEvent.KEYCODE_VOLUME_DOWN || event == null || module() == null) return false
    if (event.repeatCount == 0) {
      longPressed = false
      event.startTracking()
    }
    return true
  }

  override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode != KeyEvent.KEYCODE_VOLUME_DOWN) return false
    val module = module() ?: return false
    longPressed = true
    module.emitLongPress()
    return true
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
    if (keyCode != KeyEvent.KEYCODE_VOLUME_DOWN || module() == null) return false
    if (!longPressed && !event.isCanceled) {
      audio.adjustSuggestedStreamVolume(
        AudioManager.ADJUST_LOWER,
        AudioManager.USE_DEFAULT_STREAM_TYPE,
        AudioManager.FLAG_SHOW_UI,
      )
    }
    longPressed = false
    return true
  }
}
