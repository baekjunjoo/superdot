/**
 * Super Dot — Anthropic API proxy (Cloudflare Workers)
 *
 * 배포:
 *   1) https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2) 이 파일 내용을 붙여넣고 Deploy
 *   3) Worker → Settings → Variables → Secrets 에 추가:
 *        ANTHROPIC_API_KEY = sk-ant-...
 *      (선택) ALLOWED_ORIGIN = https://baekjunjoo.github.io
 *   4) Worker URL(예: https://superdot-proxy.xxxx.workers.dev)을
 *      사이트 상단 SETUP → Generation API Endpoint 에 입력
 *
 * 키는 Worker 안에만 존재하며 클라이언트로 노출되지 않습니다.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const okOrigin = allowed === "*" || origin === allowed;

    const corsHeaders = {
      "Access-Control-Allow-Origin": okOrigin ? (allowed === "*" ? "*" : origin) : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405, headers: corsHeaders });
    }
    if (!okOrigin) {
      return new Response(JSON.stringify({ error: { message: "Origin not allowed" } }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: { message: "Invalid JSON" } }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 간단한 가드: 모델/토큰 상한 고정 (프록시 남용 방지)
    body.model = "claude-sonnet-4-20250514";
    body.max_tokens = Math.min(body.max_tokens || 1000, 2000);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
