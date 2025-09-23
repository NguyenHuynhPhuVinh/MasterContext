# Master Context: Trợ lý Xây dựng Ngữ cảnh Thông minh cho Lập trình viên

[![Phiên bản](https://img.shields.io/badge/version-0.1.3-blue.svg)](package.json)
[![Giấy phép](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Nền tảng](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://tauri.app)

**Master Context** là một ứng dụng desktop mạnh mẽ được thiết kế để tối ưu hóa quy trình làm việc của bạn với các Mô hình Ngôn ngữ Lớn (LLM). Thay vì sao chép thủ công, ứng dụng cho phép bạn quét, lựa chọn và tạo ra các file ngữ cảnh (context) một cách thông minh và có tổ chức từ mã nguồn dự án, giúp tăng tốc độ phát triển và đảm bảo chất lượng đầu ra từ AI.

![Giao diện Master Context](public/screenshot.png) <!-- Nên thay thế bằng ảnh chụp màn hình thực tế của ứng dụng -->

## Tại sao lại là Master Context?

Trong kỷ nguyên của AI tạo sinh, việc cung cấp ngữ cảnh (context) đầy đủ và chính xác về một dự án là yếu tố then chốt để nhận được kết quả chất lượng. Tuy nhiên, việc thủ công chọn lọc và sao chép nội dung từ hàng chục, thậm chí hàng trăm file là một quy trình tốn thời gian, dễ gây ra lỗi và thiếu sót.

**Master Context** giải quyết triệt để vấn đề này bằng cách cung cấp một bộ công cụ toàn diện và tự động hóa, biến việc tạo ngữ cảnh từ một gánh nặng thành một lợi thế chiến lược.

## Tính năng Vượt trội

Master Context được trang bị một loạt các tính năng mạnh mẽ, được thiết kế để đáp ứng mọi nhu-cầu của lập trình viên hiện đại.

### 1. Quản lý & Phân tích Dự án Thông minh

- **Quét Song song Hiệu suất cao**: Tận dụng toàn bộ sức mạnh của CPU đa lõi, Master Context quét và phân tích dự án của bạn với tốc độ vượt trội.
- **Quét lại Siêu tốc (Smart Scan)**: Sử dụng cơ chế cache siêu dữ liệu (metadata caching) dựa trên thời gian sửa đổi và kích thước file, ứng dụng chỉ xử lý những tệp đã thay đổi, giúp các lần quét lại diễn ra gần như tức thì.
- **Tôn trọng `.gitignore`**: Tự động bỏ qua các tệp và thư mục được định nghĩa trong file `.gitignore` của dự án.
- **Bộ lọc Loại trừ Tùy chỉnh**: Cho phép bạn định nghĩa các mẫu glob (ví dụ: `dist/`, `*.log`, `node_modules/`) để loại trừ thêm các file không mong muốn, áp dụng cho toàn bộ dự án.
- **Bỏ qua Phân tích Nội dung**: Tùy chỉnh các loại file (ví dụ: `.png`, `.lock`, `.svg`) để chỉ quét siêu dữ liệu mà không cần đọc nội dung, giúp tăng tốc độ quét đáng kể cho các dự án lớn.

### 2. Kiểm soát Ngữ cảnh Chi tiết

- **Hồ sơ (Profiles)**: Tạo các không gian làm việc độc lập trong cùng một dự án. Mỗi hồ sơ có bộ nhóm, cài đặt và cấu hình riêng, lý tưởng để phân tách các luồng công việc khác nhau (ví dụ: "Frontend Tasks", "Backend Refactor", "Database Migration").
- **Nhóm Ngữ cảnh (Context Groups)**: Tổ chức các tệp và thư mục thành các nhóm logic cho từng tác vụ cụ thể. Dễ dàng quản lý, chỉnh sửa và theo dõi các nhóm này.
- **Thống kê Chi tiết**: Mỗi nhóm và toàn bộ dự án đều có thống kê trực quan về tổng số tệp, thư mục, dung lượng và **ước tính số token**, giúp bạn kiểm soát chi phí và đầu vào cho LLM.
- **Ngân sách Token (Token Budget)**: Đặt giới hạn token cho từng nhóm và nhận cảnh báo trực quan khi vượt quá, đảm bảo ngữ cảnh luôn nằm trong giới hạn cho phép của mô hình.

### 3. Phân tích Phụ thuộc & Tự động hóa

- **Phân tích Liên kết Mã nguồn**: Tự động phân tích các câu lệnh `import`, `export`, `require` để xác định mối quan hệ phụ thuộc giữa các file.
- **Hỗ trợ Alias Path**: Đọc và phân giải các đường dẫn alias từ `tsconfig.json` hoặc `jsconfig.json` (ví dụ: `@/*`, `~/*`), hiểu được cấu trúc dự án hiện đại.
- **Đồng bộ chéo (Cross-sync)**: Khi được kích hoạt cho một nhóm, tính năng này sẽ tự động tìm và thêm các tệp phụ thuộc vào nhóm mỗi khi bạn quét lại dự án, đảm bảo ngữ cảnh luôn đầy đủ và không bỏ sót.

### 4. Xuất File Mạnh mẽ & Linh hoạt

- **Sao chép vào Clipboard**: Nhanh chóng sao chép toàn bộ ngữ cảnh của một nhóm hoặc cả dự án vào clipboard chỉ với một cú nhấp chuột.
- **Tùy chọn Cây thư mục**: Lựa chọn xuất ngữ cảnh với cây thư mục tối giản (chỉ chứa các file đã chọn) hoặc cây thư mục đầy đủ của dự án.
- **Tùy chỉnh Nội dung**:
  - **Thêm Số dòng**: Tự động thêm số dòng vào đầu mỗi dòng mã.
  - **Loại bỏ Chú thích**: Giảm thiểu số token bằng cách tự động xóa bỏ các khối comment (`//`, `/* */`, `#`, `<!-- -->`).
  - **Loại bỏ Debug Logs**: Tự động xóa các câu lệnh gỡ lỗi như `console.log`, `dbg!`, `println!`.
  - **Xuất Siêu nén (Super Compressed)**: Nén toàn bộ nội dung file thành một dòng duy nhất và đặt ngay cạnh tên file trong cây thư mục—lý tưởng cho việc review tổng quan nhanh.
- **Loại trừ File theo Đuôi mở rộng**: Dễ dàng loại bỏ các loại file không mong muốn (ví dụ: `.png`, `.svg`) khỏi file ngữ cảnh cuối cùng.
- **Văn bản Luôn Áp dụng**: Định nghĩa một đoạn văn bản (ví dụ: một chỉ thị, một câu hỏi) sẽ tự động được thêm vào cuối mỗi file ngữ cảnh được xuất ra.

### 5. Tối ưu hóa Luồng làm việc

- **Theo dõi Thời gian thực (Live Watch)**: Tự động quét lại dự án khi phát hiện có sự thay đổi trong hệ thống tệp, giữ cho dữ liệu của bạn luôn được cập nhật.
- **Đồng bộ Tự động (Auto-sync)**: Tự động xuất file ngữ cảnh của các nhóm và toàn bộ dự án ra một thư mục được chỉ định mỗi khi có thay đổi, tích hợp liền mạch với các công cụ khác.
- **Quản lý Dự án Gần đây**: Truy cập nhanh các dự án đã mở trước đó ngay từ màn hình chào mừng.

### 6. Trải nghiệm Người dùng Hiện đại

- **Giao diện Trực quan**: Được xây dựng với Shadcn UI và Tailwind CSS, mang lại trải nghiệm mượt mà và dễ sử dụng.
- **Chủ đề Sáng/Tối (Light/Dark Mode)**: Chuyển đổi giao diện để phù hợp với môi trường làm việc của bạn.
- **Bảng điều khiển Linh hoạt**: Các panel có thể thay đổi kích thước, cho phép bạn tùy chỉnh không gian làm việc theo ý muốn.
- **Thông báo Hệ thống**: Nhận phản hồi tức thì cho các hành động quan trọng như quét xong, sao chép thành công, hoặc khi có lỗi xảy ra.

## Công nghệ Sử dụng

- **Frontend**:

  - **Framework**: [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
  - **Quản lý State**: [Zustand](https://github.com/pmndrs/zustand)
  - **UI**: [Shadcn UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
  - **Thông báo**: [Tauri Notification Plugin](https://tauri.app/v1/api/js/plugins/notification/)

- **Backend (Rust)**:
  - **Framework**: [Tauri](https://tauri.app/)
  - **Quét Hệ thống Tệp**: `ignore`
  - **Theo dõi Thay đổi**: `notify`
  - **Phân tích Phụ thuộc**: `regex`
  - **Đếm Token**: `tiktoken-rs`
  - **Xử lý Dữ liệu**: `serde`, `serde_json`
  - **Tạo ID Dự án**: `sha2`

## Cài đặt và Chạy

### Yêu cầu

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install) và Cargo

### Các bước

1.  **Clone repository:**

    ```bash
    git clone https://your-repository-url/master-context.git
    cd master-context
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
