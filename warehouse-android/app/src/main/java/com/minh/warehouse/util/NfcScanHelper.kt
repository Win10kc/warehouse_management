package com.minh.warehouse.util

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import java.nio.charset.Charset

object NfcScanHelper {

    fun getAdapter(activity: Activity): NfcAdapter? =
        NfcAdapter.getDefaultAdapter(activity)

    fun enableForegroundDispatch(activity: Activity, adapter: NfcAdapter) {
        val intent = Intent(activity, activity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            activity, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply {
                try { addDataType("*/*") } catch (_: Exception) {}
            },
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
        )
        adapter.enableForegroundDispatch(activity, pendingIntent, filters, null)
    }

    fun disableForegroundDispatch(activity: Activity, adapter: NfcAdapter) {
        adapter.disableForegroundDispatch(activity)
    }

    /**
     * Đọc UID từ tag (dùng cho RFID blank tag hoặc NFC tag không có NDEF).
     * UID là dãy bytes, convert sang hex string — đây là rfid_uid lưu trong DB.
     */
    fun readUid(tag: Tag): String =
        tag.id.joinToString("") { "%02X".format(it) }

    /**
     * Đọc text payload từ NDEF tag (nếu có).
     * Return null nếu không phải NDEF hoặc không đọc được.
     */
    fun readNdefText(tag: Tag): String? {
        val ndef = Ndef.get(tag) ?: return null
        return try {
            ndef.connect()
            val message = ndef.ndefMessage ?: return null
            val payload = message.records.firstOrNull()?.payload ?: return null
            // NDEF Text record: byte đầu là status, byte 1..2 là language code
            val languageCodeLength = payload[0].toInt() and 0x3F
            String(payload, 1 + languageCodeLength, payload.size - 1 - languageCodeLength, Charset.forName("UTF-8"))
        } catch (_: Exception) {
            null
        } finally {
            try { ndef.close() } catch (_: Exception) {}
        }
    }
}