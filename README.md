# ScormCreator

Công cụ web chuyển **PPTX → bài giảng SCORM** có giọng đọc AI (mock) và câu hỏi tương tác.

## MVP

- Upload `.pptx`, parse text/notes, hiển thị thumbnail slide
- Chỉnh tiêu đề, nội dung, **kịch bản lời thoại**
- Mock TTS (queue bất đồng bộ) + upload audio có sẵn
- Chèn quiz: trắc nghiệm 1 đáp án, đúng/sai (gating, điểm, feedback)
- Preview player
- Xuất **SCORM 1.2** và **SCORM 2004** (`.zip`)

## Chạy local

**Khuyến nghị:** Node.js **22 LTS** (Docker cũng dùng Node 22). Node 24 trên Windows thường buộc biên dịch `better-sqlite3` và cần Visual Studio C++.

```bash
npm install
npm run dev
```

Nếu `better-sqlite3` không cài được (thiếu Visual Studio), `npm install` vẫn xong — app dùng **JSON store** local. Docker/VPS dùng Postgres nên không ảnh hưởng production.

Windows (nếu muốn SQLite native): cài [Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) với workload **Desktop development with C++**, hoặc cài Node 22 LTS rồi `npm install` lại.

Mở [http://localhost:3000](http://localhost:3000).

Dữ liệu lưu tại `./data/projects/`.

Upload PPTX/PDF chạy **async**: API trả project `processing`, worker (LibreOffice) xử lý nền. Không có Redis thì convert chạy in-process sau khi trả response (dev). Có Redis: `npm run worker`.

## Chạy local giống production (Docker)

Cần [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL2 trên Windows).

```bash
# 1) Cài Docker Desktop, mở app, đợi engine Running
# 2) File môi trường cho Compose
cp .env.docker.example .env.docker

# 3) Build + chạy: nginx, web, worker, redis, postgres, minio
npm run docker:up

# App: http://localhost:8080  (local map 8080→80, tránh chiếm port 80 trên Windows)
# MinIO console: http://localhost:9001
npm run docker:ps
npm run docker:logs
```

Tắt stack: `npm run docker:down`.

Khác `npm run dev`: có Redis queue, worker LibreOffice, Postgres, MinIO — giống VPS.

## Stack

- Next.js (App Router) full-stack
- Parse PPTX: JSZip + fast-xml-parser
- Convert queue: BullMQ + Redis (worker riêng)
- TTS: EverAI (+ mock) qua queue worker
- Đóng gói SCORM: JSZip + imsmanifest + HTML player
- Postgres (Docker) / SQLite (local) · MinIO S3 (Docker)

## Ghi chú

- Thumbnail PNG: **LibreOffice** trước (Windows/Linux/macOS), rồi WPS/PowerPoint COM trên Windows nếu cần. Fallback SVG nếu không có engine.
- Linux: `sudo apt install libreoffice` · Windows: cài LibreOffice hoặc đặt `LIBREOFFICE_PATH` tới `soffice.exe`.
- Preview browser dùng Web Speech API khi chưa có audio; gói SCORM dùng file audio đã tạo.
