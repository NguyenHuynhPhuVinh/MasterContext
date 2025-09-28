# Master Context: Trợ lý Xây dựng Ngữ cảnh Thông minh cho Lập trình viên

[![Phiên bản](https://img.shields.io/badge/version-0.1.4-blue.svg)](package.json)
[![Vấn đề GitHub](https://img.shields.io/github/issues/NguyenHuynhPhuVinh/MasterContext)](https://github.com/NguyenHuynhPhuVinh/MasterContext/issues)
[![Ngôi sao GitHub](https://img.shields.io/github/stars/NguyenHuynhPhuVinh/MasterContext)](https://github.com/NguyenHuynhPhuVinh/MasterContext/stargazers)
[![Fork GitHub](https://img.shields.io/github/forks/NguyenHuynhPhuVinh/MasterContext)](https://github.com/NguyenHuynhPhuVinh/MasterContext/network/members)
[![Giấy phép](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Nền tảng](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://tauri.app)

**[English](./README.en.md) | Tiếng Việt**



## Tại sao lại là Master Context? 🚀

Trong kỷ nguyên của AI tạo sinh, việc cung cấp ngữ cảnh (context) đầy đủ và chính xác về một dự án là yếu tố then chốt để nhận được kết quả chất lượng. Tuy nhiên, việc thủ công chọn lọc và sao chép nội dung từ hàng chục, thậm chí hàng trăm file là một quy trình tốn thời gian, dễ gây ra lỗi và thiếu sót.

**Master Context** giải quyết triệt để vấn đề này bằng cách cung cấp một bộ công cụ toàn diện và tự động hóa, biến việc tạo ngữ cảnh từ một gánh nặng thành một lợi thế chiến lược cho lập trình viên hiện đại.


## Tại sao lại là Master Context?


## Tính năng Chính 🚀

Master Context được trang bị một loạt các tính năng mạnh mẽ, biến nó thành một trung tâm điều khiển cho quy trình làm việc của bạn với AI và mã nguồn.

### 1. Tích hợp Git Sâu (Deep Git Integration)

- **Lịch sử Commit Trực quan:** Xem toàn bộ lịch sử commit của dự án ngay trong ứng dụng, với thông tin chi tiết về tác giả, ngày tháng và thông điệp.
- **Tạo Ngữ cảnh/Diff từ Commit:** Xuất toàn bộ ngữ cảnh các file đã thay đổi trong một commit hoặc chỉ xuất file `.diff` để review code hoặc hỏi AI về các thay đổi cụ thể.
- **Checkout Trạng thái:** Quay về trạng thái của một commit bất kỳ để kiểm tra code tại một thời điểm trong quá khứ (Detached HEAD), giúp phân tích lịch sử dễ dàng.
- **Hiển thị Trạng thái File:** Cây thư mục sẽ đánh dấu rõ ràng các file đã bị thay đổi (`M`), mới được thêm (`A`), hoặc đã bị xóa (`D`) so với commit gần nhất.
- **Clone & Mở:** Dán URL của một kho Git vào màn hình chào mừng để clone và bắt đầu làm việc ngay lập tức, tiết kiệm thời gian setup.

- **Bộ lọc Loại trừ Tùy chỉnh**: Cho phép bạn định nghĩa các mẫu glob (ví dụ: `dist/`, `*.log`, `node_modules/`) để loại trừ thêm các file không mong muốn, áp dụng cho toàn bộ dự án.
- **Bỏ qua Phân tích Nội dung**: Tùy chỉnh các loại file (ví dụ: `.png`, `.lock`, `.svg`) để chỉ quét siêu dữ liệu mà không cần đọc nội dung, giúp tăng tốc độ quét đáng kể cho các dự án lớn.

### 4. Kiểm soát Ngữ cảnh Chi tiết

- **Hồ sơ (Profiles)**: Tạo các không gian làm việc độc lập trong cùng một dự án. Mỗi hồ sơ có bộ nhóm, cài đặt và cấu hình riêng, lý tưởng để phân tách các luồng công việc khác nhau (ví dụ: "Frontend Tasks", "Backend Refactor", "Database Migration").
- **Nhóm Ngữ cảnh (Context Groups)**: Tổ chức các tệp và thư mục thành các nhóm logic cho từng tác vụ cụ thể. Dễ dàng quản lý, chỉnh sửa và theo dõi các nhóm này.
- **Thống kê Chi tiết**: Mỗi nhóm và toàn bộ dự án đều có thống kê trực quan về tổng số tệp, thư mục, dung lượng và **ước tính số token**, giúp bạn kiểm soát chi phí và đầu vào cho LLM.
- **Ngân sách Token (Token Budget)**: Đặt giới hạn token cho từng nhóm và nhận cảnh báo trực quan khi vượt quá, đảm bảo ngữ cảnh luôn nằm trong giới hạn cho phép của mô hình.

### 5. Phân tích Phụ thuộc & Tự động hóa

- **Phân tích Liên kết Mã nguồn**: Tự động phân tích các câu lệnh `import`, `export`, `require` để xác định mối quan hệ phụ thuộc giữa các file.
- **Hỗ trợ Alias Path**: Đọc và phân giải các đường dẫn alias từ `tsconfig.json` hoặc `jsconfig.json` (ví dụ: `@/*`, `~/*`), hiểu được cấu trúc dự án hiện đại.
- **Đồng bộ chéo (Cross-sync)**: Khi được kích hoạt cho một nhóm, tính năng này sẽ tự động tìm và thêm các tệp phụ thuộc vào nhóm mỗi khi bạn quét lại dự án, đảm bảo ngữ cảnh luôn đầy đủ và không bỏ sót.


### 2. Trình xem & Vá lỗi File Tích hợp 📄

- **Xem Nhanh Nội dung:** Nhấp vào bất kỳ file nào để xem nội dung của nó trong một panel riêng biệt mà không cần rời khỏi ứng dụng, giúp review code nhanh chóng.
- **Áp dụng Diff/Patch:** Dán nội dung của một file vá lỗi (`.diff`, `.patch`) vào ứng dụng để xem trước các thay đổi sẽ được áp dụng lên file gốc như thế nào, hỗ trợ tích hợp với các công cụ CI/CD.
- **Loại trừ Mã Nguồn:** Dễ dàng bôi đen và loại trừ các đoạn code không mong muốn khỏi ngữ cảnh mà không cần sửa file gốc, giữ nguyên tính toàn vẹn dữ liệu.
- **Lưu Thay đổi:** Sau khi xem trước, bạn có thể chọn áp dụng vĩnh viễn các thay đổi từ file vá lỗi vào file gốc trên đĩa, an toàn và dễ dàng.

- **Theo dõi Thời gian thực (Live Watch)**: Tự động quét lại dự án khi phát hiện có sự thay đổi trong hệ thống tệp, giữ cho dữ liệu của bạn luôn được cập nhật.
- **Đồng bộ Tự động (Auto-sync)**: Tự động xuất file ngữ cảnh của các nhóm và toàn bộ dự án ra một thư mục được chỉ định mỗi khi có thay đổi, tích hợp liền mạch với các công cụ khác.
- **Quản lý Dự án Gần đây**: Truy cập nhanh các dự án đã mở trước đó ngay từ màn hình chào mừng.

### 8. Trải nghiệm Người dùng Hiện đại & Linh hoạt



### 3. Quản lý & Phân tích Dự án Thông minh ⚡

- **Quét Song song Hiệu suất cao**: Tận dụng toàn bộ sức mạnh của CPU đa lõi, Master Context quét và phân tích dự án của bạn với tốc độ vượt trội, lý tưởng cho các dự án lớn.
- **Quét lại Siêu tốc (Smart Scan)**: Sử dụng cơ chế cache siêu dữ liệu (metadata caching) dựa trên thời gian sửa đổi và kích thước file, ứng dụng chỉ xử lý những tệp đã thay đổi, giúp các lần quét lại diễn ra gần như tức thì.
- **Tôn trọng `.gitignore`**: Tự động bỏ qua các tệp và thư mục được định nghĩa trong file `.gitignore` của dự án, tránh lãng phí tài nguyên.
- **Bộ lọc Loại trừ Tùy chỉnh**: Cho phép bạn định nghĩa các mẫu glob (ví dụ: `dist/`, `*.log`, `node_modules/`) để loại trừ thêm các file không mong muốn, áp dụng cho toàn bộ dự án.
- **Bỏ qua Phân tích Nội dung**: Tùy chỉnh các loại file (ví dụ: `.png`, `.lock`, `.svg`) để chỉ quét siêu dữ liệu mà không cần đọc nội dung, giúp tăng tốc độ quét đáng kể cho các dự án lớn.

  - **Đếm Token**: `tiktoken-rs`
  - **Xử lý Dữ liệu**: `serde`, `serde_json`
  - **Tạo ID Dự án**: `sha2`
  - **Tích hợp Git**: `git2`
  - **Xử lý Thời gian**: `chrono`

## Cài đặt và Chạy

### Yêu cầu

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install) và Cargo

### Các bước

1.  **Clone repository:**

    ```bash
    git clone https://github.com/NguyenHuynhPhuVinh/MasterContext.git
    cd MasterContext
    ```

2.  **Cài đặt các gói phụ thuộc cho frontend:**

    ```bash
    npm install
    ```

3.  **Chạy ứng dụng ở chế độ phát triển:**

    ```bash
    npm run tauri dev
    ```

4.  **Build ứng dụng:**
    ```bash
    npm run tauri build
    ```

## Giấy phép

Dự án này được cấp phép theo [Giấy phép MIT](LICENSE).

## Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Nếu bạn muốn đóng góp vào dự án này:

1. Fork repository
2. Tạo branch cho tính năng của bạn (`git checkout -b feature/AmazingFeature`)
3. Commit các thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên branch (`git push origin feature/AmazingFeature`)
5. Mở một Pull Request

## Hỗ trợ

Nếu bạn gặp vấn đề hoặc có câu hỏi:

- Mở một [Issue](https://github.com/NguyenHuynhPhuVinh/MasterContext/issues) trên GitHub
- Liên hệ qua email hoặc các kênh hỗ trợ khác
