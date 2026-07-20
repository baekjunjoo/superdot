/* assets.js — 힉스필드(Higgsfield) 생성 이미지 (marketing_studio_image, #ea5414 / 다크 / 글로우 없음)
   로컬 파일 우선, 없으면 CDN 폴백.
   로컬 저장: `node scripts/fetch-assets.mjs` 실행 → public/img/ 에 다운로드 */

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3CcWiPncoAiF9dchSMyN7go3kbf/';

export const IMG = {
  hero:   { local: './img/hero.webp',        cdn: CDN + 'hf_20260720_014955_37f909cb-6a00-44f6-9938-b858dc6e93bf_min.webp' },
  chips:  { local: './img/tile-chips.webp',  cdn: CDN + 'hf_20260720_014958_88f347de-da69-4eea-b7c1-cf1e9bbe3a50_min.webp' },
  cards:  { local: './img/tile-cards.webp',  cdn: CDN + 'hf_20260720_014959_15a0f02e-ee95-4202-8bab-b355270891d3_min.webp' },
  trophy: { local: './img/tile-trophy.webp', cdn: CDN + 'hf_20260720_015001_b64eadc8-3192-4f00-8a56-98f3224cf49a_min.webp' },
  dotpad: { local: './img/tile-dotpad.webp', cdn: CDN + 'hf_20260720_023103_f4ed9987-8cd2-4173-8427-988eb42bcce3_min.webp' }
};

/* 로컬 → CDN → 숨김 순서로 폴백하는 onError 핸들러 */
export function imgFallback(key) {
  return (e) => {
    const el = e.target;
    if (el.dataset.stage !== 'cdn') { el.dataset.stage = 'cdn'; el.src = IMG[key].cdn; }
    else el.style.display = 'none';
  };
}
