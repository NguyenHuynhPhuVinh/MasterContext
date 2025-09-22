### I. Cải tiến Chất lượng Trải nghiệm (Quality of Life - QoL) - Dễ thực hiện, tác động lớn

Đây là những tính năng nhỏ nhưng sẽ giúp người dùng sử dụng ứng dụng mượt mà và hiệu quả hơn rất nhiều.

2.  **Tìm kiếm/Lọc trong Cây Thư mục:**

    - **Vấn đề:** Với các dự án lớn, việc tìm một file/thư mục cụ thể trong `FileTreeView` rất mất thời gian.
    - **Giải pháp:** Thêm một ô `Input` phía trên cây thư mục. Khi người dùng gõ, cây thư mục sẽ tự động lọc và chỉ hiển thị các file/thư mục khớp với tên tìm kiếm (và các thư mục cha của chúng).

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
