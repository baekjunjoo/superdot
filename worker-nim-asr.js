/* ─────────────────────────────────────────────────────────────────────────
   Super Dot — NVIDIA NIM ASR 프록시 (Cloudflare Workers)
   ---------------------------------------------------------------------------
   슈퍼닷 SETUP의 "NVIDIA ASR 프록시 URL"에 이 워커의 URL을 넣으세요.

   클라이언트(슈퍼닷) ↔ 이 워커 계약:
     POST  (multipart/form-data)
        audio     : 오디오 blob (webm/opus, ~4초 구간)
        language  : "auto" | "ko" | "en" ...
     응답: JSON  { "text": "인식된 문장" }

   이 워커 ↔ NVIDIA 계약:
     - NVIDIA_API_KEY 환경변수(Workers Secret)에 build.nvidia.com API 키를 넣으세요.
     - 아래 NVIDIA_ASR_URL / 요청 형식은 사용할 모델(whisper/canary/parakeet)의
       공식 문서(build.nvidia.com 각 모델 페이지 "API" 탭)에 맞춰 확인/수정하세요.
       모델마다 입력(파일 필드명·샘플레이트·인코딩)과 응답 JSON 구조가 다릅니다.
   ───────────────────────────────────────────────────────────────────────── */

const NVIDIA_ASR_URL = "https://integrate.api.nvidia.com/v1/audio/transcriptions"; // ← 모델 문서에 맞게 확인/수정
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST")
      return json({ error: "POST only" }, 405);

    try {
      const inForm = await request.formData();
      const audio = inForm.get("audio");
      const language = (inForm.get("language") || "auto").toString();
      if (!audio) return json({ error: "no audio" }, 400);

      // NVIDIA로 포워딩 (모델 문서에 맞춰 필드/헤더 조정)
      const out = new FormData();
      out.append("file", audio, "chunk.webm");
      // 예: whisper 계열은 language 파라미터 지원. auto면 생략해 자동 감지.
      if (language && language !== "auto") out.append("language", language);
      // 필요 시 모델명 지정: out.append("model", "openai/whisper-large-v3");

      const resp = await fetch(NVIDIA_ASR_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
        body: out,
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        return json({ error: `nvidia ${resp.status}`, detail: t.slice(0, 300) }, 502);
      }

      const data = await resp.json().catch(() => ({}));
      // NVIDIA 응답에서 전사 텍스트 추출 (모델별 키가 다를 수 있음)
      const text =
        data.text ||
        data.transcript ||
        (data.results && data.results[0] && (data.results[0].transcript || data.results[0].text)) ||
        "";

      return json({ text: String(text).trim() });
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
