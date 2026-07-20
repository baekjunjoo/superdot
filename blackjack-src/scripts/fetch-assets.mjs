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
  'tile-dotpad.webp': 'hf_20260720_023103_f4ed9987-8cd2-4173-8427-988eb42bcce3_min.webp',
  'cardback.webp': 'hf_20260720_043553_59e0d734-1e89-4269-9558-8b7ce7906547_min.webp',
  'tablefelt.webp': 'hf_20260720_045609_d29accea-91cd-42ba-9792-9c08af91f4a0_min.webp',
  'av-dealer.webp': 'hf_20260720_043552_5d3ffcef-9c3f-4766-9606-d275fb4a0429_min.webp',
  'av-bear.webp': 'hf_20260720_043229_e8213d32-437d-4c74-b153-d0a13afd6705_min.webp',
  'av-rabbit.webp': 'hf_20260720_043231_80858034-fbf9-40f6-8e94-954bd4e7e45a_min.webp',
  'av-tiger.webp': 'hf_20260720_043232_4670fc09-678a-4707-947f-269076d6dbd0_min.webp',
  'av-fox.webp': 'hf_20260720_043234_74ad7845-496d-4e32-a1e0-214dc66e21e7_min.webp',
  'av-cat.webp': 'hf_20260720_043235_9912acb5-233a-4436-8b67-a7e3b792a830_min.webp',
  'av-dog.webp': 'hf_20260720_043245_630bb4a7-dc04-4300-9cb2-20e142b5e288_min.webp',
  'av-panda.webp': 'hf_20260720_043246_e4a0066a-1de8-4f9c-9c25-210ef110c51a_min.webp',
  'av-owl.webp': 'hf_20260720_043248_11eb203c-b388-4eb1-9898-19520bbf262c_min.webp'
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
