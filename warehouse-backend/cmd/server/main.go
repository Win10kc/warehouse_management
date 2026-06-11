package main

import (
	"log"

	"warehouse-backend/config"
	"warehouse-backend/internal/handler"
	"warehouse-backend/internal/middleware"
	"warehouse-backend/internal/repository"
	"warehouse-backend/internal/service"
	ws "warehouse-backend/internal/websocket"
	"warehouse-backend/pkg/database"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	db := database.NewPostgres(cfg)
	rdb := database.NewRedis(cfg)

	// ── WebSocket Hub ──────────────────────────────────────
	hub := ws.NewHub()
	go hub.Run()

	// ── Repositories ──────────────────────────────────────
	userRepo        := repository.NewUserRepository(db)
	adminSvc := service.NewAdminService(userRepo)
	productRepo     := repository.NewProductRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	warehouseRepo   := repository.NewWarehouseRepository(db)
	zoneRepo        := repository.NewZoneRepository(db)
	rackRepo        := repository.NewRackRepository(db)
	binRepo         := repository.NewBinRepository(db)
	productRequestRepo := repository.NewProductRequestRepository(db)
	stockRepo       := repository.NewStockRepository(db)
	transactionRepo := repository.NewTransactionRepository(db)

	// ── Services ──────────────────────────────────────────
	authSvc        := service.NewAuthService(userRepo, rdb, cfg)
	productSvc     := service.NewProductService(productRepo)
	supplierSvc := service.NewSupplierService(supplierRepo)
	warehouseSvc   := service.NewWarehouseService(warehouseRepo)
	zoneSvc        := service.NewZoneService(zoneRepo)
	rackSvc        := service.NewRackService(rackRepo)
	binSvc := service.NewBinService(binRepo, db)
	alertSvc       := service.NewAlertService(hub)
	transactionSvc := service.NewTransactionService(
		transactionRepo,
		stockRepo,
		productRepo,
		binRepo,
		hub,
		alertSvc,
	)

	// ── Handlers ──────────────────────────────────────────
	authH        := handler.NewAuthHandler(authSvc)
	adminH := handler.NewAdminHandler(adminSvc) 
	reportH := handler.NewReportHandler(transactionRepo)
	productH     := handler.NewProductHandler(productSvc)
	supplierH := handler.NewSupplierHandler(supplierSvc)
	warehouseH   := handler.NewWarehouseHandler(warehouseSvc, zoneSvc, rackSvc, binSvc)
	transactionH := handler.NewTransactionHandler(transactionSvc)
	stockH := handler.NewStockHandler(
		stockRepo,
		transactionSvc,
	)
	productRequestH := handler.NewProductRequestHandler(productRequestRepo, hub)

	// ── Router ────────────────────────────────────────────
	r := gin.Default()

	// 1. FIX CẢNH BÁO: Chỉ tin tưởng localhost và IP mạng nội bộ của bạn
	r.SetTrustedProxies([]string{"127.0.0.1", "192.168.110.179", "192.168.1.0/24"})

	// 2. FIX LỖI 403 OPTIONS: Thêm IP của máy bạn vào AllowOrigins
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://localhost:5174",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:5174",
			"http://192.168.110.179",
		},
		AllowMethods: []string{
			"GET",
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization",
		},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "env": cfg.AppEnv})
	})

	// WebSocket — không cần JWT vì browser WS khó set header
	r.GET("/ws", hub.ServeWS)

	api := r.Group("/api/v1")

	// ── Auth ──────────────────────────────────────────────
	api.POST("/auth/login", authH.Login)
	auth := api.Group("/auth")
	auth.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	auth.GET("/me", authH.Me)

	// ── Products ──────────────────────────────────────────
	products := api.Group("/products")
	products.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	{
		products.GET("", productH.List)
		products.GET("/:id", productH.GetByID)
		products.GET("/scan/:code", productH.GetByCode)
		products.POST("", middleware.RequireRole("admin", "manager"), productH.Create)
		products.PUT("/:id", middleware.RequireRole("admin", "manager"), productH.Update)
		products.DELETE("/:id", middleware.RequireRole("admin"), productH.Delete)
		products.POST("/:id/generate-qr", middleware.RequireRole("admin", "manager"), productH.GenerateQR)
	}

// ── Routes ──────────────────────────────────────────
	suppliers := api.Group("/suppliers")
    suppliers.Use(middleware.ValidateJWT(cfg.JWT.Secret))
    {
       suppliers.GET("",     supplierH.List)
       suppliers.GET("/:id", supplierH.GetByID)
       suppliers.POST("",    middleware.RequireRole("admin", "manager"), supplierH.Create)
       suppliers.PUT("/:id", middleware.RequireRole("admin", "manager"), supplierH.Update)
       suppliers.DELETE("/:id", middleware.RequireRole("admin"), supplierH.Delete)
   	}


	// ── Warehouses ────────────────────────────────────────
	wh := api.Group("/warehouses")
	wh.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	{
		wh.GET("", warehouseH.List)
		wh.GET("/:id", warehouseH.GetByID)
		wh.POST("", middleware.RequireRole("admin", "manager"), warehouseH.Create)
		wh.PUT("/:id", middleware.RequireRole("admin", "manager"), warehouseH.Update)
		wh.DELETE("/:id", middleware.RequireRole("admin"), warehouseH.Delete)

		wh.GET("/:id/zones", warehouseH.ListZones)
		wh.POST("/:id/zones", middleware.RequireRole("admin", "manager"), warehouseH.CreateZone)
		wh.PUT("/:id/zones/:zoneId", middleware.RequireRole("admin", "manager"), warehouseH.UpdateZone)
		wh.DELETE("/:id/zones/:zoneId", middleware.RequireRole("admin"), warehouseH.DeleteZone)

		wh.GET("/:id/zones/:zoneId/racks", warehouseH.ListRacks)
		wh.POST("/:id/zones/:zoneId/racks", middleware.RequireRole("admin", "manager"), warehouseH.CreateRack)
		wh.PUT("/:id/zones/:zoneId/racks/:rackId", middleware.RequireRole("admin", "manager"), warehouseH.UpdateRack)
		wh.DELETE("/:id/zones/:zoneId/racks/:rackId", middleware.RequireRole("admin"), warehouseH.DeleteRack)

		wh.GET("/:id/zones/:zoneId/racks/:rackId/bins", warehouseH.ListBins)
		wh.POST("/:id/zones/:zoneId/racks/:rackId/bins", middleware.RequireRole("admin", "manager"), warehouseH.CreateBin)
		wh.PUT("/:id/zones/:zoneId/racks/:rackId/bins/:binId", middleware.RequireRole("admin", "manager"), warehouseH.UpdateBin)
		wh.DELETE("/:id/zones/:zoneId/racks/:rackId/bins/:binId", middleware.RequireRole("admin"), warehouseH.DeleteBin)
	}

	// ── Stock (Sprint 2) ──────────────────────────────────
	stock := api.Group("/stock")
	stock.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	{
    stock.GET("", stockH.ListSummaries)
    stock.GET("/locations", stockH.ListByBin)
    stock.GET("/:productId", stockH.GetByProduct)

    stock.POST("/count", stockH.StockCount)
	}
	// ── Report (Sprint 5.4) ──────────────────────────────────
	reports := api.Group("/reports")
	reports.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	reports.Use(middleware.RequireRole("admin", "manager"))
	{
    	reports.GET("/products", reportH.ProductsSKU)
	}

	// ── Transactions (Sprint 2) ───────────────────────────
	tx := api.Group("/transactions")
	tx.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	{
		tx.GET("", transactionH.List)
		tx.GET("/:id", transactionH.GetByID)
		tx.POST("", transactionH.Create)
		tx.PUT("/:id/approve", middleware.RequireRole("admin", "manager"), transactionH.Approve)
		tx.PUT("/:id/complete", transactionH.Complete, )
		tx.PUT("/:id/reject", middleware.RequireRole("admin", "manager"), transactionH.Reject)
		tx.PUT("/:id/suggest-bin", middleware.RequireRole("admin", "manager"), transactionH.SuggestBin)
		tx.PUT("/:id/apply-bin",   middleware.RequireRole("admin", "manager"), transactionH.ApplyBin)
	}
	// ── Admin (Sprint 5.2)
	admin := api.Group("/admin")
	admin.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	admin.Use(middleware.RequireRole("admin"))
	{
    	admin.GET("/users",            adminH.ListUsers)
    	admin.POST("/users",           adminH.CreateUser)
    	admin.PUT("/users/:id",        adminH.UpdateUser)
    	admin.PUT("/users/:id/disable", adminH.DisableUser)
    	admin.PUT("/users/:id/enable",  adminH.EnableUser)
	}

	// ── Product Requests ──────────────────────────────────────
	pr := api.Group("/product-requests")
	pr.Use(middleware.ValidateJWT(cfg.JWT.Secret))
	{
	    pr.POST("", productRequestH.Create)                                                          // warehouse gửi báo cáo
	    pr.GET("", middleware.RequireRole("admin", "manager"), productRequestH.List)                 // admin xem
	    pr.PUT("/:id/resolve", middleware.RequireRole("admin", "manager"), productRequestH.Resolve)  // admin resolve
 	   pr.PUT("/:id/reject",  middleware.RequireRole("admin", "manager"), productRequestH.Reject)   // admin reject
	}

	log.Printf("Server starting on port %s", cfg.AppPort)
	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}