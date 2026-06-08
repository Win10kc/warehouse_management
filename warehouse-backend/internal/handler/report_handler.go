package handler

import (
    "fmt"
    "time"
    "warehouse-backend/internal/repository"
    "warehouse-backend/pkg/response"

    "github.com/gin-gonic/gin"
)

type ReportHandler struct {
    txRepo repository.TransactionRepository
}

func NewReportHandler(txRepo repository.TransactionRepository) *ReportHandler {
    return &ReportHandler{txRepo: txRepo}
}

// GET /api/v1/reports/products?month=2026-05
func (h *ReportHandler) ProductsSKU(c *gin.Context) {
    monthStr := c.Query("month") // format: "2026-05"
    if monthStr == "" {
        now := time.Now()
        monthStr = fmt.Sprintf("%d-%02d", now.Year(), now.Month())
    }

    // Parse tháng → khoảng [đầu tháng, đầu tháng sau)
    t, err := time.Parse("2006-01", monthStr)
    if err != nil {
        response.BadRequest(c, "month phải có dạng YYYY-MM")
        return
    }
    fromDate := t.Format("2006-01-02")
    toDate   := t.AddDate(0, 1, 0).Format("2006-01-02")

    rows, err := h.txRepo.GetSKUReport(fromDate, toDate)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }

    response.OK(c, gin.H{
        "month": monthStr,
        "rows":  rows,
    })
}