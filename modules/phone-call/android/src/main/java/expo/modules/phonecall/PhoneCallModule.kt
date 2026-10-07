package expo.modules.phonecall

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tự quay số cho SOS — `tel:` qua Linking chỉ mở trình quay số, người khiếm thị vẫn phải tự tìm nút
 * gọi. Không dùng Intent ACTION_CALL/ACTION_DIAL trần: app khác (Zalo…) cũng nhận intent đó nên
 * Android hiện hộp "chọn ứng dụng" — người khiếm thị kẹt ở đó. Đi thẳng qua TelecomManager.
 * Android không cho tự gọi số khẩn cấp (112, 115…) → JS dùng `dial` cho các số đó.
 */
class PhoneCallModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PhoneCall")

    // Cần CALL_PHONE (JS xin trước); thiếu quyền → SecurityException → JS mở trình quay số
    Function("call") { number: String ->
      telecom().placeCall(telUri(number), Bundle())
    }

    // Trình quay số mặc định của máy, điền sẵn số
    Function("dial") { number: String ->
      val intent = Intent(Intent.ACTION_DIAL, telUri(number))
      telecom().defaultDialerPackage?.let { intent.setPackage(it) }
      val context = appContext.currentActivity ?: appContext.reactContext
        ?: throw IllegalStateException("No Android context")
      if (appContext.currentActivity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun telecom(): TelecomManager {
    val context = appContext.reactContext ?: throw IllegalStateException("No Android context")
    return context.getSystemService(TelecomManager::class.java)
  }

  private fun telUri(number: String): Uri {
    // Phòng thủ thêm: chỉ nhận số (có thể có +), chặn mã USSD/MMI (*#…#) dù JS đã lọc
    require(Regex("""^\+?\d{3,15}$""").matches(number)) { "Invalid phone number" }
    return Uri.fromParts("tel", number, null)
  }
}
