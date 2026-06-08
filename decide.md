-xac dinh dau vao dau ra he thong:
+dau vao: don hang, san pham, vi tri kho, thao tac quet qr
+dau ra: ton kho thoi gian thuc, canh bao, bieu do, bao cao xuat/nhap

-nhom nguoi dung:
+staff: xuat/ nhap, quet ma
+quan ly kho: duyet phieu, xem bao cao, cau hinh vi tri
+admin: cau hinh he thong, phan quyen

docker dung nhung sau do bo

test bang thunder client

+Luồng nhập,ví dụ nhân viên nhận được lô hàng không có qr, nên tạo mã qr để quét hay nhập thông tin để tạo phiếu thủ công, nhưng dù cách gì thì khi hàng được nhập vào kho chắc chắn phải có mã để khi xuất có thể quét 

->
Nhân viên tạo phiếu thủ công (qua ProductSearchActivity)
Manager/Admin duyệt phiếu → hàng vào kho
Sau khi duyệt, manager gọi POST /api/v1/products/:id/generate-qr → lấy QR code
In nhãn QR dán lên hàng/thùng


Luồng nhập,ví dụ nhân viên nhận được lô hàng không có qr và sản phẩm cũng không có sku trong database thì phải làm sao? trong trường hợp nhận lô hàng có sản phẩm chưa từng có trong kho.
->
android app phải có phần đề xuất sản phẩm mới, gửi cho manager/admin duyệt (phần ‘Báo cáo sản phẩm mới’)

Luồng xuất, nhân viên quét/nhập thông tin có bao gồm số lượng, rồi manager/admin thấy phiếu, duyệt, hoàn tất, luồng ổn định, có mỗi sự bất thường đó là Báo cáo theo SKU mục biến động ròng của sản phẩm đó âm, có nghĩa là số lượng đơn hàng xuất nhiều hơn có trong kho, điều này là phi thực tế, cần hướng giải quyết. tôi đang nghĩ đến phần thông báo sản phẩm này không đủ trong kho và chặn nhấn tạo phiếu phía nhân viên, hoặc là thông báo sản phẩm không đủ trong kho ở trong phần phiếu kho của manager/admin và chặn nhấn duyệt đơn phiếu đó chỉ hiện từ chối.


về phần tạo product: nếu quét qr 1 lô hàng mới và ra một sản phẩm không quen thuộc, nhân viên search tên mà không thấy sản phẩm này tồn tại trong kho từ trước thì phải làm sao, do chính nhân viên tạo sku của sản phẩm đó hay manager hoặc admin tạo.
->Scan QR → 404 -> De xuat san pham moi -> manager/admin tao ->scan
lai va tao phieu
 POST /api/v1/products (chỉ admin, manager)


- ví dụ có đơn hàng này, mình muốn tìm kiếm trong warehouse của mình có không thì phải làm sao?



Admin có thể tạo warehouse/zone/rack/bin trên web app, và có thể xóa warehouse/zone/rack/bin nhưng chỉ khi không có sản phẩm trong đó.

-xem hàng tồn kho trên web và android app, kiểu xem được nội dung sku có tên A còn số lượng bao nhiêu trong kho, nếu có đơn chờ duyệt thì số lượng là bao nhiêu, đang ở warehouse/zone/rack/bin nào,nếu duyệt thành công thì còn lại bao nhiêu, rồi khi search trong kho hàng, ví dụ bóng A thì sẽ có hiện bóng A số lượng B1 ở bin C1, số lượng B2 ở C2; phần này chắc chắn phải có real time , navigate “kho hàng” có thể để cạnh kho phiếu, yêu cầu này có khả thi không.
->
Câu hỏi này khả thi không? — Có, và khả thi tốt, vì hệ thống đã có WebSocket Hub sẵn.
Thiết kế đề xuất:
Backend cần thêm endpoint:
GET /api/v1/stock?search=bóng&page=1&limit=20
Trả về: product_name, sku, total_quantity, pending_out, locations: [{bin_name, rack, zone, warehouse, quantity}]
Màn hình "Kho hàng" (Web):
Search theo tên/SKU
Mỗi sản phẩm expand ra → thấy từng bin đang chứa bao nhiêu
Số lượng hiện tại / đang chờ phê duyệt xuất / còn lại nếu duyệt
Real-time qua WebSocket (đã có EventStockUpdate)
Màn hình "Tìm kho" (Android):
Tương tự nhưng đơn giản hơn: nhập SKU/tên → thấy danh sách bin + số lượng
Hữu ích khi nhân viên cần đi lấy hàng đúng vị trí
Về real-time: WebSocket Hub đã có, chỉ cần Android subscribe và web đã có useSocket.ts. Đây là Sprint 5 item đã có trong backlog (5.6 Android + đã có trên web).
✅ Hoàn toàn khả thi. Đây là một trong những tính năng có giá trị thực tế cao nhất. Nên ưu tiên trong Sprint 5.

-phần tạo tài khoản staff/manager dành riêng cho admin và chỉ có trên web app
->
✅ Khả thi, đơn giản, đã có trong kế hoạch Sprint 5.
Backend cần thêm:
POST   /api/v1/admin/users          (tạo user)
GET    /api/v1/admin/users          (danh sách)
PUT    /api/v1/admin/users/:id      (sửa role, reset pass)
PUT    /api/v1/admin/users/:id/disable  (vô hiệu hóa)
Tất cả guard role = admin. Web thêm trang /admin/users. Không cần trên Android.

-người yêu cầu duyệt phiếu tích hợp vào phiếu, để admin có thể biết ai yêu cầu duyệt, đồng thời lưu vào database và khi export ra có thông tin này.
->
Đây là yêu cầu rất hợp lý và khả thi dễ dàng. Hiện tại created_by đã được lưu (đã fix Sprint 3). Tuy nhiên cần làm rõ:
created_by = người tạo phiếu (đã có)
requested_by = cũng chính là người tạo phiếu trong hầu hết trường hợp
Nếu muốn track riêng "ai bấm submit để yêu cầu duyệt" (phân biệt với người tạo draft), thì cần thêm field. Nhưng thực tế với hệ thống này, created_by đã đủ — chỉ cần đảm bảo:
created_by (UUID + username) được hiển thị trong phiếu trên web → admin thấy ngay
Khi export CSV/PDF → cột "Người tạo/yêu cầu" có đầy đủ tên
Hiện tại created_by chỉ lưu UUID, cần join thêm username khi trả về danh sách transactions.
✅ Khả thi, chủ yếu là backend join thêm user info và frontend hiển thị đúng chỗ.


Luồng hoạt động khi tạo phiếu nhập kho
Để dễ hình dung, đây là những gì xảy ra khi nhân viên nhấn "Tạo phiếu nhập":
Nhân viên nhấn nút
       ↓
[Trình duyệt] gửi yêu cầu lên máy chủ kèm token đăng nhập

[Middleware] kiểm tra token — nếu sai/hết hạn → từ chối ngay

[Handler] tiếp nhận, kiểm tra dữ liệu đầu vào có đủ không

[Service] xử lý nghiệp vụ:
  - Sinh mã phiếu tự động (VD: IMP-1748005234567)
  - Lưu phiếu vào DB với trạng thái "Chờ duyệt"

[Repository] thực thi câu lệnh SQL lưu vào PostgreSQL

[Handler] trả kết quả về trình duyệt: {"success": true, ...}

Nhân viên thấy thông báo "Tạo phiếu thành công"

Khi quản lý duyệt và nhân viên hoàn tất phiếu, thêm 2 bước:
[Service] ghi số liệu tồn kho vào DB (trong 1 giao dịch an toàn)
       ↓
[WebSocket Hub] phát thông báo đến TẤT CẢ trình duyệt đang mở
       ↓
Mọi người thấy tồn kho cập nhật ngay — không cần tải lại trang
       ↓
[Alert Service] kiểm tra nếu tồn kho < ngưỡng → phát cảnh báo màu đỏ/vàng


Tại sao chia làm nhiều tầng như vậy?
Cách tổ chức này gọi là Clean Architecture — mỗi tầng chỉ làm đúng một việc:
Handler chỉ biết nhận và trả dữ liệu, không biết DB là gì
Service chỉ biết logic nghiệp vụ, không biết dữ liệu lưu thế nào
Repository chỉ biết câu lệnh DB, không biết logic
Lợi ích thực tế: khi cần đổi từ PostgreSQL sang database khác, chỉ sửa tầng Repository — toàn bộ logic nghiệp vụ giữ nguyên. Khi thêm tính năng mới, biết ngay cần sửa file nào mà không sợ ảnh hưởng chỗ khác.

