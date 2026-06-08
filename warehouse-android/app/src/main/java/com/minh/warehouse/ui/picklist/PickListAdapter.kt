package com.minh.warehouse.ui.picklist

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.minh.warehouse.R
import com.minh.warehouse.data.model.TransactionItemDetail

// ════════════════════════════════════════════════════════════════
// ui/picklist/PickListAdapter.kt
// ════════════════════════════════════════════════════════════════

class PickListAdapter(
    private val onConfirmItem: (TransactionItemDetail) -> Unit,
    private val onUndoItem:    (TransactionItemDetail) -> Unit,
) : ListAdapter<TransactionItemDetail, PickListAdapter.ViewHolder>(DIFF) {

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<TransactionItemDetail>() {
            override fun areItemsTheSame(a: TransactionItemDetail, b: TransactionItemDetail) = a.id == b.id
            override fun areContentsTheSame(a: TransactionItemDetail, b: TransactionItemDetail) =
                a.isConfirmed == b.isConfirmed && a.actualQty == b.actualQty
        }
    }

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvIndex:          TextView = view.findViewById(R.id.tvPickItemIndex)
        val tvProductName:    TextView = view.findViewById(R.id.tvPickItemProduct)
        val tvProductSku:     TextView = view.findViewById(R.id.tvPickItemSku)
        val tvQty:            TextView = view.findViewById(R.id.tvPickItemQty)
        val tvBin:            TextView = view.findViewById(R.id.tvPickItemBin)
        val tvBinWarning:     TextView = view.findViewById(R.id.tvPickItemBinWarning)
        val btnConfirm:       Button   = view.findViewById(R.id.btnPickItemConfirm)
        val btnUndo:          Button   = view.findViewById(R.id.btnPickItemUndo)
        val layoutConfirmed:  View     = view.findViewById(R.id.layoutPickItemConfirmed)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_pick_list, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        val ctx  = holder.itemView.context

        // Index
        holder.tvIndex.text = "${position + 1}"

        // Product info
        holder.tvProductName.text = item.product?.name ?: "Sản phẩm #${item.product_id.take(6)}"
        holder.tvProductSku.text  = "SKU: ${item.product?.sku ?: "—"}"
        holder.tvQty.text         = "Cần lấy: ${item.quantity_requested} ${item.product?.unit ?: ""}"

        // Bin đề xuất
        val suggestedBin = item.suggested_bin
        if (suggestedBin != null) {
            holder.tvBin.text       = "📍 ${suggestedBin.displayName()}"
            holder.tvBin.visibility = View.VISIBLE
            holder.tvBinWarning.visibility = View.GONE
        } else {
            holder.tvBin.visibility        = View.GONE
            holder.tvBinWarning.visibility = View.VISIBLE
            holder.tvBinWarning.text       = "⚠ Chưa có bin gợi ý — liên hệ quản lý"
        }

        // Confirmed state
        if (item.isConfirmed) {
            holder.layoutConfirmed.visibility = View.VISIBLE
            holder.btnConfirm.visibility      = View.GONE
            holder.btnUndo.visibility         = View.VISIBLE
            holder.itemView.alpha             = 0.7f
            holder.itemView.setBackgroundColor(
                ContextCompat.getColor(ctx, android.R.color.holo_green_light).let {
                    // Lighter tint
                    0x1A00C853.toInt()
                }
            )
        } else {
            holder.layoutConfirmed.visibility = View.GONE
            holder.btnConfirm.visibility      = View.VISIBLE
            holder.btnUndo.visibility         = View.GONE
            holder.itemView.alpha             = 1f
            holder.itemView.setBackgroundColor(
                ContextCompat.getColor(ctx, android.R.color.white)
            )
        }

        holder.btnConfirm.setOnClickListener { onConfirmItem(item) }
        holder.btnUndo.setOnClickListener    { onUndoItem(item) }
    }
}