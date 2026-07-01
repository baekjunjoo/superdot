/* ─────────────────────────────────────────────────────────────────────────
   Super Dot — NVIDIA NIM 통합 프록시 (Cloudflare Workers)  ·  키 1개 / 프록시 1개
   ---------------------------------------------------------------------------
   슈퍼닷 SETUP의 "NVIDIA NIM 프록시 URL"에 이 워커의 URL(끝에 / 없이)을 넣으세요.
   워커가 경로로 기능을 분기합니다:
     POST {URL}/asr        ← 자막·회의록 음성 인식 (+ 선택적 마이크 잡음 제거)
     POST {URL}/translate  ← 실시간 번역 자막

   준비:
     1) build.nvidia.com 에서 API 키(nvapi-...) 발급 — 계정당 1개로 모든 모델 사용.
     2) Cloudflare Workers Secret 로 NVIDIA_API_KEY 등록.
     3) 아래 *_URL / 요청·응답 형식은 각 모델 페이지(build.nvidia.com)의 "API" 탭에
        맞춰 확인·수정하세요. 모델마다 필드명·응답 구조가 다릅니다.

   ── 클라이언트(슈퍼닷) 계약 ──
   /asr        : multipart(form-data) audio=<blob>, language="auto|ko|en", denoise="true|false"
                 → JSON { "text": "인식 문장" }
   /translate  : JSON { "text":"원문", "target":"en|ko|ja" }
                 → JSON { "text": "번역문" }
   ───────────────────────────────────────────────────────────────────────── */

// 각 모델 문서에 맞춰 확인/수정
const ASR_URL       = "https://integrate.api.nvidia.com/v1/audio/transcriptions"; // whisper/canary/parakeet
const TRANSLATE_URL = "https://integrate.api.nvidia.com/v1/translate";             // riva-translate (예시)
const DENOISE_URL   = "https://integrate.api.nvidia.com/v1/audio/denoise";         // Maxine BNR/Studio Voice (예시)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const key = env.NVIDIA_API_KEY;
    try {
      if (request.method === "POST" && path.endsWith("/asr")) return await handleAsr(request, key);
      if (request.method === "POST" && path.endsWith("/translate")) return await handleTranslate(request, key);
      return json({ error: "not found", path }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};

async function handleAsr(request, key) {
  const inForm = await request.formData();
  let audio = inForm.get("audio");
  const language = (inForm.get("language") || "auto").toString();
  const denoise = (inForm.get("denoise") || "false").toString() === "true";
  if (!audio) return json({ error: "no audio" }, 400);

  // (선택) 마이크 잡음 제거: Maxine 로 오디오 정제 후 ASR
  if (denoise) {
    try {
      const dform = new FormData();
      dform.append("file", audio, "chunk.webm");
      const dresp = await fetch(DENOISE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: dform,
      });
      if (dresp.ok) audio = await dresp.blob();   // 정제된 오디오로 교체
      // 실패하면 원본 오디오로 계속 진행(폴백)
    } catch (_) {}
  }

  const out = new FormData();
  out.append("file", audio, "chunk.webm");
  if (language && language !== "auto") out.append("language", language);
  // 필요 시: out.append("model", "openai/whisper-large-v3");

  const resp = await fetch(ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: out,
  });
  if (!resp.ok) return json({ error: `asr ${resp.status}`, detail: (await safeText(resp)).slice(0, 300) }, 502);
  const data = await resp.json().catch(() => ({}));
  const text = data.text || data.transcript ||
    (data.results && data.results[0] && (data.results[0].transcript || data.results[0].text)) || "";
  return json({ text: String(text).trim() });
}

async function handleTranslate(request, key) {
  const body = await request.json().catch(() => ({}));
  const text = (body.text || "").toString();
  const target = (body.target || "en").toString();
  if (!text) return json({ text: "" });

  // riva-translate 예시 페이로드 — 모델 문서에 맞춰 조정
  const resp = await fetch(TRANSLATE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], target_language: target, source_language: "auto" }),
  });
  if (!resp.ok) return json({ error: `translate ${resp.status}`, detail: (await safeText(resp)).slice(0, 300) }, 502);
  const data = await resp.json().catch(() => ({}));
  const out = data.text || data.translation ||
    (Array.isArray(data.translations) && (data.translations[0].text || data.translations[0])) ||
    (Array.isArray(data.text) && data.text[0]) || "";
  return json({ text: String(out).trim() });
}

async function safeText(r) { try { return await r.text(); } catch (_) { return ""; } }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
