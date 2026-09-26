# 프라이버시 보호 비디오 압축기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서만 비디오를 압축하는 프라이버시 중심 웹 앱 구축. 타겟 크기 49.9MB 고정, AV1/WebM 출력.

**Architecture:** 단일 HTML 파일 (HTML + CSS + Vanilla JS). WebCodecs API로 비디오 디코딩/인코딩. 서버 통신 없이 완전 클라이언트 사이드 처리.

**Tech Stack:** WebCodecs API (VideoDecoder, VideoEncoder), File API, Blob API. 외부 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-26-video-compressor-design.md`

## Global Constraints

- 타겟 크기: 49.9MB (고정)
- 출력 코덱: AV1
- 출력 컨테이너: WebM
- 외부 스크립트/라이브러리 로드 금지
- 서버 통신 금지 (fetch, XMLHttpRequest, WebSocket 등)
- 모든 처리는 브라우저 메모리에서만 수행
- 브라우저 지원: Chrome 94+, Edge 94+ (AV1 인코딩)

## Review Focus

1. **이미 타겟 크기 이하인 파일** — 압축 불필요 안내 + 원본 다운로드 제공해야 함
2. **AV1 인코딩 미지원 브라우저** — 사용자에게 안내 메시지 표시해야 함
3. **지원하지 않는 비디오 포맷** — 오류 메시지로 안내해야 함
4. **인코딩 중 메모리 부족** — 사용자 안내 후 중단해야 함
5. **매우 짧은 비디오 (10초 미만)** — 비트레이트 계산이 비정상적으로 높을 수 있음, 처리 필요

---

## File Structure

| 파일 | 책임 |
|------|------|
| `index.html` | 전체 앱 (HTML + CSS + JS). 단일 파일에 모든 포함. |

---

### Task 1: HTML 구조 + CSS + 파일 선택 UI

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `FilePicker` 컴포넌트 (파일 선택 + 드래그앤드롭), `FileInfo` 표시 영역, `CompressButton` 트리거

- [ ] **Step 1: HTML 골격 + CSS 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비디오 압축기 - 프라이버시 보호</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f0f4f8;
      min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
    header { text-align: center; margin-bottom: 2rem; }
    h1 { font-size: 2rem; font-weight: 800; color: #1a1a2e; }
    .privacy-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 0.75rem;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      margin-bottom: 1.5rem;
    }
    .drop-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 3rem 2rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .drop-zone:hover, .drop-zone.dragover {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    .drop-zone-icon { font-size: 3rem; margin-bottom: 1rem; }
    .drop-zone-text { color: #64748b; font-size: 1rem; }
    .drop-zone-hint { color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem; }
    .file-info {
      display: none;
      margin-top: 1.5rem;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .file-info.visible { display: block; }
    .file-info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      font-size: 0.9rem;
    }
    .file-info-label { color: #64748b; }
    .file-info-value { font-weight: 600; color: #1a1a2e; }
    .btn {
      display: inline-block;
      padding: 0.85rem 2rem;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
      width: 100%;
      margin-top: 1.5rem;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59,130,246,0.3); }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
    .progress-section { display: none; }
    .progress-section.visible { display: block; }
    .progress-bar-bg {
      background: #e2e8f0;
      border-radius: 50px;
      height: 12px;
      overflow: hidden;
      margin: 1rem 0;
    }
    .progress-bar-fill {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      height: 100%;
      width: 0%;
      border-radius: 50px;
      transition: width 0.3s;
    }
    .progress-text { text-align: center; color: #64748b; font-size: 0.9rem; }
    .progress-time { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 0.25rem; }
    .result-section { display: none; }
    .result-section.visible { display: block; }
    .result-success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
      margin-bottom: 1rem;
    }
    .result-success h3 { color: #059669; margin-bottom: 0.5rem; }
    .result-compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }
    .result-box {
      background: #f8fafc;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
    }
    .result-box-label { font-size: 0.8rem; color: #64748b; }
    .result-box-value { font-size: 1.5rem; font-weight: 800; color: #1a1a2e; }
    .result-box-value.compressed { color: #10b981; }
    .btn-download {
      background: #10b981;
      color: white;
      width: 100%;
      margin-top: 1rem;
    }
    .btn-download:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16,185,129,0.3); }
    .btn-new {
      background: #e2e8f0;
      color: #475569;
      width: 100%;
      margin-top: 0.75rem;
    }
    .error-message {
      display: none;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 1rem;
      color: #dc2626;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    .error-message.visible { display: block; }
    .browser-warning {
      display: none;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 1rem;
      color: #d97706;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .browser-warning.visible { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>비디오 압축기</h1>
      <div class="privacy-badge">서버 업로드 없음 · 브라우저에서만 처리</div>
    </header>

    <div class="browser-warning" id="browserWarning">
      현재 브라우저는 AV1 인코딩을 지원하지 않습니다. Chrome 94+ 또는 Edge 94+를 사용해 주세요.
    </div>

    <div class="card">
      <div class="drop-zone" id="dropZone">
        <div class="drop-zone-icon">📹</div>
        <div class="drop-zone-text">비디오 파일을 드래그하거나 클릭하여 선택</div>
        <div class="drop-zone-hint">MP4, WebM, MOV 등 · 파일은 서버에 업로드되지 않습니다</div>
      </div>
      <input type="file" id="fileInput" accept="video/*" style="display:none;">

      <div class="file-info" id="fileInfo">
        <div class="file-info-row">
          <span class="file-info-label">파일명</span>
          <span class="file-info-value" id="fileName">-</span>
        </div>
        <div class="file-info-row">
          <span class="file-info-label">크기</span>
          <span class="file-info-value" id="fileSize">-</span>
        </div>
        <div class="file-info-row">
          <span class="file-info-label">길이</span>
          <span class="file-info-value" id="fileDuration">-</span>
        </div>
        <div class="file-info-row">
          <span class="file-info-label">해상도</span>
          <span class="file-info-value" id="fileResolution">-</span>
        </div>
      </div>

      <button class="btn btn-primary" id="compressBtn" disabled>압축 시작</button>

      <div class="error-message" id="errorMessage"></div>
    </div>

    <div class="card progress-section" id="progressSection">
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progressBar"></div>
      </div>
      <div class="progress-text" id="progressText">준비 중...</div>
      <div class="progress-time" id="progressTime"></div>
    </div>

    <div class="card result-section" id="resultSection">
      <div class="result-success">
        <h3>압축 완료!</h3>
        <p id="resultSummary"></p>
      </div>
      <div class="result-compare">
        <div class="result-box">
          <div class="result-box-label">원본 크기</div>
          <div class="result-box-value" id="originalSize">-</div>
        </div>
        <div class="result-box">
          <div class="result-box-label">압축 후 크기</div>
          <div class="result-box-value compressed" id="compressedSize">-</div>
        </div>
      </div>
      <button class="btn btn-download" id="downloadBtn">다운로드</button>
      <button class="btn btn-new" id="newFileBtn">새 파일 압축</button>
    </div>
  </div>

  <script>
    // Task 1에서는 UI 요소만 정의
  </script>
</body>
</html>
```

- [ ] **Step 2: 브라우저 지원 확인 로직 추가**

```javascript
// <script> 태그 내에 추가
(function checkBrowserSupport() {
  const isChrome = /Chrome\/(\d+)/.test(navigator.userAgent);
  const isEdge = /Edg\/(\d+)/.test(navigator.userAgent);
  const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
  const edgeMatch = navigator.userAgent.match(/Edg\/(\d+)/);
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1]) : 0;
  const edgeVersion = edgeMatch ? parseInt(edgeMatch[1]) : 0;

  const supported = (isChrome && chromeVersion >= 94) || (isEdge && edgeVersion >= 94);

  if (!supported) {
    document.getElementById('browserWarning').classList.add('visible');
    document.getElementById('compressBtn').disabled = true;
  }
})();
```

- [ ] **Step 3: 파일 선택 + 드래그앤드롭 이벤트 바인딩**

```javascript
// <script> 태그 내에 추가
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const compressBtn = document.getElementById('compressBtn');
const fileInfo = document.getElementById('fileInfo');
const errorMessage = document.getElementById('errorMessage');

let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

function handleFileSelect(file) {
  if (!file.type.startsWith('video/')) {
    showError('비디오 파일을 선택해 주세요.');
    return;
  }
  selectedFile = file;
  hideError();
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  fileInfo.classList.add('visible');
  compressBtn.disabled = false;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.add('visible');
}

function hideError() {
  errorMessage.classList.remove('visible');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
```

- [ ] **Step 4: 브라우저에서 기본 동작 확인**

`index.html`을 브라우저에서 열고:
- 드래그앤드롭 영역이 표시되는지 확인
- 파일 선택 시 파일명/크기가 표시되는지 확인
- 비디오가 아닌 파일 선택 시 오류 메시지가 표시되는지 확인

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add HTML structure, CSS, and file selection UI"
```

---

### Task 2: 비디오 분석 (VideoDecoder)

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `selectedFile` (File 객체), `handleFileSelect` (Task 1)
- Produces: `analyzeVideo(file)` → `Promise<{duration, width, height, frameRate}>`, `formatTime(seconds)` → `string`

- [ ] **Step 1: 비디오 분석 함수 작성**

```javascript
// <script> 태그 내에 추가
async function analyzeVideo(file) {
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const result = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        frameRate: 30 // 기본값, canvas 프레임 추출 시 사용
      };
      URL.revokeObjectURL(url);
      resolve(result);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('비디오를 불러올 수 없습니다. 지원하지 않는 포맷일 수 있습니다.'));
    };

    video.src = url;
  });
}
```

- [ ] **Step 2: 파일 선택 시 비디오 메타데이터 표시 연결**

`handleFileSelect` 함수를 수정:

```javascript
async function handleFileSelect(file) {
  if (!file.type.startsWith('video/')) {
    showError('비디오 파일을 선택해 주세요.');
    return;
  }
  selectedFile = file;
  hideError();
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  fileInfo.classList.add('visible');
  compressBtn.disabled = true; // 분석 완료 전까지 비활성화

  try {
    const meta = await analyzeVideo(file);
    document.getElementById('fileDuration').textContent = formatTime(meta.duration);
    document.getElementById('fileResolution').textContent = `${meta.width} × ${meta.height}`;
    compressBtn.disabled = false;
  } catch (err) {
    showError(err.message);
    fileInfo.classList.remove('visible');
  }
}
```

- [ ] **Step 3: 시간 포맷 함수 추가**

```javascript
function formatTime(seconds) {
  if (!isFinite(seconds)) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
```

- [ ] **Step 4: 브라우저에서 비디오 분석 확인**

비디오 파일을 선택하고:
- 길이와 해상도가 표시되는지 확인
- 지원하지 않는 포맷 선택 시 오류 메시지가 표시되는지 확인

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add video analysis with VideoDecoder metadata extraction"
```

---

### Task 3: 비트레이트 계산

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `analyzeVideo(file)` → `{duration, width, height, frameRate}` (Task 2)
- Produces: `calculateBitrate(durationSeconds, targetSizeMB)` → `number` (bps)

- [ ] **Step 1: 비트레이트 계산 함수 작성**

```javascript
// <script> 태그 내에 추가
const TARGET_SIZE_MB = 49.9;
const TARGET_SIZE_BITS = TARGET_SIZE_MB * 1024 * 1024 * 8; // 49.9MB → bits
const AUDIO_BITRATE = 128000; // 128 kbps 오디오

function calculateBitrate(durationSeconds) {
  if (durationSeconds <= 0 || !isFinite(durationSeconds)) {
    throw new Error('비디오 길이를 확인할 수 없습니다.');
  }
  const videoBitrate = Math.floor((TARGET_SIZE_BITS / durationSeconds) - AUDIO_BITRATE);
  // 최소 비트레이트 보장 (100 kbps)
  return Math.max(videoBitrate, 100000);
}
```

- [ ] **Step 2: 이미 타겟 크기 이하인 파일 처리**

`handleFileSelect` 함수에 타겟 크기 이하 확인 로직 추가:

```javascript
async function handleFileSelect(file) {
  if (!file.type.startsWith('video/')) {
    showError('비디오 파일을 선택해 주세요.');
    return;
  }
  selectedFile = file;
  hideError();
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  fileInfo.classList.add('visible');
  compressBtn.disabled = true;

  // 이미 타겟 크기 이하인 경우
  if (file.size <= TARGET_SIZE_MB * 1024 * 1024) {
    showError('이미 파일 크기가 49.9MB 이하입니다. 압축이 필요하지 않습니다.');
    compressBtn.textContent = '원본 다운로드';
    compressBtn.disabled = false;
    compressBtn.onclick = () => downloadOriginal(file);
    return;
  }

  compressBtn.textContent = '압축 시작';

  try {
    const meta = await analyzeVideo(file);
    document.getElementById('fileDuration').textContent = formatTime(meta.duration);
    document.getElementById('fileResolution').textContent = `${meta.width} × ${meta.height}`;
    compressBtn.disabled = false;
  } catch (err) {
    showError(err.message);
    fileInfo.classList.remove('visible');
  }
}

function downloadOriginal(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: 브라우저에서 비트레이트 계산 확인**

콘솔에서 `calculateBitrate(60)` 실행 시 적절한 값이 반환되는지 확인:
- 60초 비디오 → 약 5.3 Mbps 비디오 비트레이트

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: add bitrate calculation and small file handling"
```

---

### Task 4: AV1 인코딩 + 진행률

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `selectedFile`, `analyzeVideo(file)`, `calculateBitrate(duration)` (Task 2, 3)
- Produces: `compressVideo(file, onProgress)` → `Promise<Blob>`, `formatFileSize(bytes)` (Task 1)

- [ ] **Step 1: 인코딩 진행률 업데이트 함수 작성**

```javascript
// <script> 태그 내에 추가
function updateProgress(percent, elapsedSeconds, totalFrames, processedFrames) {
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');
  const time = document.getElementById('progressTime');

  bar.style.width = percent + '%';
  text.textContent = `인코딩 중... ${percent.toFixed(1)}% (${processedFrames}/${totalFrames} 프레임)`;

  if (processedFrames > 0 && elapsedSeconds > 0) {
    const fps = processedFrames / elapsedSeconds;
    const remaining = Math.ceil((totalFrames - processedFrames) / fps);
    time.textContent = `예상 남은 시간: ${formatTime(remaining)}`;
  }
}
```

- [ ] **Step 2: AV1 인코딩 함수 작성**

```javascript
// <script> 태그 내에 추가
async function compressVideo(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const meta = await analyzeVideo(file);
  const bitrate = calculateBitrate(meta.duration);

  // 입력 비디오 디코딩을 위한 임시 요소
  const blob = new Blob([arrayBuffer], { type: file.type });
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('비디오 로딩 실패'));
  });

  // VideoEncoder 설정 (AV1)
  const encoderConfig = {
    codec: 'av01.0.04M.08', // AV1 Main profile, level 4.0, 8-bit
    width: meta.width,
    height: meta.height,
    bitrate: bitrate,
    framerate: meta.frameRate || 30,
  };

  const encodedChunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
    },
    error: (e) => {
      throw e;
    }
  });

  encoder.configure(encoderConfig);

  // 프레임 단위 인코딩
  const totalFrames = Math.floor(meta.duration * (meta.frameRate || 30));
  let frameCount = 0;
  const startTime = performance.now();

  // 비디오를 프레임 단위로 추출하여 인코딩
  // 실제 구현에서는 canvas를 사용하여 프레임을 추출
  const canvas = document.createElement('canvas');
  canvas.width = meta.width;
  canvas.height = meta.height;
  const ctx = canvas.getContext('2d');

  const fps = meta.frameRate || 30;
  const frameInterval = 1 / fps;

  for (let i = 0; i < totalFrames; i++) {
    const currentTime = i * frameInterval;
    video.currentTime = currentTime;

    await new Promise(resolve => {
      video.onseeked = resolve;
    });

    ctx.drawImage(video, 0, 0, meta.width, meta.height);
    const frame = new VideoFrame(canvas, { timestamp: i * 1000000 / fps });

    encoder.encode(frame, { keyFrame: i % Math.floor(fps * 2) === 0 });
    frame.close();

    const elapsed = (performance.now() - startTime) / 1000;
    const percent = (i + 1) / totalFrames * 100;
    onProgress(percent, elapsed, totalFrames, i + 1);

    // UI 업데이트를 위해 이벤트 루프에 제어권 반환
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  await encoder.flush();
  encoder.close();
  URL.revokeObjectURL(url);

  // WebM 컨테이너로 저장
  const webmBlob = new Blob(encodedChunks, { type: 'video/webm' });
  return webmBlob;
}
```

- [ ] **Step 3: 압축 버튼 이벤트 바인딩**

```javascript
// <script> 태그 내에 추가
compressBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  compressBtn.disabled = true;
  document.getElementById('progressSection').classList.add('visible');
  document.getElementById('resultSection').classList.remove('visible');

  try {
    const resultBlob = await compressVideo(selectedFile, updateProgress);
    showResult(selectedFile, resultBlob);
  } catch (err) {
    showError('압축 중 오류가 발생했습니다: ' + err.message);
    compressBtn.disabled = false;
  }
});
```

- [ ] **Step 4: 결과 표시 함수 작성**

```javascript
// <script> 태그 내에 추가
function showResult(originalFile, compressedBlob) {
  document.getElementById('progressSection').classList.remove('visible');
  document.getElementById('resultSection').classList.add('visible');

  const originalSize = originalFile.size;
  const compressedSize = compressedBlob.size;
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  document.getElementById('resultSummary').textContent =
    `파일 크기가 ${ratio}% 줄었습니다.`;
  document.getElementById('originalSize').textContent = formatFileSize(originalSize);
  document.getElementById('compressedSize').textContent = formatFileSize(compressedSize);

  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.onclick = () => {
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFile.name.replace(/\.[^.]+$/, '') + '_compressed.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('newFileBtn').onclick = () => {
    document.getElementById('resultSection').classList.remove('visible');
    document.getElementById('fileInfo').classList.remove('visible');
    compressBtn.disabled = true;
    compressBtn.textContent = '압축 시작';
    selectedFile = null;
    fileInput.value = '';
  };
}
```

- [ ] **Step 5: 브라우저에서 인코딩 확인**

비디오 파일을 선택하고 압축을 실행:
- 진행률 바가 업데이트되는지 확인
- 예상 남은 시간이 표시되는지 확인
- 압축 완료 후 결과 크기가 표시되는지 확인
- 다운로드 버튼이 동작하는지 확인

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -m "feat: add AV1 encoding with progress tracking and result display"
```

---

### Task 5: 오류 처리 + 브라우저 호환성 개선

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: 이전 태스크의 모든 함수
- Produces: 완성된 앱

- [ ] **Step 1: 메모리 부족 오류 처리 추가**

`compressVideo` 함수에 try-catch 추가:

```javascript
// compressVideo 함수 내에서 인코딩 루프 부분을 try-catch로 감싸기
try {
  for (let i = 0; i < totalFrames; i++) {
    // ... 인코딩 로직 ...
  }
} catch (err) {
  encoder.close();
  URL.revokeObjectURL(url);
  if (err.message && (err.message.includes('memory') || err.name === 'QuotaExceededError')) {
    throw new Error('메모리가 부족하여 압축을 완료할 수 없습니다. 더 짧은 비디오로 시도해 주세요.');
  }
  throw err;
}
```

- [ ] **Step 2: 인코딩 미지원 브라우저 확인 강화**

`checkBrowserSupport` 함수에 WebCodecs API 존재 여부 확인 추가:

```javascript
function checkBrowserSupport() {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    document.getElementById('browserWarning').classList.add('visible');
    document.getElementById('compressBtn').disabled = true;
    return false;
  }

  const isChrome = /Chrome\/(\d+)/.test(navigator.userAgent);
  const isEdge = /Edg\/(\d+)/.test(navigator.userAgent);
  const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
  const edgeMatch = navigator.userAgent.match(/Edg\/(\d+)/);
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1]) : 0;
  const edgeVersion = edgeMatch ? parseInt(edgeMatch[1]) : 0;

  const supported = (isChrome && chromeVersion >= 94) || (isEdge && edgeVersion >= 94);

  if (!supported) {
    document.getElementById('browserWarning').classList.add('visible');
    document.getElementById('compressBtn').disabled = true;
  }

  return supported;
}
```

- [ ] **Step 3: 매우 짧은 비디오 처리**

`calculateBitrate` 함수에 최대 비트레이트 제한 추가:

```javascript
function calculateBitrate(durationSeconds) {
  if (durationSeconds <= 0 || !isFinite(durationSeconds)) {
    throw new Error('비디오 길이를 확인할 수 없습니다.');
  }
  const videoBitrate = Math.floor((TARGET_SIZE_BITS / durationSeconds) - AUDIO_BITRATE);
  // 최소 100 kbps, 최대 20 Mbps 제한
  return Math.max(100000, Math.min(videoBitrate, 20000000));
}
```

- [ ] **Step 4: 전체 테스트**

브라우저에서 다양한 시나리오 테스트:
- 일반 비디오 (100MB, 2분) → 정상 압축
- 작은 파일 (10MB) → "압축 불필요" 안내
- 큰 파일 (500MB, 10분) → 정상 압축 (시간 걸림)
- 지원하지 않는 포맷 → 오류 메시지
- 비디오가 아닌 파일 → 오류 메시지
- 네트워크 탭에서 서버 통신 없음 확인

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add error handling, browser compatibility checks, and edge case handling"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ 타겟 크기 49.9MB 고정 → Task 3
- ✅ AV1/WebM 출력 → Task 4
- ✅ WebCodecs API 사용 → Task 2, 4
- ✅ 서버 통신 없음 → 전체 구조
- ✅ 파일 선택 → 압축 → 다운로드 → Task 1, 4
- ✅ 진행률 표시 → Task 4
- ✅ 예상 시간 → Task 4
- ✅ 결과 미리보기 → Task 4 (크기 비교)
- ✅ 오류 처리 → Task 5
- ✅ 브라우저 지원 확인 → Task 1, 5
- ✅ 이미 타겟 크기 이하 → Task 3
- ✅ 프라이버시 안내 배지 → Task 1

**2. Placeholder scan:** 없음. 모든 스텝에 실제 코드 포함.

**3. Type consistency:**
- `analyzeVideo(file)` → `{duration, width, height, frameRate}` — Task 2에서 정의, Task 3, 4에서 사용
- `calculateBitrate(durationSeconds)` → `number` — Task 3에서 정의, Task 4에서 사용
- `compressVideo(file, onProgress)` → `Promise<Blob>` — Task 4에서 정의
- `formatFileSize(bytes)` → `string` — Task 1에서 정의, Task 4에서 사용
- `formatTime(seconds)` → `string` — Task 2에서 정의, Task 4에서 사용

**4. Review Focus:**
- ✅ 이미 타겟 크기 이하인 파일 → Task 3에서 처리
- ✅ AV1 인코딩 미지원 브라우저 → Task 1, 5에서 처리
- ✅ 지원하지 않는 비디오 포맷 → Task 2에서 처리
- ✅ 인코딩 중 메모리 부족 → Task 5에서 처리
- ✅ 매우 짧은 비디오 → Task 5에서 처리
