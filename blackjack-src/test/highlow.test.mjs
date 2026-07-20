/* highlow.test.mjs — 하이·로우 로직 + 컨트롤러 검증 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');
import { judge, rankOrder } from '../src/game/highlow.js';
import { createHighLow } from '../src/game/highlowController.js';

const t = makeChecker();
const C = (r, s = 'S') => ({ r, s });
console.log('── 하이·로우 테스트 ──');

t.ok('A는 최저(1)', rankOrder('A') === 1);
t.ok('K는 최고(13)', rankOrder('K') === 13);
t.ok('10 < J', rankOrder('10') < rankOrder('J'));

t.ok('하이 정답 (5→9)', judge(C('5'), C('9'), 'high') === 'win');
t.ok('하이 오답 (9→5)', judge(C('9'), C('5'), 'high') === 'lose');
t.ok('로우 정답 (9→5)', judge(C('9'), C('5'), 'low') === 'win');
t.ok('로우 오답 (5→9)', judge(C('5'), C('9'), 'low') === 'lose');
t.ok('같은 숫자 무승부', judge(C('7', 'S'), C('7', 'H'), 'high') === 'tie');
t.ok('A→K 하이 정답', judge(C('A'), C('K'), 'high') === 'win');

{
  const speeches = [];
  const g = createHighLow({
    say: (x) => speeches.push(x),
    deckFactory: () => [{ r: 'K', s: 'S' }, { r: '3', s: 'D' }, { r: '3', s: 'C' }, { r: '9', s: 'H' }, { r: '5', s: 'S' }]
  });
  g.start();
  t.ok('시작: 현재 5', g.state.current.r === '5' && g.state.phase === 'guess');
  g.onKey('F1');
  t.ok('1연승', g.state.streak === 1 && g.state.score === 1 && g.state.current.r === '9');
  g.onKey('F2');
  t.ok('2연승', g.state.streak === 2 && g.state.current.r === '3');
  g.onKey('F1');
  t.ok('무승부 유지', g.state.streak === 2 && g.state.last === 'tie');
  g.onKey('F2');
  t.ok('오답 → 게임오버', g.state.phase === 'over' && g.state.score === 2);
  t.ok('최고 연승 기록', g.state.best === 2);
  const f = g.frame();
  t.ok('닷패드 프레임 10행', f.rows.length === 10 && f.rows.every((r) => r.length === 60));
  g.onKey('F1');
  t.ok('재시작', g.state.phase === 'guess' && g.state.score === 0);
}

process.exit(t.summary());
