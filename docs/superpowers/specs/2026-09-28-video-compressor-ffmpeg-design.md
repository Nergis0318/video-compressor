# 프라이버시 보호 비디오 압축기 — ffmpeg.wasm 전환 설계

**날짜:** 2026-09-28
**상태:** 승인됨

---

## 1. 목표

기존 WebCodecs 기반 비디오 압축기를 ffmpeg.wasm으로 전환하여 브라우저 호환성과 코덱 지원을 확장한다. 타겟 크기 50MB (49.9MB) 고정은 유지된다.

## 2. 전환 이유

| WebCodecs 한계 | ffmpeg.wasm 해결 |
|----------------|------------------|
| Chrome/Edge만 AV1 인코딩 가능 | 모든 브라우저 지원 |
| 코덱 선택 제한적 | 모든 코덱 지원 |
| 하드웨어 가속 제한적 | `-hwaccel` 옵션 지원 |
| 인코딩 설정 제한적 | ffmpeg의 고급 설정 활용 가능 |

## 3. 핵심 요구사항

| 항목 | 내용 |
|------|------|
| 타겟 크기 | 49.9MB (고정) |
| 인코딩 방식 | ffmpeg.wasm |
| 출력 코덱 | AV1, VP9, H.264 (선택 가능) |
| 출력 컨테이너 | WebM (AV1/VP9), MP4 (H.264) |
| 하드웨어 가속 | 지원 시 사용, 미지원 시 소프트웨어 인코딩 |
| 프라이버시 | 서버 통신 없음, 완전 클라이언트 사이드 |

## 4. 기술 스택

- **단일 HTML 파일** (`index.html`): HTML + CSS + Vanilla JS
- **ffmpeg.wasm**: `@ffmpeg/ffmpeg` 0.12.6, CDN에서 로드
- **외부 의존성**: ffmpeg.wasm만 (CDN)

## 5. 아키텍처

### 5.1 데이터 흐름

```
사용자 파일 선택
       ↓
ffmpeg.wasm 로드 (최초 1회, ~30MB)
       ↓
파일을 ffmpeg 가상 FS에 작성
       ↓
ffmpeg 명령 실행 (코덱, 비트레이트, 하드웨어 가속 옵션)
       ↓
진행률 이벤트 수신 → UI 업데이트
       ↓
결과 파일을 가상 FS에서 읽기
       ↓
Blob 생성 → 다운로드 링크 제공
```

### 5.2 ffmpeg 명령 예시

```bash
# AV1 (하드웨어 가속 시)
ffmpeg -hwaccel auto -i input.mp4 -c:v libaom-av1 -b:v 4M -cpu-used 4 output.webm

# VP9 (하드웨어 가속 시)
ffmpeg -hwaccel auto -i input.mp4 -c:v libvpx-vp9 -b:v 4M -row-mt 1 output.webm

# H.264 (하드웨어 가속 시)
ffmpeg -hwaccel auto -i input.mp4 -c:v h264 -b:v 4M -preset fast output.mp4
```

### 5.3 비트레이트 계산

```
targetSizeBits = 49.9MB × 8 = 399,200,000 bits
videoBitrate = targetSizeBits / durationInSeconds - audioBitrate(128kbps)
```

### 5.4 주요 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| `FFmpegLoader` | ffmpeg.wasm 초기 로드 및 관리 |
| `VideoAnalyzer` | 비디오 메타데이터 추출 (ffmpeg probe) |
| `BitrateCalculator` | 타겟 크기 기반 비트레이트 계산 |
| `FFmpegEncoder` | ffmpeg 명령 실행 및 진행률 수신 |
| `ProgressTracker` | 인코딩 진행률 및 예상 시간 표시 |
| `DownloadManager` | 결과 파일 다운로드 링크 생성 |

## 6. 하드웨어 가속 전략

1. `-hwaccel auto` 옵션으로 시도
2. 지원하지 않으면 자동으로 소프트웨어 인코딩으로 폴백
3. 코덱별 하드웨어 가속 지원 여부 표시:
   - H.264: 대부분의 브라우저에서 하드웨어 가속 가능
   - VP9: Chrome에서 하드웨어 가속 가능
   - AV1: 최신 브라우저에서만 하드웨어 가속 가능

## 7. 사용자 인터페이스

기존 UI 유지 + 아래 사항 추가/변경:
- **코덱 선택기**: 유지 (AV1, VP9, H.264)
- **하드웨어 가속 표시**: 유지 (ffmpeg 지원 여부 기반)
- **로딩 표시**: ffmpeg.wasm 초기 로드 시 진행률 표시
- **진행률**: ffmpeg의 `progress` 이벤트 기반

## 8. 오류 처리

| 오류 상황 | 처리 방식 |
|-----------|-----------|
| ffmpeg.wasm 로드 실패 | 네트워크 오류 안내, 재시도 버튼 |
| 지원하지 않는 비디오 포맷 | 오류 메시지 표시 |
| 인코딩 중 메모리 부족 | 사용자 안내 후 중단 |
| 이미 타겟 크기 이하인 파일 | 압축 불필요 안내, 원본 다운로드 제공 |
| 하드웨어 가속 실패 | 소프트웨어 인코딩으로 자동 폴백 |

## 9. 보안 및 프라이버시

- **서버 통신 없음**: ffmpeg.wasm은 CDN에서 로드되지만 비디오 데이터는 서버에 업로드되지 않음
- **파일 처리**: 모든 파일은 브라우저 메모리에서만 처리
- **가상 FS**: ffmpeg.wasm의 가상 파일 시스템 내에서만 처리

## 10. 브라우저 지원

| 브라우저 | 지원 |
|----------|------|
| Chrome | 완전 지원 |
| Firefox | 완전 지원 |
| Safari | 완전 지원 |
| Edge | 완전 지원 |

## 11. 성능 고려사항

- **초기 로드**: ~30MB WASM 파일 다운로드 (최초 1회, 캐시됨)
- **인코딩 속도**: WebCodecs보다 느릴 수 있음 (WASM 오버헤드)
- **메모리 사용**: 대용량 파일 처리 시 메모리 사용량 증가 가능
- **하드웨어 가속**: 지원 시 크게 향상

## 12. 배포

- 정적 파일 호스팅 (GitHub Pages, Netlify, Vercel 등)
- 또는 로컬 파일로 직접 사용 가능 (`index.html` 더블클릭)
