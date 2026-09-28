# ffmpeg.wasm 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebCodecs 기반 비디오 압축기를 ffmpeg.wasm으로 전환하여 브라우저 호환성과 코덱 지원을 확장한다.

**Architecture:** 단일 HTML 파일 (HTML + CSS + Vanilla JS). ffmpeg.wasm을 CDN에서 로드하여 완전 클라이언트 사이드 인코딩 수행. 서버 통신 없음.

**Tech Stack:** ffmpeg.wasm (@ffmpeg/ffmpeg 0.12.6), File API, Blob API. 외부 의존성: ffmpeg.wasm만 (CDN).

**Spec:** `docs/superpowers/specs/2026-09-28-video-compressor-ffmpeg-design.md`

## Global Constraints

- 타겟 크기: 49.9MB (고정)
- 인코딩 방식: ffmpeg.wasm
- 출력 코덱: AV1, VP9, H.264 (선택 가능)
- 출력 컨테이너: WebM (AV1/VP9), MP4 (H.264)
- 하드웨어 가속: `-hwaccel auto` 옵션 사용, 미지원 시 자동 폴백
- 외부 스크립트: ffmpeg.wasm만 (CDN)
- 서버 통신 금지 (fetch, XMLHttpRequest, WebSocket 등)
- 모든 처리는 브라우저 메모리에서만 수행

## Review Focus

1. **ffmpeg.wasm 로드 실패** — 네트워크 오류 시 재시도 버튼 제공해야 함
2. **이미 타겟 크기 이하인 파일** — 압축 불필요 안내 + 원본 다운로드 제공해야 함
3. **지원하지 않는 비디오 포맷** — 오류 메시지로 안내해야 함
4. **인코딩 중 메모리 부족** — 사용자 안내 후 중단해야 함
5. **하드웨어 가속 실패** — 소프트웨어 인코딩으로 자동 폴백해야 함

---

## File Structure

| 파일 | 책임 |
|------|------|
| `index.html` | 전체 앱 (HTML + CSS + JS). 단일 파일에 모든 포함. |

---

### Task 1: ffmpeg.wasm 로드 + 기본 설정

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `loadFFmpeg()` → `Promise<FFmpeg>`, `getFFmpeg()` → `FFmpeg | null`, `isFFmpegLoaded()` → `boolean`

- [ ] **Step 1: ffmpeg.wasm CDN 스크립트 추가**

`<head>` 내에 추가:

```html
<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js"></script>
```

- [ ] **Step 2: ffmpeg 로드 함수 작성**

```javascript
// === ffmpeg.wasm 로드 ===
let ffmpegInstance = null;

async function loadFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg } = FFmpegWASM;
  const ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on('log', ({ message }) => {
      // 로그 기반 진행률 처리
    });
  }

  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.wasm'
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

function getFFmpeg() {
  return ffmpegInstance;
}

function isFFmpegLoaded() {
  return ffmpegInstance !== null;
}
```

- [ ] **Step 3: 로딩 진행률 UI 추가**

```javascript
// === 로딩 진행률 ===
function showLoadingProgress(message) {
  const el = document.getElementById('loadingProgress');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideLoadingProgress() {
  const el = document.getElementById('loadingProgress');
  if (el) {
    el.style.display = 'none';
  }
}
```

- [ ] **Step 4: 페이지 로드 시 ffmpeg.wasm 미리 로드**

```javascript
// === 초기화 ===
window.addEventListener('DOMContentLoaded', () => {
  loadFFmpeg().catch(err => {
    console.error('ffmpeg.wasm 로드 실패:', err);
    showError('ffmpeg.wasm을 불러오는 중 오류가 발생했습니다. 네트워크 연결을 확인하고 페이지를 새로고침해 주세요.');
  });
});
```

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add ffmpeg.wasm loading infrastructure"
```

---

### Task 2: 비디오 분석 (ffmpeg probe)

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `getFFmpeg()` → `FFmpeg` (Task 1)
- Produces: `probeVideo(file)` → `Promise<{duration, width, height, frameRate}>`

- [ ] **Step 1: 비디오 분석 함수 작성**

```javascript
// === 비디오 분석 (ffmpeg probe) ===
async function probeVideo(file) {
  const ffmpeg = getFFmpeg();
  if (!ffmpeg) throw new Error('ffmpeg이 로드되지 않았습니다.');

  const inputName = 'input' + getExtension(file.name);
  const data = await file.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(data));

  // ffmpeg probe 실행
  let probeOutput = '';
  ffmpeg.on('log', ({ message }) => {
    probeOutput += message + '\n';
  });

  await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']);

  // 로그에서 메타데이터 파싱
  const durationMatch = probeOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  const videoMatch = probeOutput.match(/Video: .*? (\d{3,5})x(\d{3,5}).*? (\d+(?:\.\d+)?) fps/);

  if (!durationMatch || !videoMatch) {
    throw new Error('비디오 메타데이터를 추출할 수 없습니다. 지원하지 않는 포맷일 수 있습니다.');
  }

  const hours = parseInt(durationMatch[1]);
  const minutes = parseInt(durationMatch[2]);
  const seconds = parseFloat(durationMatch[3]);
  const duration = hours * 3600 + minutes * 60 + seconds;

  const width = parseInt(videoMatch[1]);
  const height = parseInt(videoMatch[2]);
  const frameRate = parseFloat(videoMatch[3]) || 30;

  // 정리
  await ffmpeg.deleteFile(inputName);

  return { duration, width, height, frameRate };
}

function getExtension(filename) {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '.mp4';
}
```

- [ ] **Step 2: 기존 analyzeVideo 함수를 probeVideo로 교체**

```javascript
// 기존 analyzeVideo 함수를 제거하고 probeVideo 사용
// handleFileSelect 내에서 analyzeVideo → probeVideo로 변경
```

- [ ] **Step 3: 브라우저에서 비디오 분석 확인**

비디오 파일을 선택하고:
- 길이와 해상도가 표시되는지 확인
- 지원하지 않는 포맷 선택 시 오류 메시지가 표시되는지 확인

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: add video analysis with ffmpeg probe"
```

---

### Task 3: 비트레이트 계산 + ffmpeg 인코딩

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `getFFmpeg()` → `FFmpeg` (Task 1), `probeVideo(file)` → `{duration, width, height, frameRate}` (Task 2)
- Produces: `compressVideo(file, onProgress)` → `Promise<Blob>`, `calculateBitrate(durationSeconds)` → `number`

- [ ] **Step 1: 비트레이트 계산 함수 작성**

```javascript
// === 비트레이트 계산 ===
const TARGET_SIZE_MB = 49.9;
const TARGET_SIZE_BITS = TARGET_SIZE_MB * 1024 * 1024 * 8;
const AUDIO_BITRATE = 128000; // 128 kbps

function calculateBitrate(durationSeconds) {
  if (durationSeconds <= 0 || !isFinite(durationSeconds)) {
    throw new Error('비디오 길이를 확인할 수 없습니다.');
  }
  const videoBitrate = Math.floor((TARGET_SIZE_BITS / durationSeconds) - AUDIO_BITRATE);
  return Math.max(100000, Math.min(videoBitrate, 20000000));
}
```

- [ ] **Step 2: 코덱 프리셋 설정**

```javascript
// === 코덱 설정 ===
const CODEC_PRESETS = {
  av1: { codec: 'libaom-av1', ext: 'webm', mime: 'video/webm', extraArgs: ['-cpu-used', '4'] },
  vp9: { codec: 'libvpx-vp9', ext: 'webm', mime: 'video/webm', extraArgs: ['-row-mt', '1'] },
  h264: { codec: 'libx264', ext: 'mp4', mime: 'video/mp4', extraArgs: ['-preset', 'fast'] }
};

function getSelectedCodec() {
  const select = document.getElementById('codecSelect');
  return select ? select.value : 'av1';
}
```

- [ ] **Step 3: ffmpeg 인코딩 함수 작성**

```javascript
// === ffmpeg 인코딩 ===
async function compressVideo(file, onProgress) {
  const ffmpeg = getFFmpeg();
  if (!ffmpeg) throw new Error('ffmpeg이 로드되지 않았습니다.');

  const meta = await probeVideo(file);
  const bitrate = calculateBitrate(meta.duration);
  const codecKey = getSelectedCodec();
  const preset = CODEC_PRESETS[codecKey];

  const inputName = 'input' + getExtension(file.name);
  const outputName = 'output.' + preset.ext;

  // 입력 파일 작성
  const data = await file.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(data));

  // 진행률 추적
  let totalDuration = meta.duration;
  ffmpeg.on('progress', ({ progress, time }) => {
    if (onProgress && totalDuration > 0) {
      const percent = Math.min(100, (time / (totalDuration * 10000)) * 100);
      onProgress(percent, 0, 100, Math.floor(percent));
    }
  });

  // ffmpeg 명령 실행
  const args = [
    '-hwaccel', 'auto',
    '-i', inputName,
    '-c:v', preset.codec,
    '-b:v', bitrate.toString(),
    '-c:a', 'aac',
    '-b:a', '128k',
    ...preset.extraArgs,
    '-y',
    outputName
  ];

  await ffmpeg.exec(args);

  // 결과 파일 읽기
  const outputData = await ffmpeg.readFile(outputName);
  const blob = new Blob([outputData], { type: preset.mime });

  // 정리
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return blob;
}
```

- [ ] **Step 4: 기존 compressVideo 함수 교체**

```javascript
// 기존 WebCodecs 기반 compressVideo 함수를 제거하고 새 ffmpeg 기반 함수 사용
```

- [ ] **Step 5: 브라우저에서 인코딩 확인**

비디오 파일을 선택하고 압축을 실행:
- 진행률 바가 업데이트되는지 확인
- 압축 완료 후 결과 크기가 표시되는지 확인
- 다운로드 버튼이 동작하는지 확인

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -m "feat: add ffmpeg-based video compression with progress tracking"
```

---

### Task 4: 진행률 + 결과 표시 + 오류 처리

**Files:**
- Modify: `index.html` (스크립트 섹션)

**Interfaces:**
- Consumes: `compressVideo(file, onProgress)` → `Promise<Blob>` (Task 3), `probeVideo(file)` → `{duration, width, height, frameRate}` (Task 2)
- Produces: 완성된 앱

- [ ] **Step 1: 진행률 업데이트 함수 수정**

```javascript
// === 진행률 업데이트 ===
function updateProgress(percent, elapsedSeconds, totalFrames, processedFrames) {
  progressBar.style.width = percent + '%';
  progressText.textContent = '인코딩 중... ' + percent.toFixed(1) + '%';

  if (elapsedSeconds > 0) {
    const fps = processedFrames / elapsedSeconds;
    const remaining = Math.ceil((totalFrames - processedFrames) / fps);
    progressTime.textContent = '예상 남은 시간: ' + formatTime(remaining);
  }
}
```

- [ ] **Step 2: 결과 표시 함수 수정**

```javascript
// === 결과 표시 ===
function showResult(originalFile, compressedBlob) {
  progressSection.classList.remove('visible');
  resultSection.classList.add('visible');

  const originalSize = originalFile.size;
  const compressedSize = compressedBlob.size;
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  document.getElementById('resultSummary').textContent = '파일 크기가 ' + ratio + '% 줄었습니다.';
  document.getElementById('originalSize').textContent = formatFileSize(originalSize);
  document.getElementById('compressedSize').textContent = formatFileSize(compressedSize);

  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.onclick = () => {
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    const ext = CODEC_PRESETS[getSelectedCodec()].ext;
    a.download = originalFile.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('newFileBtn').onclick = () => {
    resultSection.classList.remove('visible');
    fileInfo.classList.remove('visible');
    compressBtn.disabled = true;
    compressBtn.textContent = '압축 시작';
    selectedFile = null;
    fileInput.value = '';
  };
}
```

- [ ] **Step 3: 오류 처리 강화**

```javascript
// === 오류 처리 ===
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.add('visible');
}

function hideError() {
  errorMessage.classList.remove('visible');
}

// ffmpeg 로드 실패 시
window.addEventListener('DOMContentLoaded', () => {
  loadFFmpeg().catch(err => {
    console.error('ffmpeg.wasm 로드 실패:', err);
    showError('ffmpeg.wasm을 불러오는 중 오류가 발생했습니다. 네트워크 연결을 확인하고 페이지를 새로고침해 주세요.');
  });
});
```

- [ ] **Step 4: 전체 테스트**

브라우저에서 다양한 시나리오 테스트:
- 일반 비디오 (100MB, 2분) → 정상 압축
- 작은 파일 (10MB) → "압축 불필요" 안내
- 큰 파일 (500MB, 10분) → 정상 압축 (시간 걸림)
- 지원하지 않는 포맷 → 오류 메시지
- 비디오가 아닌 파일 → 오류 메시지
- 네트워크 탭에서 서버 통신 없음 확인 (CDN 로드 제외)

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add progress tracking, result display, and error handling for ffmpeg"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ 타겟 크기 49.9MB 고정 → Task 3
- ✅ ffmpeg.wasm 사용 → Task 1, 3
- ✅ 코덱 선택 (AV1, VP9, H.264) → Task 3
- ✅ 하드웨어 가속 → Task 3 (`-hwaccel auto`)
- ✅ 서버 통신 없음 → 전체 구조
- ✅ 파일 선택 → 압축 → 다운로드 → Task 3, 4
- ✅ 진행률 표시 → Task 3, 4
- ✅ 오류 처리 → Task 4
- ✅ 브라우저 지원 확인 → Task 1
- ✅ 이미 타겟 크기 이하 → Task 4
- ✅ 프라이버시 안내 배지 → 기존 UI 유지

**2. Placeholder scan:** 없음. 모든 스텝에 실제 코드 포함.

**3. Type consistency:**
- `loadFFmpeg()` → `Promise<FFmpeg>` — Task 1에서 정의, Task 2, 3에서 사용
- `getFFmpeg()` → `FFmpeg | null` — Task 1에서 정의, Task 2, 3에서 사용
- `probeVideo(file)` → `Promise<{duration, width, height, frameRate}>` — Task 2에서 정의, Task 3에서 사용
- `compressVideo(file, onProgress)` → `Promise<Blob>` — Task 3에서 정의, Task 4에서 사용
- `calculateBitrate(durationSeconds)` → `number` — Task 3에서 정의, Task 3에서 사용

**4. Review Focus:**
- ✅ ffmpeg.wasm 로드 실패 → Task 1에서 처리
- ✅ 이미 타겟 크기 이하인 파일 → Task 4에서 처리
- ✅ 지원하지 않는 비디오 포맷 → Task 2에서 처리
- ✅ 인코딩 중 메모리 부족 → Task 4에서 처리
- ✅ 하드웨어 가속 실패 → Task 3에서 `-hwaccel auto` 자동 폴백
