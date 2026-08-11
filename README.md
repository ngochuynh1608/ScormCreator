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

## Stack

- Next.js (App Router) full-stack
- Parse PPTX: JSZip + fast-xml-parser
- TTS mock + in-process job queue (thay bằng Azure/Google/ElevenLabs sau)
- Đóng gói SCORM: archiver + imsmanifest + HTML player + SCORM API bridge

## Ghi chú

- Thumbnail PNG: **LibreOffice** trước (Windows/Linux/macOS), rồi WPS/PowerPoint COM trên Windows nếu cần. Fallback SVG nếu không có engine.
- Linux: `sudo apt install libreoffice` · Windows: cài LibreOffice hoặc đặt `LIBREOFFICE_PATH` tới `soffice.exe`.
- Preview browser dùng Web Speech API; file audio trong gói SCORM là WAV mock theo độ dài narration.
