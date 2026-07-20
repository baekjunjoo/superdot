/* fetch-assets.mjs — 힉스필드 생성 이미지를 public/img/ 로 다운로드 (자체 호스팅)
   실행: node scripts/fetch-assets.mjs */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3CcWiPncoAiF9dchSMyN7go3kbf/';
const FILES = {
  'hero.webp': 'hf_20260720_014955_37f909cb-6a00-44f6-9938-b858dc6e93bf_min.webp',
  'tile-chips.webp': 'hf_20260720_014958_88f347de-da69-4eea-b7c1-cf1e9bbe3a50_min.webp',
  'tile-cards.webp': 'hf_20260720_014959_15a0f02e-ee95-4202-8bab-b355270891d3_min.webp',
  'tile-trophy.webp': 'hf_20260720_015001_b64eadc8-3192-4f00-8a56-98f3224cf49a_min.webp',
  'tile-dotpad.webp': 'hf_20260720_023103_f4ed9987-8cd2-4173-8427-988eb42bcce3_min.webp'
};

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img');
mkdirSync(dir, { recursive: true });

for (const [name, file] of Object.entries(FILES)) {
  const res = await fetch(CDN + file);
  if (!res.ok) { console.error('실패:', name, res.status); continue; }
  writeFileSync(join(dir, name), Buffer.from(await res.arrayBuffer()));
  console.log('저장:', name);
}
console.log('완료 → public/img/');
