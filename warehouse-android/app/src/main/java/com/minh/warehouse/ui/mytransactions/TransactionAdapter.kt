package com.minh.warehouse.ui.mytransactions

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.minh.warehouse.R
import com.minh.warehouse.data.model.TransactionSummary
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

// ─── List item types ──────────────────────────────────────────
private const val TYPE_HEADER = 0
private const val TYPE_ITEM   = 1

// ─── Sealed list entry ────────────────────────────────────────
private sealed class ListEntry {
    data class Header(val label: String) : ListEntry()
    data class Item(val tx: TransactionSummary) : ListEntry()
}

class TransactionAdapter(
    private var items: List<TransactionSummary>
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private var entries: List<ListEntry> = buildEntries(items)

    // ── ViewHolders ──────────────────────────────────────────
    inner class HeaderVH(v: View) : RecyclerView.ViewHolder(v) {
        val tvLabel: TextView = v.findViewById(R.id.tvDateLabel)
    }

    inner class ItemVH(v: View) : RecyclerView.ViewHolder(v) {
        val tvCode     : TextView     = v.findViewById(R.id.tvCode)
        val tvStatus   : TextView     = v.findViewById(R.id.tvStatus)
        val tvType     : TextView     = v.findViewById(R.id.tvType)
        val tvDate     : TextView     = v.findViewById(R.id.tvDate)
        val tvNote     : TextView     = v.findViewById(R.id.tvNote)
        val llProducts : LinearLayout = v.findViewById(R.id.llProducts)
    }

    // ── Adapter overrides ────────────────────────────────────
    override fun getItemViewType(position: Int) = when (entries[position]) {
        is ListEntry.Header -> TYPE_HEADER
        is ListEntry.Item   -> TYPE_ITEM
    }

    override fun getItemCount() = entries.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == TYPE_HEADER) {
            HeaderVH(inflater.inflate(R.layout.item_date_header, parent, false))
        } else {
            ItemVH(inflater.inflate(R.layout.item_transaction, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val entry = entries[position]) {
            is ListEntry.Header -> bindHeader(holder as HeaderVH, entry)
            is ListEntry.Item   -> bindItem(holder as ItemVH, entry.tx)
        }
    }

    // ── Bind header ──────────────────────────────────────────
    private fun bindHeader(h: HeaderVH, entry: ListEntry.Header) {
        h.tvLabel.text = entry.label
    }

    // ── Bind item ────────────────────────────────────────────
    private fun bindItem(h: ItemVH, tx: TransactionSummary) {
        val ctx = h.itemView.context
        val needsAttention = tx.status == "pending" || tx.status == "processing"

        // Card highlight nếu cần xử lý
        h.itemView.setBackgroundResource(
            if (needsAttention) R.drawable.bg_transaction_pending
            else R.drawable.bg_transaction_normal
        )

        h.tvCode.text = tx.code

        val (label, color) = when (tx.status) {
            "pending"    -> "Chờ duyệt"  to "#F59E0B"
            "processing" -> "Đang xử lý" to "#2563EB"
            "done"       -> "Hoàn tất"   to "#16A34A"
            "rejected"   -> "Từ chối"    to "#DC2626"
            else         -> tx.status    to "#6B7280"
        }
        h.tvStatus.text = label
        h.tvStatus.backgroundTintList =
            android.content.res.ColorStateList.valueOf(Color.parseColor(color))

        h.tvType.text = when (tx.type) {
            "import"   -> "📥 Nhập kho"
            "export"   -> "📤 Xuất kho"
            "transfer" -> "🔄 Chuyển vị trí"
            "count"    -> "📋 Kiểm kê"
            else       -> tx.type
        }

        // Hiện giờ tạo, và nếu có completed_at thì hiện thêm
        val createdStr = formatTime(tx.created_at)
        val completedStr = tx.completed_at?.let { " · Hoàn tất ${formatTime(it)}" } ?: ""
        h.tvDate.text = "🕐 $createdStr$completedStr"

        if (!tx.note.isNullOrBlank()) {
            h.tvNote.visibility = View.VISIBLE
            h.tvNote.text = "📝 ${tx.note}"
        } else {
            h.tvNote.visibility = View.GONE
        }

        // ── Danh sách sản phẩm ──
        h.llProducts.removeAllViews()
        val txItems = tx.items ?: emptyList()

        if (txItems.isEmpty()) {
            h.llProducts.addView(makeRow(ctx, "— Không có sản phẩm —", muted = true))
        } else {
            txItems.forEach { item ->
                val name = item.product?.name ?: "SP #${item.product_id.take(6).uppercase()}"
                val sku  = item.product?.sku?.let { " · $it" } ?: ""

                // Nếu phiếu done và có actual → hiện cả 2
                val qtyText = if (tx.status == "done" && (item.quantity_actual ?: 0) > 0) {
                    "×${item.quantity_actual} (yêu cầu ${item.quantity_requested})"
                } else {
                    "×${item.quantity_requested}"
                }

                val binLabel = when (tx.type) {
                    "import"   -> item.to_bin?.displayName()?.let { " → $it" } ?: ""
                    "export"   -> item.from_bin?.displayName()?.let { " ← $it" } ?: ""
                    "transfer" -> buildString {
                        item.from_bin?.displayName()?.let { append(" $it") }
                        item.to_bin?.displayName()?.let { append(" → $it") }
                    }
                    "count"    -> item.to_bin?.displayName()?.let { " [bin: $it]" } ?: ""
                    else -> ""
                }

                h.llProducts.addView(makeRow(ctx, "• $name$sku  $qtyText$binLabel"))
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────
    private fun makeRow(ctx: android.content.Context, text: String, muted: Boolean = false) =
        TextView(ctx).apply {
            this.text = text
            textSize  = 13f
            setTextColor(
                if (muted) Color.parseColor("#9CA3AF")
                else ctx.getColor(R.color.wh_text_primary)
            )
            setPadding(0, 3, 0, 3)
        }

    private fun formatTime(raw: String): String = try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val date = sdf.parse(raw.take(19))
        SimpleDateFormat("HH:mm dd/MM", Locale.getDefault()).format(date!!)
    } catch (e: Exception) { raw.take(10) }

    fun update(newItems: List<TransactionSummary>) {
        items   = newItems
        entries = buildEntries(newItems)
        notifyDataSetChanged()
    }

    // ── Build grouped entries ────────────────────────────────
    companion object {
        private fun buildEntries(items: List<TransactionSummary>): List<ListEntry> {
            if (items.isEmpty()) return emptyList()

            // Sort: pending/processing lên trước trong cùng ngày, sau đó theo created_at desc
            val sorted = items.sortedWith(
                compareByDescending<TransactionSummary> { dateKey(it.created_at) }
                    .thenBy { statusPriority(it.status) }
                    .thenByDescending { it.created_at }
            )

            val result = mutableListOf<ListEntry>()
            var lastDateKey = ""

            sorted.forEach { tx ->
                val key = dateKey(tx.created_at)
                if (key != lastDateKey) {
                    result.add(ListEntry.Header(dateLabel(tx.created_at)))
                    lastDateKey = key
                }
                result.add(ListEntry.Item(tx))
            }
            return result
        }

        // pending=0, processing=1, rest=2 → pending nổi lên đầu mỗi ngày
        private fun statusPriority(status: String) = when (status) {
            "pending"    -> 0
            "processing" -> 1
            else         -> 2
        }

        private fun dateKey(raw: String): String = raw.take(10) // "yyyy-MM-dd"

        private fun dateLabel(raw: String): String {
            return try {
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val date = sdf.parse(raw.take(10)) ?: return raw.take(10)

                val today = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
                }.time
                val yesterday = Calendar.getInstance().apply {
                    add(Calendar.DATE, -1)
                    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
                }.time

                when {
                    date >= today     -> "Hôm nay"
                    date >= yesterday -> "Hôm qua"
                    else -> SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(date)
                }
            } catch (e: Exception) { raw.take(10) }
        }
    }
}