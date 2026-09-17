// 인증키가 작동하는지 확인하는 스크립트
// 실행: node --env-file=.env scripts/check-api.mjs

const BASE = 'https://api.odcloud.kr/api/gov24/v3';
const key = (process.env.DATA_GO_KR_KEY || '').trim();

if (!key) {
  console.log('❌ .env 파일에 인증키가 없어요. DATA_GO_KR_KEY= 뒤에 키를 붙여넣고 저장하세요.');
  process.exit(1);
}

// Encoding 키(% 포함)를 넣었으면 그대로, Decoding 키면 주소용으로 변환
const serviceKey = key.includes('%') ? key : encodeURIComponent(key);

async function call(path, params = '') {
  const url = `${BASE}/${path}?page=1&perPage=3&returnType=JSON&serviceKey=${serviceKey}${params}`;
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!res.ok || !body || body.code < 0) {
    throw new Error(`${res.status} ${body?.msg || text.slice(0, 200)}`);
  }
  return body;
}

const checks = [
  ['serviceList', '공공서비스 목록'],
  ['serviceDetail', '공공서비스 상세내용'],
  ['supportConditions', '공공서비스 지원조건']
];

let ok = true;
for (const [path, label] of checks) {
  try {
    const body = await call(path);
    console.log(`✅ ${label}: 전체 ${body.totalCount.toLocaleString()}건`);
    if (path === 'serviceList') {
      body.data.forEach((s) => console.log(`   - ${s['서비스명']} (${s['소관기관명']}, ${s['서비스분야']})`));
    }
  } catch (e) {
    ok = false;
    console.log(`❌ ${label}: ${e.message}`);
  }
}

if (!ok) {
  console.log('\n💡 신청 직후라면 1~2시간 뒤에 다시 해보세요. (SERVICE KEY IS NOT REGISTERED 오류는 대부분 시간이 지나면 해결돼요)');
  process.exit(1);
}
console.log('\n🎉 인증키가 정상 작동해요!');
