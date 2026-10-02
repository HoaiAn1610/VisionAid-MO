package expo.modules.volumekey

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference
import kotlin.math.roundToInt

/**
 * Phím âm lượng thành nút ra lệnh giọng nói (khi JS đang lắng nghe), âm lượng media đổi bằng
 * lệnh giọng nói qua `getVolume` / `setVolume` (0..1, luồng STREAM_MUSIC mà TTS dùng).
 */
class VolumeKeyModule : Module() {
  private val audio: AudioManager
    get() = appContext.reactContext!!.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  override fun definition() = ModuleDefinition {
    Name("VolumeKey")
    Events(PRESS)
    OnStartObserving(PRESS) { active = WeakReference(this@VolumeKeyModule) }
    OnStopObserving(PRESS) { active = null }

    Function("getVolume") {
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max
    }

    Function("setVolume") { fraction: Double ->
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      val level = (fraction.coerceIn(0.0, 1.0) * max).roundToInt()
      audio.setStreamVolume(AudioManager.STREAM_MUSIC, level, 0)
      level.toDouble() / max
    }
  }

  internal fun emitPress() = sendEvent(PRESS, emptyMap<String, Any>())

  companion object {
    private const val PRESS = "onPress"

    /** Module đang có JS lắng nghe; null → phím âm lượng hoạt động bình thường. */
    @Volatile
    internal var active: WeakReference<VolumeKeyModule>? = null
  }
}
