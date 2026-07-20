/* assets.js — 힉스필드(Higgsfield) 생성 이미지 (marketing_studio_image, #ea5414 / 다크 / 글로우 없음)
   로컬 파일 우선, 없으면 CDN 폴백.
   로컬 저장: `node scripts/fetch-assets.mjs` 실행 → public/img/ 에 다운로드 */

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3CcWiPncoAiF9dchSMyN7go3kbf/';

export const IMG = {
  hero:   { local: './img/hero.webp',        cdn: CDN + 'hf_20260720_014955_37f909cb-6a00-44f6-9938-b858dc6e93bf_min.webp' },
  chips:  { local: './img/tile-chips.webp',  cdn: CDN + 'hf_20260720_014958_88f347de-da69-4eea-b7c1-cf1e9bbe3a50_min.webp' },
  cards:  { local: './img/tile-cards.webp',  cdn: CDN + 'hf_20260720_014959_15a0f02e-ee95-4202-8bab-b355270891d3_min.webp' },
  trophy: { local: './img/tile-trophy.webp', cdn: CDN + 'hf_20260720_015001_b64eadc8-3192-4f00-8a56-98f3224cf49a_min.webp' },
  dotpad: { local: './img/tile-dotpad.webp', cdn: CDN + 'hf_20260720_023103_f4ed9987-8cd2-4173-8427-988eb42bcce3_min.webp' },
  /* v4 게임룸 (포커 테이블 스타일) */
  cardback:  { local: './img/cardback.webp',  cdn: CDN + 'hf_20260720_043553_59e0d734-1e89-4269-9558-8b7ce7906547_min.webp' },
  dealerbot: { local: './img/av-dealer.webp', cdn: CDN + 'hf_20260720_043552_5d3ffcef-9c3f-4766-9606-d275fb4a0429_min.webp' },
  av0: { local: './img/av-bear.webp',   cdn: CDN + 'hf_20260720_043229_e8213d32-437d-4c74-b153-d0a13afd6705_min.webp' },
  av1: { local: './img/av-rabbit.webp', cdn: CDN + 'hf_20260720_043231_80858034-fbf9-40f6-8e94-954bd4e7e45a_min.webp' },
  av2: { local: './img/av-tiger.webp',  cdn: CDN + 'hf_20260720_043232_4670fc09-678a-4707-947f-269076d6dbd0_min.webp' },
  av3: { local: './img/av-fox.webp',    cdn: CDN + 'hf_20260720_043234_74ad7845-496d-4e32-a1e0-214dc66e21e7_min.webp' },
  av4: { local: './img/av-cat.webp',    cdn: CDN + 'hf_20260720_043235_9912acb5-233a-4436-8b67-a7e3b792a830_min.webp' },
  av5: { local: './img/av-dog.webp',    cdn: CDN + 'hf_20260720_043245_630bb4a7-dc04-4300-9cb2-20e142b5e288_min.webp' },
  av6: { local: './img/av-panda.webp',  cdn: CDN + 'hf_20260720_043246_e4a0066a-1de8-4f9c-9c25-210ef110c51a_min.webp' },
  av7: { local: './img/av-owl.webp',    cdn: CDN + 'hf_20260720_043248_11eb203c-b388-4eb1-9898-19520bbf262c_min.webp' }
};

/* 플레이어 아바타 팔레트 (곰/토끼/호랑이/여우/고양이/강아지/판다/부엉이) */
export const AVATARS = ['av0', 'av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7'].map((key) => ({ key, ...IMG[key] }));

/* 로컬 → CDN → 숨김 순서로 폴백하는 onError 핸들러 */
export function imgFallback(key) {
  return (e) => {
    const el = e.target;
    if (el.dataset.stage !== 'cdn') { el.dataset.stage = 'cdn'; el.src = IMG[key].cdn; }
    else el.style.display = 'none';
  };
}
