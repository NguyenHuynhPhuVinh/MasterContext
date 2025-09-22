### I. Cải tiến Chất lượng Trải nghiệm (Quality of Life - QoL) - Dễ thực hiện, tác động lớn

Đây là những tính năng nhỏ nhưng sẽ giúp người dùng sử dụng ứng dụng mượt mà và hiệu quả hơn rất nhiều.

1.  **Nút "Sao chép vào Clipboard":**

    - **Vấn đề:** Hiện tại, người dùng phải "Xuất" ra file rồi mở file đó lên để sao chép nội dung.
    - **Giải pháp:** Bên cạnh nút "Xuất", thêm một nút "Sao chép" (Copy to Clipboard). Khi nhấn, ứng dụng sẽ gọi command Rust để tạo context và trả về nội dung, sau đó frontend sẽ trực tiếp đưa nội dung đó vào clipboard của hệ điều hành. Đây là tính năng cực kỳ hữu ích cho luồng làm việc với LLM.

2.  **Tìm kiếm/Lọc trong Cây Thư mục:**

    - **Vấn đề:** Với các dự án lớn, việc tìm một file/thư mục cụ thể trong `FileTreeView` rất mất thời gian.
    - **Giải pháp:** Thêm một ô `Input` phía trên cây thư mục. Khi người dùng gõ, cây thư mục sẽ tự động lọc và chỉ hiển thị các file/thư mục khớp với tên tìm kiếm (và các thư mục cha của chúng).

3.  **Thông báo (Toast Notifications):**

    - **Vấn đề:** Các hành động như "Quét lại", "Lưu nhóm", "Xuất file" hoàn tất mà không có phản hồi trực quan rõ ràng (chỉ có `alert` hoặc `console.log`).
    - **Giải pháp:** Tích hợp một thư viện thông báo gọn nhẹ (ví dụ: `Sonner` cho React). Hiển thị các thông báo ngắn gọn ở góc màn hình cho các sự kiện như: "Quét lại dự án hoàn tất!", "Lưu nhóm thành công!", "Đã sao chép vào clipboard", "Bắt đầu đồng bộ tự động...".

4.  **Luồng Tạo Nhóm Mượt Hơn:**
    - **Vấn đề:** Sau khi tạo một nhóm mới, người dùng vẫn ở màn hình Dashboard và phải tự nhấn vào "Quản lý nội dung".
    - **Giải pháp:** Sau khi người dùng tạo xong một nhóm mới, tự động chuyển họ đến màn hình `GroupEditorScene` để họ có thể chọn nội dung cho nhóm đó ngay lập tức.

---

### II. Nâng Cấp Tính Năng Cốt Lõi - Tăng cường sức mạnh cho ứng dụng

Đây là những tính năng mở rộng trực tiếp khả năng quản lý ngữ cảnh của ứng dụng.

1.  **Ngân sách Token (Token Budgeting) cho Mỗi Nhóm:**

    - **Vấn đề:** Người dùng không biết ngữ cảnh của họ có vượt quá giới hạn token của LLM hay không cho đến khi xuất ra.
    - **Giải pháp:**
      - Trong dialog tạo/sửa nhóm, thêm một trường để người dùng nhập "Giới hạn Token" (ví dụ: 8000).
      - Trong `GroupManager`, hiển thị một thanh tiến trình hoặc một dòng chữ màu (`12500 / 8000 tokens`) để cảnh báo nếu nhóm vượt quá ngân sách.
      - Khi xuất, nếu vượt quá, có thể đưa ra cảnh báo.

2.  **Tùy chỉnh các Mẫu Loại trừ (Custom Ignore Patterns):**

    - **Vấn đề:** Ứng dụng hiện chỉ dựa vào `.gitignore`. Đôi khi người dùng muốn loại trừ thêm các file/thư mục (ví dụ `*.log`, `dist/`, `__pycache__/`) mà không muốn sửa file `.gitignore` chung của dự án.
    - **Giải pháp:** Trong `SettingsDialog`, thêm một vùng `Textarea` cho phép người dùng nhập các mẫu glob để loại trừ bổ sung. Các mẫu này sẽ được lưu vào file `data.json` và được Rust sử dụng khi quét.

3.  **Hồ sơ Ngữ cảnh (Context Profiles / Workspaces):**
    - **Vấn đề:** Một dự án có thể cần nhiều bộ ngữ cảnh khác nhau cho các tác vụ khác nhau (ví dụ: một bộ cho "Sửa lỗi UI", một bộ khác cho "Tối ưu hóa Database"). Hiện tại tất cả các nhóm đều nằm chung.
    - **Giải pháp:** Cho phép người dùng tạo các "Hồ sơ". Mỗi hồ sơ là một tập hợp các nhóm riêng biệt. Giao diện sẽ có một Dropdown menu để chuyển đổi giữa các hồ sơ như "Mặc định", "Frontend Tasks", "Backend Refactor". Về mặt kỹ thuật, bạn có thể lưu thành các file khác nhau trong thư mục `.mastercontext` (ví dụ: `data_default.json`, `data_frontend.json`).

---

### III. Các Tính Năng Cao Cấp & Đột Phá - "Game Changer"

Đây là những ý tưởng lớn, có thể biến ứng dụng của bạn từ một công cụ hữu ích thành một trợ thủ không thể thiếu.

1.  **Trực quan hóa Đồ thị Phụ thuộc (Dependency Graph Visualization):**

    - **Vấn đề:** Tính năng "liên kết chéo" rất mạnh nhưng nó là một hộp đen. Người dùng không thấy được mối quan hệ giữa các file.
    - **Giải pháp:** Tận dụng dữ liệu `links` đã có trong `file_metadata_cache` để vẽ một đồ thị phụ thuộc.
      - Tạo một tab/màn hình mới.
      - Sử dụng một thư viện như `react-flow` để hiển thị các file dưới dạng các node và các đường import/export dưới dạng các cạnh nối.
      - Người dùng có thể tương tác trực tiếp trên đồ thị: nhấp vào một node để thêm nó và tất cả các phụ thuộc của nó vào một nhóm đang chọn.
      - Đây sẽ là một tính năng cực kỳ "ăn tiền", giúp người dùng hiểu sâu hơn về cấu trúc dự án.

2.  **Lựa chọn ở Cấp độ Hàm/Biểu tượng (Symbol-Level Selection):**

    - **Vấn đề:** Đôi khi người dùng chỉ cần một vài hàm từ một file rất lớn, nhưng họ buộc phải chọn cả file, gây lãng phí token.
    - **Giải pháp:** Đây là tính năng phức tạp nhất nhưng cũng mạnh mẽ nhất.
      - Sử dụng một thư viện phân tích mã nguồn (parser) như `Tree-sitter` ở phía Rust.
      - Khi quét, Rust không chỉ đọc file mà còn phân tích cấu trúc của nó để nhận diện các hàm, class, component...
      - Trong `FileTreeView` ở frontend, cho phép người dùng "mở rộng" một file để xem danh sách các biểu tượng bên trong nó.
      - Người dùng có thể chọn từng hàm/class riêng lẻ để đưa vào ngữ cảnh.
      - Khi xuất, Rust sẽ trích xuất chính xác mã nguồn của các biểu tượng đã chọn.

3.  **Mẫu Nhóm Thông minh (Smart Group Templates):**
    - **Vấn đề:** Người dùng thường lặp đi lặp lại việc tạo các nhóm có cấu trúc tương tự (ví dụ: một nhóm cho component React luôn bao gồm file `.tsx`, file `.css`, và file test `.spec.ts`).
    - **Giải pháp:**
      - Cho phép người dùng tạo "Mẫu". Ví dụ, một mẫu tên "React Component".
      - Mẫu này định nghĩa các quy tắc dựa trên tên file, ví dụ: "Nếu tôi chọn `{name}.tsx`, hãy tự động chọn cả `{name}.module.css` và `{name}.test.tsx`".
      - Khi người dùng kéo thả hoặc chọn file, ứng dụng sẽ kiểm tra xem có khớp với mẫu nào không và đề xuất thêm các file liên quan.
