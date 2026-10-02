package expo.modules.volumekey

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/** Phát sự kiện "nhấn giữ nút giảm âm lượng" cho JS — chỉ khi JS đang lắng nghe. */
class VolumeKeyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VolumeKey")
    Events(LONG_PRESS)
    OnStartObserving(LONG_PRESS) { active = WeakReference(this@VolumeKeyModule) }
    OnStopObserving(LONG_PRESS) { active = null }
  }

  internal fun emitLongPress() = sendEvent(LONG_PRESS, emptyMap<String, Any>())

  companion object {
    private const val LONG_PRESS = "onLongPress"

    /** Module đang có JS lắng nghe; null → để phím âm lượng hoạt động bình thường. */
    @Volatile
    internal var active: WeakReference<VolumeKeyModule>? = null
  }
}
