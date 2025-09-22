# Master Context

Một công cụ mạnh mẽ để quản lý và tạo ngữ cảnh cho các dự án lập trình, được xây dựng với Tauri và React. Master Context giúp bạn dễ dàng chọn lọc các tệp và thư mục liên quan, tạo ra một file ngữ cảnh duy nhất để cung cấp cho các Mô hình Ngôn ngữ Lớn (LLM), tăng tốc độ và hiệu quả trong công việc phát triển phần mềm.

![Giao diện Master Context](public/screenshot.png) <!-- Bạn nên thêm một ảnh chụp màn hình vào đây -->

## Giới thiệu

Trong thời đại của các mô hình AI tạo sinh, việc cung cấp ngữ cảnh (context) đầy đủ và chính xác về một dự án là yếu-tố-sống-còn để nhận được kết quả tốt. Tuy nhiên, việc sao chép thủ công nội dung từ nhiều file khác nhau vừa tốn thời gian, vừa dễ xảy ra sai sót.

Master Context giải quyết vấn đề này bằng cách cung cấp một giao diện trực quan, cho phép bạn:

- Quét toàn bộ dự án và xây dựng một cây thư mục tương tác.
- Tạo các "Nhóm ngữ cảnh" (Context Groups) cho các tác vụ cụ thể (ví dụ: sửa lỗi UI, tối ưu hóa database).
- Tự động phân tích các liên kết `import`/`export` để đề xuất các file liên quan.
- Tạo ra các "Hồ sơ" (Profiles) riêng biệt cho từng luồng công việc.
- Tự động hóa việc tạo và cập nhật file ngữ cảnh.

## Tính năng chính

- **Quét và Phân tích Dự án Thông minh:**

  - **Tôn trọng `.gitignore`**: Tự động bỏ qua các tệp và thư mục được định nghĩa trong `.gitignore`.
  - **Mẫu loại trừ Tùy chỉnh**: Cho phép người dùng thêm các mẫu glob tùy chỉnh (ví dụ: `*.log`, `dist/`) để loại trừ thêm các file không mong muốn.
  - **Quét lại Hiệu quả**: Sử dụng cache siêu dữ liệu (metadata caching) dựa trên thời gian sửa đổi và kích thước file để tăng tốc độ quét lại, chỉ xử lý các tệp đã thay đổi.

- **Quản lý Ngữ cảnh theo Nhóm:**

  - Tạo và quản lý nhiều nhóm ngữ cảnh riêng biệt.
  - Mỗi nhóm có thể chứa một tập hợp các tệp và thư mục bất kỳ.
  - Cung cấp thống kê chi tiết cho từng nhóm: tổng số tệp, thư mục, dung lượng và ước tính số token.

- **Phân tích Phụ thuộc & Đồng bộ chéo (Cross-sync):**

  - **Tự động nhận diện liên kết**: Phân tích mã nguồn để tìm các câu lệnh `import`, `export`, `require`.
  - **Hỗ trợ Alias Path**: Đọc và phân giải các đường dẫn alias từ `tsconfig.json` hoặc `jsconfig.json` (ví dụ: `@/*`).
  - **Đồng bộ chéo**: Khi được bật, tính năng này sẽ tự động thêm các tệp phụ thuộc vào một nhóm khi bạn quét lại dự án, đảm bảo ngữ cảnh luôn đầy đủ.

- **Hồ sơ Ngữ cảnh (Profiles/Workspaces):**

  - Tạo các không gian làm việc riêng biệt cho cùng một dự án.
  - Mỗi hồ sơ có một bộ nhóm, cài đặt loại trừ, và cấu hình đồng bộ riêng.
  - Dễ dàng chuyển đổi giữa các hồ sơ như "Mặc định", "Frontend Tasks", "Backend Refactor".

- **Tự động hóa Luồng làm việc:**

  - **Đồng bộ tự động (Auto-sync)**: Tự động xuất file ngữ cảnh của các nhóm ra một thư mục được chỉ định mỗi khi có thay đổi.
  - **Theo dõi thời gian thực**: Tự động quét lại toàn bộ dự án khi phát hiện có sự thay đổi trong hệ thống tệp.

- **Tiện ích Hỗ trợ (Quality of Life):**
  - **Ngân sách Token**: Đặt giới hạn token cho mỗi nhóm và nhận cảnh báo trực quan nếu vượt quá.
  - **Sao chép vào Clipboard**: Nhanh chóng sao chép toàn bộ ngữ cảnh của một nhóm hoặc cả dự án vào clipboard chỉ với một cú nhấp chuột.
  - **Xuất file linh hoạt**: Tùy chọn xuất ngữ cảnh với cây thư mục tối giản (chỉ chứa các file đã chọn) hoặc cây thư mục đầy đủ của dự án.
  - **Giao diện Hiện đại**: Được xây dựng với Shadcn UI và Tailwind CSS, hỗ trợ giao diện Sáng/Tối, và cung cấp phản hồi tức thì qua thông báo (toast notifications).

## Công nghệ sử dụng

- **Frontend**:

  - [React](https://reactjs.org/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vitejs.dev/)
  - [Tauri](https://tauri.app/) (API cho frontend)
  - [Zustand](https://github.com/pmndrs/zustand) (Quản lý state)
  - [Shadcn UI](https://ui.shadcn.com/) & [Tailwind CSS](https://tailwindcss.com/) (Giao diện)
  - [Sonner](https://sonner.emilkowal.ski/) (Thông báo)

- **Backend (Rust Crate)**:
  - [Tauri](https://tauri.app/) (Framework lõi)
  - `serde` & `serde_json` (Serialization/Deserialization)
  - `ignore` (Quét cây thư mục hiệu quả)
  - `tiktoken-rs` (Đếm token)
  - `regex` (Phân tích phụ thuộc)
  - `notify` (Theo dõi thay đổi file)
  - `sha2` (Tạo ID duy nhất cho dự án)

## Cài đặt và Chạy

### Yêu cầu

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install) và Cargo

### Các bước

1. **Clone repository:**

   ```bash
   git clone https://your-repository-url/master-context.git
   cd master-context
   ```

2. **Cài đặt các gói phụ thuộc cho frontend:**

   ```bash
   npm install
   ```

3. **Chạy ứng dụng ở chế độ phát triển:**

   ```bash
   npm run tauri dev
   ```

4. **Build ứng dụng:**
   ```bash
   npm run tauri build
   ```

## Giấy phép

Dự án này được cấp phép theo [Giấy phép MIT](LICENSE).
