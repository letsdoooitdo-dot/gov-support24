// 지원내용 글에서 카드 버튼에 표시할 "최대 금액 / 최고 비율 / 대표 혜택" 문구 만들기
//
// 규칙
//  1) 금액: "○○만원" 등을 모두 찾고, 자격 조건 금액(소득·재산·보증금 ~이하 등)은 빼고 가장 큰 값
//     - 월/연 표시가 붙어 있으면 "월 최대 100만원", 대출·융자면 "대출 최대 2.5억원"
//  2) 금액이 없으면 비율: "90% 감면/지원/할인" 처럼 혜택과 함께 쓰인 % 중 가장 큰 값
//  3) 둘 다 없으면: 무료/전액 → 지원형태(의료 지원, 이용권 지원 …) → "확인하기"
//  4) scripts/benefit-overrides.json 에 { "서비스ID": "직접 쓴 문구" } 가 있으면 그 문구를 우선 사용

const UNIT = { '억': 1e8, '천만': 1e7, '백만': 1e6, '만': 1e4, '천': 1e3 };
const MONEY_RE = /(?:\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|만|천)?\s*)+원/g;
const PART_RE = /(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|만|천)?/g;

// 금액 앞에 이런 말이 있으면 "받는 돈"이 아니라 조건·본인 부담 금액
//  - FAR: 앞 20글자 안에 있으면 제외 (자격 조건: "연소득 (청년) 5천만원, (청년외) 6천만원 이하")
//  - NEAR: 바로 앞 6글자 안에 있을 때만 제외 ("주택가격의 최대 70%(2억원 한도)" 는 살림)
const MONEY_FAR_EXCLUDE = /(매출|소득|재산|자산|보증금|부채|연봉|과세표준)/;
const MONEY_NEAR_EXCLUDE = /(가격|시세|임금|월급|보수|적립|저축|납입|원금|본인부담|자부담|자기부담|수수료|이용료|요금|공시|평가액|예금|잔액|예산|사업비|(^|[\s(:])총\s*)/;
const MONEY_AFTER_EXCLUDE = /^[^○\n]{0,8}?(이하|이상|미만|초과|적립|납입|보험료|매출)/;
const LOAN_RE = /(대출|융자|대부)/;

const RATE_RE = /(\d+(?:\.\d+)?)\s*%(?!\s*p)/g;
const RATE_BEFORE_EXCLUDE = /(금리|이자|이율|중위소득|소득|수익|지분|대출|융자|시세|보증금|임차)/;
const RATE_AFTER_BENEFIT = /(감면|할인|환급|지원|지급|보조|경감|면제|보전)/;

const TYPE_LABEL = [
  [/서비스\(의료\)/, '의료 지원'], [/서비스\(돌봄\)/, '돌봄 서비스'], [/서비스\(일자리\)/, '일자리 지원'],
  [/기타\(교육\)/, '교육 지원'], [/기타\(상담\)/, '상담 지원'], [/현금\(장학금\)/, '장학금 지원'],
  [/현금\(감면\)/, '감면 혜택'], [/현금\(융자\)/, '융자 지원'], [/현금\(보험\)/, '보험 지원'],
  [/이용권/, '이용권 지원'], [/현물/, '현물 지원'], [/서비스/, '서비스 지원']
];

function parseMoney(text) {
  let total = 0;
  for (const m of text.matchAll(PART_RE)) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    total += n * (UNIT[m[2]] || 1);
  }
  return total;
}

export function formatWon(v) {
  if (v >= 1e8) {
    const eok = Math.round((v / 1e8) * 10) / 10;
    return `${eok}억원`;
  }
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString('ko-KR')}만원`;
  return `${Math.round(v).toLocaleString('ko-KR')}원`;
}

function bestMoney(text, supportType) {
  let best = null;
  for (const m of text.matchAll(MONEY_RE)) {
    const value = parseMoney(m[0]);
    if (value < 1000 || value >= 1e11) continue;
    const far = text.slice(Math.max(0, m.index - 20), m.index);
    const near = text.slice(Math.max(0, m.index - 6), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (MONEY_FAR_EXCLUDE.test(far) || MONEY_NEAR_EXCLUDE.test(near) || MONEY_AFTER_EXCLUDE.test(after)) continue;
    if (!best || value > best.value) {
      const lead = text.slice(Math.max(0, m.index - 8), m.index);
      let period = '';
      if (/월\s*(최대|상한|한도)?\s*[\d,.~\s-]*$/.test(lead)) period = '월';
      else if (/(연|연간|년)\s*(최대|한도)?\s*[\d,.~\s-]*$/.test(lead)) period = '연';
      const loan = /융자/.test(supportType) || LOAN_RE.test(text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 10));
      best = { value, period, loan };
    }
  }
  return best;
}

function bestRate(text) {
  let best = null;
  for (const m of text.matchAll(RATE_RE)) {
    const value = parseFloat(m[1]);
    if (!(value > 0 && value <= 100)) continue;
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (RATE_BEFORE_EXCLUDE.test(before)) continue;
    const verb = after.match(RATE_AFTER_BENEFIT);
    if (!verb) continue;
    if (!best || value > best.value) best = { value, verb: verb[1] };
  }
  return best;
}

export function benefitLabel(content, supportType = '') {
  const text = String(content || '').replace(/\r\n?/g, '\n');

  const money = bestMoney(text, supportType);
  if (money) {
    const amount = formatWon(money.value);
    if (money.loan) return `대출 최대 ${amount}`;
    return `${money.period ? money.period + ' ' : ''}최대 ${amount}`;
  }

  const rate = bestRate(text);
  if (rate) {
    const verb = ['감면', '할인', '환급', '면제', '경감'].includes(rate.verb) ? rate.verb : '지원';
    return `최대 ${rate.value}% ${verb}`;
  }

  if (/무료|무상/.test(text)) return '무료 지원';
  if (/전액/.test(text)) return '전액 지원';
  for (const [re, label] of TYPE_LABEL) if (re.test(supportType)) return label;
  return '';
}
