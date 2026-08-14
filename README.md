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

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Dữ liệu lưu tại `./data/projects/`.

Upload PPTX/PDF chạy **async**: API trả project `processing`, worker (LibreOffice) xử lý nền. Không có Redis thì convert chạy in-process sau khi trả response (dev). Có Redis: `npm run worker`.

## Docker (Phương án 1 — 1 VPS)

```bash
cp .env.example .env
docker compose up -d --build
```

Chi tiết vận hành: [docs/RUNBOOK.md](docs/RUNBOOK.md).

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
