package expo.modules.phonecall

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tự quay số cho SOS (ACTION_CALL) — `tel:` qua Linking chỉ mở trình quay số, người khiếm thị vẫn
 * phải tự tìm nút gọi. Cần quyền CALL_PHONE (JS xin trước). Android không cho ACTION_CALL gọi số
 * khẩn cấp (112, 115…) → JS dùng `dial` cho các số đó.
 */
class PhoneCallModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PhoneCall")

    Function("call") { number: String -> start(Intent.ACTION_CALL, number) }

    Function("dial") { number: String -> start(Intent.ACTION_DIAL, number) }
  }

  private fun start(action: String, number: String) {
    val context = appContext.currentActivity ?: appContext.reactContext
      ?: throw IllegalStateException("No Android context")
    val intent = Intent(action, Uri.fromParts("tel", number, null))
    if (appContext.currentActivity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
