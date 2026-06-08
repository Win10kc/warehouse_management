
## 21/06
Docker Desktop trên Windows chạy bên trong WSL 2 (Windows Subsystem for Linux). Lỗi xảy ra vì WSL bị treo hoặc kernel cũ chưa tương thích với phiên bản Docker. wsl --update cập nhật kernel Linux bên trong, wsl --shutdown tắt hẳn WSL để khởi động lại sạch. 


PS C:\Users\Minh\quan_ly_kho_2\warehouse-backend> docker exec -i warehouse_postgres psql -U warehous e_user -d warehouse_db < migrations\001_init.sql
chạy lệnh kiểu Linux (< file.sql) trong PowerShell nên bị lỗi.
Dùng Get-Content trong PowerShell 

Lỗi Go — "no required module provides package"
Đây là lỗi packages chưa được tải về máy. Nguyên nhân: lệnh go get ở bước trước phải chạy bên trong thư mục chứa go.mod, tức là warehouse-backend. Nếu lúc đó bạn đang ở thư mục khác thì các package không được ghi vào đúng go.mod của project.



Lỗi dial tcp: lookup proxy.golang.org nghĩa là máy bạn không kết nối được đến proxy.golang.org — đây là server trung gian mà Go dùng để tải packages. Nguyên nhân phổ biến nhất ở Việt Nam: tường lửa hoặc ISP chặn domain này, hoặc DNS không phân giải được. 


Lỗi uni_users_username không tồn tại xảy ra vì conflict giữa migration SQL thủ công và GORM AutoMigrate:
File 001_init.sql bạn đã chạy tạo bảng users với constraint tên khác (hoặc không có tên uni_users_username)
GORM AutoMigrate đọc struct domain.User thấy tag uniqueIndex, cố xóa constraint cũ để tạo lại → không tìm thấy → crash
Cách fix nhanh nhất — bỏ AutoMigrate trong development vì DB đã có schema từ SQL migration

## 22/05/2026
Danh sách công việc đã thực hiện
Viết Auth API: Hoàn thành — repository, service, handler cho đăng nhập (JWT + bcrypt) và xem thông tin tài khoản; middleware xác thực token và phân quyền theo 3 role
Viết CRUD Products: Hoàn thành — đầy đủ các thao tác thêm/sửa/xóa/xem danh sách sản phẩm, tìm kiếm theo tên/SKU, lọc theo danh mục, tra cứu bằng mã QR/RFID
Kết nối các thành phần vào server: Hoàn thành — cập nhật file khởi động server, đăng ký toàn bộ API endpoint, phân quyền từng route theo role
Cài Air (hot reload): Hoàn thành về cấu hình — tuy nhiên phát hiện lỗi trên Windows (PowerShell không nhận tmp\main.exe thiếu .\); tạm thời dùng go run thay thế, vẫn đảm bảo phát triển bình thường
Test API: Hoàn thành — đã xác định và sửa 3 lỗi liên tiếp:
Lỗi build: thiếu package github.com/golang-jwt/jwt/v5 → fix bằng go get sau khi đổi GOPROXY
Lỗi 400: Thunder Client thiếu header Content-Type: application/json
Lỗi 401: Hash bcrypt trong seed SQL không khớp với Admin@123 → re-generate hash và UPDATE trực tiếp trong DB
Kết quả test: POST /api/v1/auth/login trả về 200 OK với JWT access token và refresh token

Khó khăn
GOPROXY mặc định (goproxy.io) không truy cập được từ mạng hiện tại → đã fix bằng go env -w GOPROXY="https://goproxy.cn,direct"
Air không chạy được trên Windows do PowerShell không nhận đường dẫn tương đối tmp\main.exe → cần thêm .\ vào bin và entrypoint trong [build.windows] của .air.toml; tạm thời dùng go run ./cmd/server/main.go
Seed password sai trong migrations/001_init.sql — hash hardcode không khớp với Admin@123 → cần generate lại hash đúng khi reset DB

Dự kiến công việc ngày 23/05/2026
Fix .air.toml cho Windows — sửa bin và entrypoint trong [build.windows] thành ".\tmp\main.exe" để Air hoạt động bình thường
CRUD Warehouse / Zone / Rack / Bin — theo đúng pattern: repository → service → handler → đăng ký route trong main.go; ưu tiên Bin vì cần cho phiếu nhập/xuất sau này
Frontend trang Login — gọi POST /api/v1/auth/login, lưu JWT vào localStorage, redirect sang dashboard
Test toàn bộ API Auth + Products bằng Thunder Client sau khi hoàn thành các bước trên


## 23/05/2026
Danh sách công việc đã thực hiện
Sprint 1 — Hoàn thành
Auth API & Bảo mật
JWT login/logout với bcrypt password hashing, refresh token
Middleware phân quyền 3 role: admin / manager / warehouse
CRUD Sản phẩm
List (pagination + search + filter), Get by ID, Create, Update, soft-delete
Tra cứu nhanh bằng mã QR hoặc RFID (GET /products/scan/:code)
CRUD Vị trí kho (4 cấp)
Warehouse → Zone → Rack → Bin, nested routes REST chuẩn
Fix GORM column mapping: RFIDuid → tag gorm:"column:rfid_uid" (cả products và bins)
Fix handler inject path param vào request struct trước khi validate (WarehouseID, ZoneID, RackID)
Frontend scaffold
Vite + React 18 + TailwindCSS, Login page gọi API, lưu JWT qua Zustand, redirect dashboard
Infrastructure
Docker Compose: PostgreSQL 17 + Redis 7
11 bảng migration, seed account admin
Air hot-reload cấu hình Windows

Sprint 2 — Hoàn thành hôm nay
Domain & Schema
Thêm StockItem domain, thêm json tags toàn bộ struct (response về snake_case)
Luồng Nhập/Xuất kho
POST /api/v1/transactions — tạo phiếu (pending)
PUT /:id/approve — duyệt (pending → processing)
PUT /:id/complete — hoàn tất, ghi stock_summary + stock_items trong 1 DB transaction (processing → done)
PUT /:id/reject — từ chối
GET /api/v1/stock — danh sách tồn kho toàn bộ sản phẩm
GET /api/v1/stock/:productId — tồn kho chi tiết theo bin
WebSocket real-time
Hub/Client pattern với goroutine, auto-reconnect từ frontend
Broadcast stock_update event sau mỗi lần complete transaction
Broadcast alert event khi tồn kho ≤ min_stock
Alert Service
Level warning: tồn kho ≤ min_stock
Level critical: tồn kho ≤ min_stock/2 hoặc = 0

Khó khăn & cách giải quyết
Vấn đề
Nguyên nhân
Giải pháp
column "rf_iduid" does not exist
GORM auto snake_case sai với RFIDuid
Thêm gorm:"column:rfid_uid" explicit
Zone create 400 validation fail
Gin validate binding trước khi inject path param
Bỏ binding:"required" trên ID fields, inject sau ShouldBindJSON
Response PascalCase ("ID", "Name")
Domain struct thiếu json tags
Thêm đầy đủ json:"..." tags toàn bộ domain
Create rack/bin lỗi ẩn
Service wrap lỗi thành string cứng
Trả về err thật thay vì errors.New("could not create...") khi dev


Dự kiến 26/05/2026 — Sprint 2 Phần 2 (Frontend)
Hook useSocket kết nối WebSocket, auto-reconnect
stockStore Zustand cập nhật real-time
Trang tạo phiếu Nhập/Xuất (TransactionCreatePage)
Component AlertBadge hiển thị cảnh báo tồn kho thấp

## 26/05/2026
Chuyển đổi môi trường Docker → Native Windows: cài PostgreSQL 17 (Windows Service), Memurai (Redis-compatible), thêm psql vào PATH vĩnh viễn; backend kết nối localhost không cần cấu hình lại.
Khắc phục lỗi type mismatch backend: đổi QRCode/RFIDuid trong domain/product.go từ string sang *string, thêm emptyToNil() trong product_service.go để tránh UNIQUE constraint khi tạo sản phẩm không có QR/RFID.
Khắc phục go.mod: chuyển gin-contrib/cors và gorilla/websocket từ indirect sang direct dependency.
Khắc phục lỗi bcrypt 401: sinh lại hash chuẩn 60 ký tự cho tài khoản admin, cập nhật vào cơ sở dữ liệu; login admin / Admin@123 trả về 200 OK với access_token.
Khắc phục frontend axios baseURL: chuẩn hóa VITE_API_URL + /api/v1 để tránh API call sai path.
Khắc phục LoginPage: cập nhật đọc đúng trường access_token từ response và redirect chuẩn xác về /transactions sau khi đăng nhập thành công.
Khắc phục GORM table name mismatch: Bảng StockSummary bị GORM tự động pluralize sai thành stock_summaries; đã xử lý bằng cách thêm func (StockSummary) TableName() string { return "stock_summary" } vào domain/product.go.
Verify luồng nhập kho end-to-end thành công: POST transaction import → approve → complete. API GET /stock/:id trả về total_quantity tăng chính xác và WebSocket broadcast sự kiện stock_update thành công.
Hoàn thành test tính năng quét mã QR và thẻ RFID, hệ thống nhận diện và xử lý chính xác dữ liệu từ mã.
Khó khăn:
Bcrypt hash trong cơ sở dữ liệu bị sai lệch dù migration đã chạy (do lỗi ký tự khi copy/paste vào terminal); đã giải quyết bằng cách sinh lại hash thông qua gen_hash.go và update trực tiếp qua giao diện psql.
Lỗi stock_summary trả về 404 với product mới tạo vì chưa có transaction hoàn tất (đây là behavior đúng của hệ thống); đã fix tạm bằng cách INSERT seed row, dữ liệu sẽ tự sinh chuẩn sau giao dịch đầu tiên.
Dự kiến 27/05/2026
Kiểm thử toàn diện luồng xuất kho: export transaction → ghi nhận stock giảm → tự động kích hoạt alert khi tồn kho ≤ min_stock.
Kiểm thử hiển thị toast cảnh báo real-time trên giao diện frontend (thông qua component AlertBadge).
Tổng kết Sprint 2 và chính thức lên kế hoạch triển khai Sprint 3 (Tiếp tục tích hợp Android app quét QR/RFID, đồng bộ Offline-first sync).


## 27/05/2026
Công việc đã thực hiện
1. Fix môi trường Android build (tiếp nối tồn đọng từ 26/05)
Xác định Android Studio chỉ hỗ trợ tối đa AGP 8.6.1, hạ từ 8.9.1 xuống 8.6.1.
Ghim toàn bộ dependencies về version cũ (activity-ktx:1.9.3, fragment-ktx:1.8.5, lifecycle:2.8.7, camera:1.3.4) để tránh kéo transitive deps yêu cầu AGP 8.9.
Giữ compileSdk=36, targetSdk=34 để tương thích thiết bị Android 16.
Build thành công, không còn AAR conflict.
2. Kết nối thiết bị và chạy app lần đầu
Pair Samsung Galaxy M35 (Android 16) qua Wireless Debugging trên cùng WiFi 192.168.110.x, không cần cáp USB.
Deploy và chạy app thành công trên thiết bị thực.
3. Viết LoginActivity + LoginViewModel
Phát hiện file LoginActivity.java là Java stub rỗng do Android Studio tự sinh — xóa và viết lại bằng Kotlin.
Implement flow: kiểm tra token còn hạn → nếu có thì vào thẳng MainActivity, nếu không thì hiển thị form login.
LoginViewModel gọi API POST /api/v1/auth/login, lưu token vào DataStore qua TokenManager.
Fix crash: theme mặc định Material3 không tương thích AppCompatActivity — đổi sang Theme.AppCompat.Light.NoActionBar.
Fix lỗi NumberFormatException: model UserInfo.id khai báo Int nhưng backend trả UUID string — đổi thành String.
Đăng nhập thành công với tài khoản admin.
4. Viết MainActivity
Rewrite từ Jetpack Compose (template mặc định, không có deps) sang View-based.
Có nút "Quét QR" điều hướng sang ScanActivity và nút "Đăng xuất" xóa token rồi về LoginActivity.
5. Sprint 3 Phần 2C — Tích hợp NFC/RFID vào ScanActivity
Viết NfcScanHelper: enable/disable foreground dispatch, đọc NDEF text payload, fallback đọc UID hex cho thẻ blank.
Tích hợp vào ScanActivity: cùng một màn hình xử lý cả QR (CameraX + ML Kit) lẫn NFC (onNewIntent).
Hiển thị trạng thái NFC availability trên UI (không có NFC / NFC đang tắt / sẵn sàng).
Fix crash khi mở ScanActivity: thiếu runtime permission CAMERA — thêm requestPermissions động.
Fix lỗi compile: layout thực tế dùng tvHint/cardResult khác với code dùng tvStatus/tvResult — rewrite ScanActivity khớp layout.
6. Sprint 3 Phần 2D — TransactionFormActivity (tạo phiếu từ app)
Thêm models: WarehouseListResponse, CreateTransactionRequest, TransactionItemInput, TransactionResponse.
Thêm 2 endpoint vào ApiService: GET /api/v1/warehouses và POST /api/v1/transactions.
Viết TransactionFormActivity: chọn loại phiếu (nhập/xuất), chọn bin từ Spinner, nhập số lượng và ghi chú, submit tạo phiếu.
Viết TransactionFormViewModel: load danh sách bins từ warehouse API, gọi createTransaction với JWT tự động qua AuthInterceptor.
Nối từ ScanActivity: sau khi scan thành công, nhấn "Tạo phiếu" truyền product_id, scan_method sang TransactionFormActivity.
Verify AuthInterceptor đúng — token được đính vào mọi request, không bị 401.

Khó khăn và cách xử lý
Khó khăn
Nguyên nhân
Cách xử lý
AGP version conflict
Android Studio tối đa AGP 8.6.1, deps mới kéo lên 8.9
Ghim deps về version cũ tương thích
App trắng màn hình khi mở
LoginActivity là Java stub rỗng, không có layout
Xóa, viết lại Kotlin đầy đủ
Crash: Theme không tương thích
Material3 theme không dùng được với AppCompatActivity
Đổi sang Theme.AppCompat
Login lỗi NumberFormatException
UserInfo.id khai báo Int nhưng backend trả UUID string
Đổi kiểu thành String
App thoát ngay khi mở ScanActivity
Chưa xin CAMERA permission lúc runtime
Thêm requestPermissions động trước startCamera()
Lỗi compile Unresolved reference tvStatus
Layout và code dùng tên View khác nhau
Rewrite ScanActivity khớp với layout thực tế


Tồn đọng / Dự kiến 28/05/2026
Test E2E flow tạo phiếu: Login → Scan QR → Tạo phiếu → verify trên backend (cần backend đang chạy).
Debug ScanActivity vẫn thoát app khi nhấn — cần lọc logcat theo package:com.minh.warehouse để xác định crash cụ thể.
Test NFC thực tế với thẻ NFC (thẻ blank dùng UID, thẻ có NDEF text).
Sprint 3 Phần 3: Offline-first sync (Room DB, WorkManager, sync queue).
Sprint 4: Dashboard + Recharts + Export PDF/CSV.


##  28/05/2026
Android — Fix bugs & hoàn thiện luồng tạo phiếu:
Fix QR scan crash NumberFormatException: đổi Product.id từ Int → String (backend trả UUID)
Refactor UX vị trí: thay 1 spinner Bin đơn lẻ thành cascade 4 cấp Kho → Zone → Rack → Bin
Test E2E: Login → Scan QR → Tạo phiếu → chọn Kho/Zone/Rack/Bin → submit → POST /api/v1/transactions trả 201 
Phân tích và lên backlog cho các tính năng còn thiếu: màn hình "Phiếu của tôi" (Android), tạo phiếu thủ công nhập SKU, tìm kiếm tồn kho, bin capacity, batch scan, FCM notification.
Offline-first sync (Room DB + WorkManager): Đã implement → sau khi test thực tế xác định không phù hợp với môi trường LAN nội bộ (mất WiFi = mất cả backend lẫn scan) → revert hoàn toàn.
NFC: Code hoàn chỉnh, chưa test thẻ thực tế.

Kế hoạch 29/05/2026 — Sprint 4:
Màn hình "Phiếu của tôi" trên Android (effort nhỏ, unblock nhân viên theo dõi trạng thái phiếu)
Tạo phiếu thủ công có thể tìm/nhập SKU (fix bug (SKU: ) + Lỗi 400)
Dashboard + Recharts trên web frontend
Export PDF/CSV

## 29/05/2026
Kết quả công việc đã hoàn thành
Android & Web Frontend (Hoàn thiện Sprint 4)
Màn hình "Phiếu của tôi" (Android): Sửa lỗi trắng màn hình bằng cách cấu hình lại Logcat debug package hệ thống và xử lý ApiClient.kt. Hoàn thiện giao diện danh sách phiếu kèm badge màu trực quan theo trạng thái (pending/processing/done/rejected).
Luồng tạo phiếu thủ công nhập SKU: Giải quyết triệt để lỗi 400 và lỗi trống tên/SKU bằng cách tạo mới ProductSearchActivity (hỗ trợ search box với debounce 400ms). Luồng mới hoạt động ổn định: Tìm kiếm -> Chọn sản phẩm (truyền đủ intent extra ID/SKU/Name) -> Mở form -> Submit trả về 201 OK.
Dashboard + Recharts (Web): Xây dựng trang DashboardPage.tsx hoàn chỉnh. Do backend chưa có endpoint thống kê, đã xử lý tính toán stats client-side (tối đa 200 phiếu gần nhất). Hiển thị trực quan qua 5 thẻ trạng thái, biểu đồ cột xu hướng 7 ngày (nhập/xuất/chuyển), biểu đồ tròn phân loại và bảng 5 phiếu hoàn tất gần nhất. Fix lỗi điều hướng nút "← Dashboard".
Export PDF/CSV & Phân quyền: Cập nhật authStore.ts để decode và lưu role từ JWT payload. Sửa lỗi giao diện chữ trắng trên nền trắng của ExportPanel. Phân quyền export rõ ràng: admin và manager được export toàn bộ; nhân viên kho (warehouse) bị ẩn export tại Dashboard, chỉ cho phép export tại danh sách phiếu.
Backend & Hệ thống (Triển khai Sprint 5.1 & 5.2)
Bổ sung thông tin created_by & approved_by đầy đủ:
Backend: Thêm cấu trúc ApprovedBy *User vào domain; bổ sung Preload dữ liệu người tạo/người duyệt trong repository. Hỗ trợ query filter created_by_me=true từ endpoint.
Web & Android: Thêm 2 cột "Người tạo" và "Người duyệt" vào bảng hiển thị trên Web và file export (CSV/PDF). Cập nhật data class phía Android để parse đúng response mới từ API.
Quản lý tài khoản (Admin Operations): * Thống nhất mô hình bảo mật: Chỉ Admin mới có quyền tạo/sửa/đổi trạng thái tài khoản (không mở đăng ký công khai).
Tạo mới admin_service và hệ thống 5 endpoints quản lý user bọc qua middleware RequireRole("admin"). Cài đặt logic chặn Admin tự disable chính mình ở cả frontend lẫn backend.
Hoàn thiện giao diện AdminUsersPage.tsx (bảng user, modal thêm/sửa, toggle trạng thái).
Khó khăn & Vấn đề tồn tại
Dữ liệu Reporting: Việc frontend tự tính toán stats client-side từ endpoint /transactions?limit=200 chỉ là giải pháp tạm thời, không thể làm báo cáo chi tiết theo SKU khi lượng data vượt quá 200 phiếu.
Dữ liệu Android: Model TransactionSummary ban đầu thiếu trường thông tin sản phẩm và người tạo/người duyệt, gây lỗi parse dữ liệu khi nâng cấp API (đã hotfix cập nhật bổ sung UserSummary data class).
Quản lý User: Hàm filter is_active = true mặc định ở repository khiến admin không thể tìm thấy các user đã bị disable để chỉnh sửa (đã xử lý bằng cách viết thêm hàm FindByIDAny).
Kế hoạch ngày tiếp theo (30/05/2026)
Sprint 5.3: Phát triển tính năng xem tồn kho theo vị trí cụ thể (Kho/Zone/Rack/Bin) trên cả hệ thống.
Sprint 5.4: Xây dựng endpoint backend chuyên biệt cho báo cáo: GET /api/v1/reports/products?month=... trả về chi tiết import_qty, export_qty, net_change nhằm thay thế cho logic tính client-side hiện tại và phục vụ export báo cáo theo SKU.
Sprint 5.5: Nghiên cứu và kết nối WebSocket (ws.Hub) phía Android để cập nhật trạng thái phiếu theo thời gian thực (Real-time updates).
Sprint 5.6: Tối ưu UX trên Android, xử lý thông báo và luồng điều hướng thân thiện khi nhân viên quét phải SKU/Sản phẩm không tồn tại (Lỗi 404).

## 30/05/2026
Kết quả công việc:
Backend: Khắc phục hoàn toàn lỗi hiển thị Người tạo/Người duyệt và lỗi CSV undefined bằng cách bổ sung JSON tags cho User domain và thêm Preload("ApprovedBy") tại các repository transaction. Hoàn thiện hệ thống phân quyền Admin, sửa route và PrivateRoute giúp hiển thị đúng menu Quản lý tài khoản.
Web Frontend: Hoàn thành tính năng xem tồn kho theo vị trí với hierarchy Kho → Zone → Rack → Bin, hỗ trợ tìm kiếm, gom nhóm dữ liệu, collapse/expand độc lập và cảnh báo tồn kho thấp. Bổ sung trang quản lý cấu trúc kho với CRUD đầy đủ Warehouse/Zone/Rack/Bin, có xác nhận thao tác và kiểm tra điều kiện xóa.
Backend + Web Frontend: Hoàn thành báo cáo SKU với endpoint /api/v1/reports/products, xử lý thống kê theo tháng, chỉ tính các phiếu đã hoàn tất. Xây dựng giao diện báo cáo SKU hỗ trợ Export CSV/PDF.
Android: Tích hợp WebSocket real-time hoàn chỉnh gồm kết nối sau đăng nhập, tự động reconnect khi mất kết nối, nhận cập nhật tồn kho và cảnh báo hệ thống theo thời gian thực.
Android + Backend + Web Frontend: Hoàn thiện luồng xử lý sản phẩm chưa tồn tại trong hệ thống. Khi quét mã không tìm thấy sản phẩm, nhân viên có thể gửi báo cáo sản phẩm mới từ ứng dụng Android; Admin nhận cảnh báo real-time, xem danh sách báo cáo, tạo SKU mới hoặc từ chối xử lý trên Web.
Hệ thống: Refactor cơ chế phân quyền từ adminOnly sang roles[], tăng khả năng mở rộng cho RBAC trong các Sprint tiếp theo.
Bảo mật và ổn định hệ thống: Bổ sung kiểm tra token hết hạn khi tải từ localStorage, tự động xóa token không hợp lệ; sửa lỗi kết nối WebSocket khi logout/login và lỗi NavBar hiển thị sai trạng thái đăng nhập.
Khó khăn:
Trong quá trình phát triển tính năng tồn kho theo vị trí phát hiện sai lệch thiết kế cơ sở dữ liệu giữa tài liệu và thực tế (table warehouse_bins không tồn tại, cấu trúc thực tế là bins → racks → zones → warehouses), cần điều chỉnh lại truy vấn và mô hình dữ liệu.
Phát hiện vấn đề nghiệp vụ tiềm ẩn liên quan đến hiện tượng "kho âm" trong báo cáo SKU khi số lượng xuất vượt quá số lượng tồn kho thực tế. Hiện đang nghiên cứu giải pháp kiểm soát tại cả giai đoạn tạo phiếu và duyệt phiếu để đảm bảo tính nhất quán dữ liệu.
Kế hoạch 01/06/2026:
Phân tích và triển khai cơ chế chống phát sinh tồn kho âm (negative stock).
Bổ sung kiểm tra số lượng tồn kho khi nhân viên tạo phiếu xuất trên Android/Web, cảnh báo và chặn tạo phiếu nếu vượt quá tồn kho khả dụng.
Bổ sung kiểm tra tồn kho tại bước duyệt phiếu trên Backend, đảm bảo không thể duyệt phiếu xuất khi số lượng tồn kho thực tế không đáp ứng.
Cập nhật giao diện Web để hiển thị cảnh báo thiếu hàng và khóa thao tác duyệt đối với các phiếu không đủ điều kiện xuất kho.
Rà soát lại logic báo cáo SKU và biến động tồn kho nhằm đảm bảo số liệu thống kê phản ánh chính xác trạng thái kho thực tế.

##  01/06/2026
Bug fixes:
Fix lỗi 500 product_requests bằng migration SQL 003_product_requests.sql
Fix bin duplicate key (rfid_uid unique constraint) — không gửi field rỗng lên backend
Fix NavBar hiện khi chưa login — chuyển NavBar vào trong BrowserRouter
Fix handleApprove nuốt lỗi im lặng — thêm try/catch hiện alert lỗi từ server
Tính năng hoàn thiện:
Luồng báo cáo SP mới: gán raw_code làm qr_code khi admin tạo SKU → Android scan được ngay
Stock check khi approve phiếu xuất — chặn nếu tồn kho không đủ
Real-time ProductRequestsPage — tự reload khi nhận WS alert, hiện banner nếu đang ở tab khác
AlertBadge phân biệt 2 loại: toast xanh navy cho product_request, toast đỏ/vàng cho stock alert
NavBar active highlight — link đang active có nền trắng mờ + bold
NavBar màu thống nhất trắng — bỏ màu vàng/cam/xanh lá
Tồn kho vị trí hiện cả bin trống — đổi INNER JOIN → LEFT JOIN trong ListByBin
Dashboard xóa nút "Phiếu kho" và "Đăng xuất" trùng lặp

Kết quả công việc:
Fix các lỗi hệ thống liên quan đến Product Requests, quản lý Bin và xử lý duyệt phiếu.
Hoàn thiện luồng báo cáo sản phẩm mới từ Android đến Web, cho phép Admin tạo SKU và sử dụng ngay mã QR đã báo cáo.
Bổ sung kiểm tra tồn kho khi duyệt phiếu xuất, ngăn chặn trường hợp xuất vượt quá số lượng tồn thực tế.
Nâng cấp hệ thống WebSocket, hỗ trợ cập nhật báo cáo sản phẩm mới theo thời gian thực.
Hoàn thiện trang chi tiết phiếu kho và cải thiện hiển thị vị trí lưu trữ theo cấu trúc Kho → Zone → Rack → Bin.
Khó khăn:
Phát hiện một số vấn đề liên quan đến ràng buộc dữ liệu Bin và hiển thị thông tin vị trí kho, cần điều chỉnh mô hình dữ liệu và truy vấn.
Kế hoạch 02/06/2026:
Kiểm thử và tối ưu luồng xuất kho sau khi bổ sung kiểm tra tồn kho.
Hoàn thiện trang chi tiết phiếu kho.
Nghiên cứu và triển khai các tính năng thuộc Sprint 6.

Tóm tắt công việc bổ sung (chiều 01/06/2026)
4 bug/cải tiến sau Sprint 5:
1. Xóa bin không ẩn khỏi frontend (soft delete lọt qua) ListByRack và FindByID không filter is_active = true → bin đã xóa vẫn được trả về. Fix: thêm AND is_active = true vào cả 2 query.
2. Không tạo lại bin cùng QR sau khi xóa Soft delete giữ qr_code trong DB → unique constraint chặn tạo lại. Đổi sang hard delete (DELETE thay vì UPDATE is_active=false) — an toàn vì service đã check stock_items.quantity > 0 trước khi cho xóa.
3. Nút "Chi tiết" chỉ hiện ở phiếu pending Manager cần xem lịch sử phiếu đã hoàn tất. Fix: chuyển "Chi tiết →" thành link-style nằm dưới mã phiếu, luôn hiện với mọi status, giải phóng cột Thao tác chỉ còn action buttons (Duyệt / Từ chối / Hoàn tất).
4. Action buttons hiện với cả warehouse role Duyệt/Từ chối/Hoàn tất trước đó không check role ở frontend. Thêm guard role === 'admin' || role === 'manager' vào render condition — khớp với phân quyền backend.

## 02/06/2026
Tóm tắt công việc sáng nay
Vấn đề 1 — Android "Phiếu của tôi" chỉ hiện ID sản phẩm: Nguyên nhân: TransactionItemDetail thiếu nested product object. Backend trả về "product": {"name":...} nhưng Android chỉ map product_name: String? flat → luôn null. Fix: thêm ProductSummary data class và đọc item.product?.name.
Vấn đề 2 — Android không real-time khi web thao tác: Có 2 bug chồng nhau:
WebSocketManager parse sai key — backend gửi "event" và "data" nhưng Android đọc "type" và "payload" → không event nào được xử lý, kể cả stock_update và alert vốn đã có từ trước.
MyTransactionsViewModel không lắng nghe WS → không tự reload khi phiếu thay đổi trạng thái.
Fix: sửa key parse, thêm EventTransactionUpdate vào backend (hub.go + publish trong Approve/Reject/Complete), thêm WS listener trong init {} của ViewModel.
Đánh giá hệ thống so với task: Core đáp ứng đủ — xuất/nhập kho, quản lý vị trí, tồn kho + cảnh báo, QR/RFID, web + Android đều có. Còn thiếu 2 điểm quan trọng: deployment Linux (yêu cầu bắt buộc của task, Sprint 6.12) và kiểm kê định kỳ (bắt buộc với kho thực tế, Sprint 6.6).
Kể từ khi bạn chuyển sang máy Ubuntu 24.04 và bắt đầu triển khai Ưu tiên 2 (Sprint 6.12), chúng ta đã hoàn thành các đầu việc cực kỳ quan trọng sau:
Fix lỗi CORS (403 OPTIONS): Cấu hình gin-contrib/cors để Backend Go cho phép Frontend gọi API qua địa chỉ IP mạng LAN (192.168.110.179).
Chuẩn hóa Database & Script:
Sửa lỗi xác thực PostgreSQL trong script Bash (PGPASSWORD).
Fix lỗi schema trong seed.sh (thêm cột full_name, chuẩn hóa bcrypt hash).
Fix lỗi Frontend Production: Sửa 3 lỗi TypeScript trong DashboardPage.tsx để quá trình pnpm build tạo ra thư mục dist thành công.
Cấu hình Nginx Reverse Proxy:
Giải phóng cổng 80 (tắt Apache2).
Cấu hình Nginx serve Frontend (Static files) và Proxy ngược API/WebSocket về Backend Go (port 8080).
Fix lỗi Permission denied (500) do Nginx (www-data) không có quyền đọc thư mục /home/minh/....
Tự động hóa triển khai (CI/CD local): Viết thành công bộ 3 script migrate.sh, seed.sh, và deploy.sh.
Kết quả: Hệ thống Warehouse App đã "Productionized" trên Linux, chạy ngầm qua systemd, truy cập mượt mà qua mạng LAN tại http://192.168.110.179.

## 03/06/2026
Kết quả công việc:
- Hoàn thiện Sprint 6.2 (Đề xuất đổi bin): Triển khai toàn diện luồng nghiệp vụ đổi vị trí lưu trữ (Bin) xuyên suốt 4 tầng kiến trúc. Tích hợp API mới ở Backend và đẩy sự kiện real-time qua WebSocket; Cập nhật Frontend React (thêm nút Đổi bin, Modal tìm kiếm và Badge trạng thái); Nâng cấp App Android (Kotlin) nhận gói tin WebSocket và hiển thị thông báo alert tức thời.
- Sửa lỗi biên dịch & Đồng bộ hệ thống: Khắc phục triệt để chuỗi lỗi biên dịch Backend Go liên quan đến thư viện uuid, tham số khởi tạo binRepo trong main.go và lỗi ép kiểu dữ liệu thiếu nhánh (when expression not exhaustive) trên Android. Chuyển hướng an toàn sang sử dụng hàm FindByID() lấy mã Bin để giải phóng luồng nghẽn.
- Tự động hóa & Triển khai thành công (Production Mode): Hoàn thiện và chạy mượt mà script tự động hóa deploy.sh; Hệ thống tự động cập nhật cấu trúc database, biên dịch backend, tối ưu hóa build Frontend Vite trong 750ms và restart dịch vụ qua Nginx. Hệ thống đã live ổn định tại địa chỉ nội bộ: http://192.168.110.179.
Khó khăn:
- Cấu trúc repository hiện tại chưa cài đặt sẵn hàm liên kết dữ liệu nâng cao (FindBinByIDEnriched) và phương thức kết chuỗi địa chỉ đầy đủ của Bin, gây lỗi biên dịch nghiêm trọng khi gộp mã nguồn, phải xử lý linh hoạt bằng cách chuyển hướng dùng tạm trường mã Code phẳng.
Kế hoạch 04/06/2026:
- Tiến hành kiểm thử thực tế (Sanity Test) luồng đổi vị trí trên giao diện Web (Manager) và kiểm tra phản hồi hiển thị cảnh báo real-time trên thiết bị Android.
- Tùy theo yêu cầu của Manager, quay lại hoàn thiện hàm truy vấn dữ liệu vị trí nâng cao (Raw JOIN query đi qua các bảng phẳng) để hiển thị chuỗi địa chỉ Bin tường minh (Kho › Khu › Dãy).

## 04/06/2026
Công việc đã hoàn thành:

Tóm gọn hành trình sáng nay:
Nghi useSocket singleton overwrite → refactor pub/sub → fix được kiến trúc nhưng page vẫn không tự cập nhật khi Android tạo phiếu mới
Nghi stale closure / useCallback → bỏ wrapper → không phải vấn đề
Nghi token null → kiểm tra authStore → không phải
Thêm debug log → xác nhận WS nhận message, handler fired, load() chạy đúng → nhưng phiếu mới không xuất hiện
Tìm ra: backend Create() không bao giờ broadcast WS → Android tạo phiếu → server im lặng → web không hay biết → thêm hub.Publish vào cuối Create() → fix hoàn toàn ✅

Fix bug thời gian thực trang Phiếu kho (/transactions): phiếu tạo từ Android app không tự cập nhật trên web, phải tải lại trang thủ công
Xác định nguyên nhân gốc rễ gồm 2 lớp: kiến trúc WebSocket frontend chưa tối ưu và backend thiếu thông báo khi tạo phiếu mới
Refactor useSocket.ts sang kiến trúc singleton pub/sub — 1 kết nối WebSocket duy nhất toàn ứng dụng, các trang đăng ký nhận sự kiện độc lập
Bổ sung broadcast WebSocket trong hàm Create() của backend để thông báo ngay khi có phiếu mới
Cập nhật tài liệu: README.md và DEPLOYMENT_LINUX.md
Kết quả:
Trang Phiếu kho hiển thị phiếu mới từ Android ngay lập tức, không cần tải lại trang
Công việc tiếp theo:
Sprint 6.6: Kiểm kê định kỳ (staff scan từng bin, so sánh thực tế với hệ thống, tạo phiếu điều chỉnh)

óm tắt công việc chiều nay 1 (04/06/2026)
Technical (70%)
Hoàn thiện thiết kế nghiệp vụ kiểm kê định kỳ theo từng bin bằng QR Code.
Triển khai backend API POST /api/v1/stock/count phục vụ tạo phiếu kiểm kê.
Bổ sung StockCountRequest, StockCountItem và hàm CreateCount() trong transaction service.
Cập nhật logic Complete() để hỗ trợ loại giao dịch count, tính chênh lệch tồn kho dựa trên số lượng thực tế và số lượng hệ thống.
Mở rộng StockHandler với chức năng tạo phiếu kiểm kê và kết nối Transaction Service.
Cập nhật Web StockLocationsPage hiển thị QR Code cho từng bin, hỗ trợ nhân viên quét mã khi kiểm kê.
Kiểm tra quá trình deploy backend, xử lý lỗi biên dịch liên quan đến package response.
Non-technical (30%)
Rà soát lại toàn bộ luồng kiểm kê từ Web → Android → Backend → Manager duyệt phiếu.
Thống nhất phương án kiểm kê theo từng bin riêng lẻ và chỉ điều chỉnh các sản phẩm được nhập số lượng thực tế.
Chuẩn bị kế hoạch kiểm thử API, build Android và kiểm thử end-to-end cho phiên làm việc tiếp theo.

Tóm tắt công việc chiều nay 2 (04/06/2026)
Technical
Hoàn thiện chức năng Kiểm kê kho (Stock Count) trên ứng dụng Android:
Tích hợp màn hình quét QR Bin để bắt đầu kiểm kê.
Kết nối API lấy danh sách sản phẩm theo Bin.
Hiển thị số lượng hệ thống và cho phép nhập số lượng thực tế.
Tạo phiếu kiểm kê (count transaction) từ ứng dụng Android.
Debug lỗi không hiển thị sản phẩm sau khi quét QR Bin:
Phân tích luồng dữ liệu Android → Backend → Database.
Xác định nguyên nhân Android gửi bin_id trong khi API /stock/locations chỉ tìm kiếm theo bin_code.
Kiểm tra dữ liệu trực tiếp trên PostgreSQL để xác minh lỗi.
Cập nhật backend hỗ trợ tìm kiếm theo bin_id.
Kiểm thử lại và xác nhận dữ liệu tồn kho hiển thị đúng trên Android.
Kiểm thử chức năng tạo phiếu kiểm kê:
Tạo thành công phiếu kiểm kê từ Android.
Xác nhận dữ liệu hiển thị chính xác trên Web Admin.
Kiểm tra số lượng hệ thống và số lượng thực tế được lưu đúng vào transaction.
Non-technical
Rà soát trải nghiệm người dùng trên màn hình Kiểm kê kho Android.
Đánh giá giao diện hiện tại còn tối màu, độ tương phản thấp và khó quan sát khi nhập liệu.
Ghi nhận các hạng mục cần cải thiện UI/UX:
Tăng độ tương phản giữa nền và nội dung.
Làm nổi bật tên sản phẩm, SKU và số lượng.
Tối ưu bố cục form nhập kiểm kê để dễ thao tác trên thiết bị di động.
Đồng bộ giao diện với phong cách của hệ thống Web.
Kết quả đạt được
Chức năng Kiểm kê kho trên Android hoạt động hoàn chỉnh end-to-end:
Quét QR Bin → tải dữ liệu tồn kho → nhập số lượng thực tế → tạo phiếu kiểm kê → hiển thị trên Web Admin.
Hoàn thành xử lý lỗi dữ liệu giữa Android và Backend.
Sẵn sàng chuyển sang giai đoạn cải thiện giao diện và trải nghiệm người dùng.


## 05/06/2026
Kết quả công việc:
Sửa lỗi, cải tiến giao diện Android app, chia phiếu theo ngày. Thêm biểu đồ.
Hoàn thành kiểm thử End-to-End trên thiết bị.

Kế hoạch 06/06/2026:
Batch scan: Scan nhiều QR -> danh sách tạm -> submit 1 phiếu 
Playwright cho web, Espresso cho Android

##  06/06/2026

Kết quả công việc:
Hoàn thành Sprint 6.7 (Fix Bug & Gộp Migration): Sửa triệt để lỗi mất dữ liệu cột Tồn kho trên Web (ProductsPage.tsx) bằng cách sửa lại đoạn parse dữ liệu trả về từ API (res.data?.data thay vì items). Đồng thời, gộp toàn bộ các file cấu trúc database cũ (001–005) thành một file duy nhất migrate_all.sql chạy độc lập và an toàn (idempotent).
Mở rộng luồng Nhà cung cấp (NCC): Thống nhất phương án lưu NCC cố định ở cấp Product thay vì Transaction. Đã tích hợp trường tên NCC (supplier_name) trực tiếp vào luồng báo cáo sản phẩm mới: thêm ô nhập liệu trên Android App, cập nhật cấu trúc bảng product_requests ở Backend và hiển thị thông tin NCC trên Web Admin để Manager tham khảo khi duyệt tạo sản phẩm mới.
Định hình thiết kế Lệnh xuất kho (Sprint 6.3): Giải quyết bài toán Staff không biết vị trí sản phẩm khi tạo phiếu xuất bằng cách chốt phương án "Manager tạo lệnh xuất trước (Pick List)". Hệ thống sẽ tự tra cứu vị trí tồn kho, ghi nhận vào suggested_bin_id và hiển thị chỉ dẫn vị trí chính xác trên App Android để Staff đi lấy hàng.
Khó khăn:
Quy trình tạo phiếu xuất kho cũ thiếu tính năng tự động định tuyến vị trí (Bin), dẫn đến việc nhân viên kho phải tìm kiếm hàng hóa thủ công, dễ gây nhầm lẫn và lãng phí thời gian.
Kế hoạch 07/06/2026:
Triển khai xây dựng luồng Nghiệp vụ xuất kho có hướng dẫn (Sprint 6.3): Cấu hình thuật toán tự động quét bảng stock_items để tìm vị trí chứa hàng phù hợp nhất khi tạo phiếu xuất trên Web Admin.
Cập nhật giao diện chi tiết phiếu xuất trên Android App hiển thị chỉ dẫn vị trí Bin (suggested_bin_id) và tích hợp tính năng quét QR mã Bin để xác nhận lấy hàng thành công.


