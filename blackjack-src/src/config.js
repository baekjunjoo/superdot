/* config.js — 배포 환경 설정
   tw-app 통합 시 아래 두 값을 tw-app Supabase(nqgaqzpbhmezkrrlbbhm) 값으로 교체하세요.
   Realtime broadcast만 사용하므로 테이블/RLS 변경은 필요 없습니다. */

export const SUPABASE_URL = 'https://ilzptifmkdncllsujdms.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsenB0aWZta2RuY2xsc3VqZG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTMyODMsImV4cCI6MjA5OTU2OTI4M30.iB1kmWou6pAybDw_osgnucK3aMVV5E4ljmRLhgXXvDs';

export const MAIN_COLOR = '#ea5414';
export const MAX_SEATS = 8;            // 좌석 (초과 입장은 관전 → 자리 나면 자동 승격)
export const START_CHIPS = 100;
export const RECONNECT_GRACE_MS = 60000; // 재접속 유예 (이 시간 안에 복귀하면 자리·칩 유지)
