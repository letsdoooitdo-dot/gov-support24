// 보조금24 전체 데이터를 받아서 블로그용 파일로 정리
// 실행: node --env-file=.env scripts/fetch-data.mjs
//       node scripts/fetch-data.mjs --cache   (받아둔 원본으로 파일만 다시 만들기)
//
// 만들어지는 파일
//   data/list.json         검색용 (전체 지원금의 요약 + 조건)
//   data/detail/{ID}.json  상세 화면용 (지원금 1개당 1파일)
//   data/meta.json         갱신 시각, 건수
//   .cache/raw-*.json      원본 데이터 (분석용, 인터넷에 올리지 않음)

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { benefitLabel } from './benefit-label.mjs';

const BASE = 'https://api.odcloud.kr/api/gov24/v3';
const PER_PAGE = 1000;
const key = (process.env.DATA_GO_KR_KEY || '').trim();
if (!key && !process.argv.includes('--cache')) {
  console.error('❌ .env 파일에 DATA_GO_KR_KEY가 없어요.');
  process.exit(1);
}
const serviceKey = key.includes('%') ? key : encodeURIComponent(key);

const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도',
  '전남광주통합특별시', '경상북도', '경상남도', '제주특별자치도'
];
const OLD_REGION_NAMES = {
  '강원도': '강원특별자치도', '전라북도': '전북특별자치도', '제주도': '제주특별자치도', '세종시': '세종특별자치시',
  '광주광역시': '전남광주통합특별시', '전라남도': '전남광주통합특별시'
};

// 조건 묶음: 묶음 안 코드가 전부 Y이거나 '해당없음'(open)이 Y면 누구나 대상 → 저장 안 함
const COND_GROUPS = [
  { codes: ['JA0101', 'JA0102'] },
  { codes: ['JA0201', 'JA0202', 'JA0203', 'JA0204', 'JA0205'] },
  { codes: ['JA0301', 'JA0302', 'JA0303', 'JA0313', 'JA0314', 'JA0315', 'JA0316', 'JA0317', 'JA0318', 'JA0319', 'JA0320', 'JA0326', 'JA0327', 'JA0328', 'JA0329', 'JA0330'], open: 'JA0322' },
  { codes: ['JA0401', 'JA0402', 'JA0403', 'JA0404', 'JA0411', 'JA0412', 'JA0413', 'JA0414'], open: 'JA0410' },
  { codes: ['JA1101', 'JA1102', 'JA1103'] },
  { codes: ['JA1201', 'JA1202', 'JA1299'] },
  { codes: ['JA2101', 'JA2102', 'JA2103'] },
  { codes: ['JA2201', 'JA2202', 'JA2203', 'JA2299'] }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(path, page) {
  const url = `${BASE}/${path}?page=${page}&perPage=${PER_PAGE}&returnType=JSON&serviceKey=${serviceKey}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok || !Array.isArray(body.data)) throw new Error(`${res.status} ${body.msg || ''}`);
      return body;
    } catch (e) {
      if (attempt >= 4) throw new Error(`${path} ${page}페이지 실패: ${e.message}`);
      await sleep(2000 * attempt);
    }
  }
}

async function fetchAll(path, label) {
  const first = await fetchPage(path, 1);
  const pages = Math.ceil(first.totalCount / PER_PAGE);
  const rows = [...first.data];
  process.stdout.write(`📥 ${label}: 1/${pages}`);
  for (let page = 2; page <= pages; page++) {
    await sleep(300);
    rows.push(...(await fetchPage(path, page)).data);
    process.stdout.write(`\r📥 ${label}: ${page}/${pages}`);
  }
  console.log(` → ${rows.length.toLocaleString()}건`);
  return rows;
}

/* ───────── 정리 도우미 ───────── */

const clean = (s) => (s == null ? '' : String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim());
const joinBars = (s, sep = '\n') => clean(s).split('||').map((x) => x.trim()).filter(Boolean).join(sep);
const noneIfEmpty = (s) => (/^(해당\s*없음|없음|-)$/.test(clean(s)) ? '' : clean(s));

// 신청기한 글에서 마지막 날짜가 오늘보다 이전이면 마감 (gs24-core.js deadlineInfo 와 같은 규칙)
function isExpired(text) {
  const re = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
  let m, last = null;
  while ((m = re.exec(String(text || '')))) last = m;
  if (!last) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(+last[1], +last[2] - 1, +last[3]) < today;
}

function formatDate(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '';
}

// 기관 이름 앞부분으로 지역 찾기 ('서울특별시 종로구' → 서울특별시, 종로구)
function regionFromName(orgName) {
  const name = clean(orgName);
  const parts = name.split(' ');
  for (const [oldName, newName] of Object.entries(OLD_REGION_NAMES)) {
    if (parts[0] === oldName) return { region: newName, sigungu: parts[1] || '' };
  }
  const region = REGIONS.find((r) => name.startsWith(r));
  if (!region) return null;
  return { region, sigungu: parts[0] === region ? parts[1] || '' : '' };
}

// 재단·공사 등은 이름에 지역이 없어서, 같은 기관코드를 쓰는 시·군·구에서 지역을 가져옴
function buildRegionResolver(services) {
  const byCode = new Map();
  for (const s of services) {
    const found = regionFromName(s['소관기관명']);
    if (found && s['소관기관코드'] && !byCode.has(s['소관기관코드'])) byCode.set(s['소관기관코드'], found);
  }
  return function regionOf(s) {
    if (s['소관기관유형'] === '중앙행정기관' || s['소관기관유형'] === '공공기관') return { region: '전국', sigungu: '' };
    return regionFromName(s['소관기관명']) || byCode.get(s['소관기관코드']) || null;
  };
}

function conditionsOf(cond) {
  if (!cond) return { codes: [], age: null };
  const codes = [];
  for (const g of COND_GROUPS) {
    if (g.open && cond[g.open] === 'Y') continue;
    const yes = g.codes.filter((c) => cond[c] === 'Y');
    if (yes.length && yes.length < g.codes.length) codes.push(...yes);
  }
  const min = cond.JA0110 == null ? 0 : Number(cond.JA0110);
  const max = cond.JA0111 == null ? 150 : Number(cond.JA0111);
  const age = min <= 0 && max >= 100 ? null : [min, max];
  return { codes, age };
}

/* ───────── 실행 ───────── */

const started = Date.now();
let services, details, conditions;

if (process.argv.includes('--cache')) {
  // 이미 받아둔 원본으로 파일만 다시 만들기 (API 호출 안 함)
  const read = async (name) => JSON.parse(await readFile(`.cache/raw-${name}.json`, 'utf8'));
  services = await read('serviceList');
  details = await read('serviceDetail');
  conditions = await read('supportConditions');
  console.log('📦 받아둔 원본 데이터 사용');
} else {
  services = await fetchAll('serviceList', '공공서비스 목록');
  details = await fetchAll('serviceDetail', '공공서비스 상세내용');
  conditions = await fetchAll('supportConditions', '공공서비스 지원조건');

  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/raw-serviceList.json', JSON.stringify(services));
  await writeFile('.cache/raw-serviceDetail.json', JSON.stringify(details));
  await writeFile('.cache/raw-supportConditions.json', JSON.stringify(conditions));
}

const detailById = new Map(details.map((d) => [d['서비스ID'], d]));
const condById = new Map(conditions.map((c) => [c['서비스ID'], c]));

const regionOf = buildRegionResolver(services);

// 카드 버튼 문구를 직접 고친 목록 { "서비스ID": "최대 500만원" }
let overrides = {};
try {
  overrides = JSON.parse(await readFile(new URL('./benefit-overrides.json', import.meta.url), 'utf8'));
} catch { /* 파일이 없으면 자동 문구만 사용 */ }
const list = [];
let noDetail = 0, noCond = 0, noRegion = 0, expired = 0;

await rm('data/detail', { recursive: true, force: true });
await mkdir('data/detail', { recursive: true });

for (const s of services) {
  const id = s['서비스ID'];
  if (!id) continue;
  const d = detailById.get(id);
  const c = condById.get(id);
  if (!d) noDetail++;
  if (!c) noCond++;

  const found = regionOf(s);
  if (!found) noRegion++;
  const { region, sigungu } = found || { region: '전국', sigungu: '' };
  const { codes, age } = conditionsOf(c);
  const supportType = joinBars(s['지원유형'], ', ');

  // 검색용 목록: 마감된 지원금은 빼고, 빈 값은 저장하지 않아 파일 크기를 줄임
  if (isExpired(s['신청기한'])) {
    expired++;
  } else {
    const item = {
      id,
      name: clean(s['서비스명']),
      summary: clean(s['서비스목적요약']),
      topic: clean(s['서비스분야']),
      org: clean(s['소관기관명']),
      region,
      userType: clean(s['사용자구분']),
      supportType,
      deadline: clean(s['신청기한']),
      views: Number(s['조회수']) || 0,
      updated: formatDate(s['수정일시'])
    };
    const benefit = overrides[id] || benefitLabel(d?.['지원내용'] ?? s['지원내용'], s['지원유형']);
    if (benefit) item.benefit = benefit;
    if (sigungu) item.sigungu = sigungu;
    if (codes.length) item.codes = codes;
    if (age) item.age = age;
    list.push(item);
  }

  const laws = [joinBars(d?.['법령']), joinBars(d?.['자치법규']), joinBars(d?.['행정규칙'])].filter(Boolean).join('\n');
  const detail = {
    id,
    name: clean(s['서비스명']),
    topic: clean(s['서비스분야']),
    supportType,
    org: clean(s['소관기관명']),
    dept: clean(s['부서명']),
    deadline: clean(d?.['신청기한'] ?? s['신청기한']),
    updated: formatDate(d?.['수정일시'] ?? s['수정일시']),
    receiver: clean(d?.['접수기관명'] ?? s['접수기관']),
    contact: joinBars(d?.['문의처'] ?? s['전화문의']),
    onlineUrl: clean(d?.['온라인신청사이트URL']),
    gov24Url: clean(s['상세조회URL']),
    purpose: clean(d?.['서비스목적'] ?? s['서비스목적요약']),
    target: clean(d?.['지원대상'] ?? s['지원대상']),
    criteria: clean(d?.['선정기준'] ?? s['선정기준']),
    content: clean(d?.['지원내용'] ?? s['지원내용']),
    howToApply: clean(d?.['신청방법'] ?? s['신청방법']),
    documents: noneIfEmpty(d?.['구비서류']),
    officialDocs: noneIfEmpty(d?.['공무원확인구비서류']),
    laws
  };
  await writeFile(`data/detail/${id}.json`, JSON.stringify(detail));
}

await writeFile('data/list.json', JSON.stringify(list));
await writeFile('data/meta.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  count: list.length,
  source: '행정안전부_대한민국 공공서비스(혜택) 정보 (공공데이터포털)'
}, null, 2));

console.log(`\n✅ 완료: 검색용 ${list.length.toLocaleString()}건 (마감 제외 ${expired}건), 상세 ${services.length.toLocaleString()}건 (${Math.round((Date.now() - started) / 1000)}초)`);
if (noDetail || noCond || noRegion) console.log(`   ⚠️ 상세 없음 ${noDetail}건, 지원조건 없음 ${noCond}건, 지역 못 찾음 ${noRegion}건(전국으로 처리)`);
