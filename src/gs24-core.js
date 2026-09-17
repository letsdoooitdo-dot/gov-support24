/* 정부지원금24 - 공통: 설정, 검색조건 분류, 조건 비교, 데이터 불러오기 */
(function () {
  'use strict';
  var GS24 = (window.GS24 = window.GS24 || {});

  GS24.config = Object.assign({
    listPageUrl: 'index.html',     // 블로그스팟: '/' 또는 검색 페이지 주소
    detailPageUrl: 'detail.html',  // 블로그스팟: '/p/support-detail.html'
    dataBaseUrl: '',               // 데이터 창고 주소 (API 키 발급 후 설정)
    perPage: 9
  }, window.GS24_CONFIG || {});

  // 애드센스 광고 (slot = 광고 단위 번호, 비워두면 그 자리는 광고 없음)
  GS24.config.ads = Object.assign({
    client: 'ca-pub-5167405501174218',
    top: '6858157581',       // [디스플레이, 수평, 반응형] 블로그 상단 해더 광고 → 조건 선택 위
    middle: '3416081882',    // [디스플레이, 수평, 반응형] 블로그 중간 광고 → 검색 결과 위
    bottom: '7163755206',    // [디스플레이, 수평, 반응형] 블로그 하단 광고 → 중위소득 계산기 위
    detailTop: '6858157581',     // 상세: 지원금 이름 상자 아래 · 신청 기한 상자 위 (상단 해더 광고)
    detailRelated: '6858157581', // 상세: 함께 보면 좋은 지원금 위 (상단 해더 광고)
    // 양쪽 사이드 광고는 기존 블로그처럼 <head>의 애드센스 자동광고(사이드 레일)가 띄움 → 기본은 비워둠
    // 직접 넣고 싶을 때만 세로형(160x600) 광고 단위 번호를 입력
    sideLeft: '',
    sideRight: '',
    sideMinWidth: 1150,      // 화면이 이보다 넓을 때만 사이드 광고 표시
    preview: false           // true = 실제 광고 대신 위치 표시 상자 (내 컴퓨터 미리보기용)
  }, (window.GS24_CONFIG || {}).ads || {});

  /* ───────── 검색조건 분류 ───────── */

  // 공공데이터 '서비스분야' 값 (color = 카드 색)
  GS24.TOPICS = [
    { value: '생활안정', icon: '💵', color: 'card-blue' },
    { value: '주거·자립', icon: '🏠', color: 'card-teal' },
    { value: '보육·교육', icon: '🎒', color: 'card-amber' },
    { value: '고용·창업', icon: '💼', color: 'card-darkblue' },
    { value: '보건·의료', icon: '🏥', color: 'card-forestgreen' },
    { value: '임신·출산', icon: '🤰', color: 'card-lightpurple' },
    { value: '보호·돌봄', icon: '🤝', color: 'card-violet' },
    { value: '문화·환경', icon: '🌳', color: 'card-seagreen' },
    { value: '농림축산어업', icon: '🌾', color: 'card-mustard' },
    { value: '행정·안전', icon: '🛡️', color: 'card-royalblue' }
  ];

  GS24.topicInfo = function (topic) {
    return GS24.TOPICS.filter(function (t) { return t.value === topic; })[0] || { value: topic, icon: '📋', color: 'card-blue2' };
  };

  // 공공데이터 '사용자구분' 값을 3가지로 묶음
  GS24.TARGETS = [
    { id: 'person', label: '개인·가구', icon: '👤', keywords: ['개인', '가구'] },
    { id: 'biz', label: '소상공인·자영업', icon: '🏪', keywords: ['소상공인'] },
    { id: 'org', label: '기업·단체·시설', icon: '🏢', keywords: ['법인', '시설', '단체'] }
  ];

  // '소관기관명' 앞부분으로 지역을 구분 (중앙부처·공공기관 = 전국)
  GS24.REGIONS = [
    { value: '서울특별시', label: '서울' }, { value: '부산광역시', label: '부산' },
    { value: '대구광역시', label: '대구' }, { value: '인천광역시', label: '인천' },
    { value: '대전광역시', label: '대전' },
    { value: '울산광역시', label: '울산' }, { value: '세종특별자치시', label: '세종' },
    { value: '경기도', label: '경기' }, { value: '강원특별자치도', label: '강원' },
    { value: '충청북도', label: '충북' }, { value: '충청남도', label: '충남' },
    { value: '전북특별자치도', label: '전북' }, { value: '전남광주통합특별시', label: '전남·광주' },
    { value: '경상북도', label: '경북' }, { value: '경상남도', label: '경남' },
    { value: '제주특별자치도', label: '제주' }
  ];

  /*
   * 대상별 세부 조건 ('지원조건' JA 코드)
   *  - kind 'age'   : 나이 범위 (JA0110 ~ JA0111)
   *  - kind 'single': 하나만 선택
   *  - kind 'multi' : 여러 개 선택
   *  - cond         : 같은 cond 끼리는 하나의 조건 묶음으로 비교
   *  - openCode     : '해당사항 없음'도 대상이라는 코드 (Y면 이 묶음은 누구나)
   *  - basic: true  : 처음부터 보이는 조건 (나머지는 '조건 더 보기' 안에)
   */
  GS24.FILTERS = {
    person: [
      {
        key: 'age', kind: 'age', basic: true, icon: '🎂', title: '나이',
        options: [
          { value: 'baby', label: '영유아', sub: '0~5세', min: 0, max: 5 },
          { value: 'child', label: '아동', sub: '6~12세', min: 6, max: 12 },
          { value: 'teen', label: '청소년', sub: '13~18세', min: 13, max: 18 },
          { value: 'youth', label: '청년', sub: '19~34세', min: 19, max: 34 },
          { value: 'middle', label: '중장년', sub: '35~64세', min: 35, max: 64 },
          { value: 'senior', label: '어르신', sub: '65세 이상', min: 65, max: 150 }
        ]
      },
      {
        key: 'gender', kind: 'single', cond: 'gender', icon: '🚻', title: '성별',
        options: [{ value: 'JA0101', label: '남성' }, { value: 'JA0102', label: '여성' }]
      },
      {
        key: 'income', kind: 'single', cond: 'income', icon: '💰', title: '가구 소득 수준',
        hint: '기준 중위소득 기준이에요. 잘 모르면 선택하지 않아도 돼요.',
        options: [
          { value: 'JA0201', label: '50% 이하', sub: '기초생활·차상위 수준' },
          { value: 'JA0202', label: '51~75%' },
          { value: 'JA0203', label: '76~100%' },
          { value: 'JA0204', label: '101~200%' },
          { value: 'JA0205', label: '200% 초과' }
        ]
      },
      {
        key: 'household', kind: 'multi', cond: 'household', openCode: 'JA0410', icon: '🏡', title: '우리 집 상황',
        options: [
          { value: 'JA0404', label: '1인 가구' },
          { value: 'JA0411', label: '다자녀 가구' },
          { value: 'JA0403', label: '한부모·조손 가구' },
          { value: 'JA0401', label: '다문화 가족' },
          { value: 'JA0402', label: '북한이탈주민' },
          { value: 'JA0412', label: '무주택 세대' },
          { value: 'JA0413', label: '새로 이사 옴(전입)' },
          { value: 'JA0414', label: '확대 가족' }
        ]
      },
      {
        key: 'life', kind: 'multi', cond: 'life', openCode: 'JA0322', icon: '🙋', title: '나에게 해당하는 것',
        subgroups: [
          {
            title: '👶 임신·출산', options: [
              { value: 'JA0301', label: '예비부모·난임' },
              { value: 'JA0302', label: '임산부' },
              { value: 'JA0303', label: '출산·입양' }
            ]
          },
          {
            title: '📚 학생', options: [
              { value: 'JA0317', label: '초등학생' },
              { value: 'JA0318', label: '중학생' },
              { value: 'JA0319', label: '고등학생' },
              { value: 'JA0320', label: '대학생·대학원생' }
            ]
          },
          {
            title: '💼 일·직업', options: [
              { value: 'JA0326', label: '직장인' },
              { value: 'JA0327', label: '구직자·실업자' },
              { value: 'JA0313', label: '농업인' },
              { value: 'JA0314', label: '어업인' },
              { value: 'JA0315', label: '축산업인' },
              { value: 'JA0316', label: '임업인' }
            ]
          },
          {
            title: '💙 특별한 상황', options: [
              { value: 'JA0328', label: '장애인' },
              { value: 'JA0329', label: '국가보훈대상자' },
              { value: 'JA0330', label: '질병·질환자' }
            ]
          }
        ]
      }
    ],
    biz: [
      {
        key: 'bizStatus', kind: 'multi', cond: 'bizStatus', basic: true, icon: '📌', title: '사업 상황',
        options: [
          { value: 'JA1101', label: '예비 창업자' },
          { value: 'JA1102', label: '영업 중' },
          { value: 'JA1103', label: '생계 곤란·폐업 예정' }
        ]
      },
      {
        key: 'bizType', kind: 'multi', cond: 'bizType', basic: true, icon: '🏷️', title: '업종',
        options: [
          { value: 'JA1201', label: '음식점업' },
          { value: 'JA1202', label: '제조업' },
          { value: 'JA1299', label: '기타 업종' }
        ]
      }
    ],
    org: [
      {
        key: 'orgType', kind: 'multi', cond: 'orgType', basic: true, icon: '🏢', title: '기관 유형',
        options: [
          { value: 'JA2101', label: '중소기업' },
          { value: 'JA2102', label: '사회복지시설' },
          { value: 'JA2103', label: '기관·단체' }
        ]
      },
      {
        key: 'orgIndustry', kind: 'multi', cond: 'orgIndustry', basic: true, icon: '🏭', title: '업종',
        options: [
          { value: 'JA2201', label: '제조업' },
          { value: 'JA2202', label: '농업·임업·어업' },
          { value: 'JA2203', label: '정보통신업' },
          { value: 'JA2299', label: '기타 업종' }
        ]
      }
    ]
  };

  /* ───────── 기준 중위소득 (매년 8월 보건복지부 고시 → 해마다 금액만 바꾸면 됨) ───────── */

  GS24.MEDIAN_INCOME = {
    year: 2026,
    notice: '보건복지부 고시 제2025-135호',
    monthly: [2564238, 4199292, 5359036, 6494738, 7556719, 8555952] // 1인 ~ 6인
  };

  // 7인 이상: 1명 늘 때마다 (6인 - 5인) 차이를 더함
  GS24.medianIncome = function (people) {
    var m = GS24.MEDIAN_INCOME.monthly;
    if (people <= 6) return m[Math.max(1, people) - 1];
    return m[5] + (m[5] - m[4]) * (people - 6);
  };

  // 중위소득 % → 검색조건 소득 구간 코드
  GS24.incomeCodeOf = function (percent) {
    if (percent <= 50) return 'JA0201';
    if (percent <= 75) return 'JA0202';
    if (percent <= 100) return 'JA0203';
    if (percent <= 200) return 'JA0204';
    return 'JA0205';
  };

  GS24.optionsOf = function (group) {
    if (group.options) return group.options;
    return group.subgroups.reduce(function (all, sg) { return all.concat(sg.options); }, []);
  };

  /* ───────── 조건 비교 ───────── */

  /*
   * 목록 데이터 한 건의 모양
   * { id, name, summary, topic, org, region, sigungu?, userType, supportType,
   *   deadline, views, updated, codes?: ['JA0102', ...], age?: [최소, 최대] }
   * (codes/age 가 없으면 누구나 대상)
   *
   * sel(사용자가 고른 조건)
   * { target, region, keyword, topics: [], picks: { age: 'youth', life: ['JA0302'], ... } }
   */
  GS24.match = function (svc, sel) {
    var score = 0;

    var target = GS24.TARGETS.filter(function (t) { return t.id === sel.target; })[0];
    if (target && svc.userType) {
      var okTarget = target.keywords.some(function (k) { return svc.userType.indexOf(k) > -1; });
      if (!okTarget) return null;
    }

    if (sel.region && svc.region !== '전국' && svc.region !== sel.region) return null;
    if (sel.topics.length && sel.topics.indexOf(svc.topic) < 0) return null;

    if (sel.keyword) {
      var hay = (svc.name + ' ' + svc.summary + ' ' + svc.org).replace(/\s/g, '').toLowerCase();
      if (hay.indexOf(sel.keyword.replace(/\s/g, '').toLowerCase()) < 0) return null;
    }

    var groups = GS24.FILTERS[sel.target] || [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var pick = sel.picks[g.key];
      if (!pick || (Array.isArray(pick) && !pick.length)) continue;

      if (g.kind === 'age') {
        if (!svc.age) continue;
        var opt = g.options.filter(function (o) { return o.value === pick; })[0];
        if (!opt) continue;
        if (svc.age[1] < opt.min || svc.age[0] > opt.max) return null;
        score += 1;
        continue;
      }

      // 이 지원금이 해당 묶음에서 대상을 제한하는지 확인
      var allCodes = svc.codes || [];
      if (g.openCode && allCodes.indexOf(g.openCode) > -1) continue;
      var groupCodes = GS24.optionsOf(g).map(function (o) { return o.value; });
      var svcCodes = allCodes.filter(function (c) { return groupCodes.indexOf(c) > -1; });
      if (!svcCodes.length) continue;                     // 제한 없음 → 누구나
      if (g.key === 'gender' && svcCodes.length === groupCodes.length) continue; // 남녀 모두

      var picks = Array.isArray(pick) ? pick : [pick];
      var hit = picks.some(function (p) { return svcCodes.indexOf(p) > -1; });
      if (!hit) return null;                              // 다른 대상 전용 → 제외
      score += 2;                                         // 딱 맞는 대상 → 위로
    }
    return { score: score };
  };

  /* ───────── 도우미 ───────── */

  GS24.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  GS24.multiline = function (s) {
    return GS24.esc(String(s == null ? '' : s).trim()).replace(/\r?\n/g, '<br>');
  };

  GS24.safeUrl = function (u) {
    return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
  };

  GS24.detailUrl = function (id) {
    return GS24.config.detailPageUrl + '?id=' + encodeURIComponent(id);
  };

  // 신청기한 글자에서 마지막 날짜를 찾아 D-day 계산 (상시신청 등은 날짜 없음)
  GS24.deadlineInfo = function (text) {
    text = String(text || '').trim();
    var re = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
    var m, last = null;
    while ((m = re.exec(text))) last = m;
    if (!last) return { text: text || '기한 확인 필요', expired: false, urgent: false };

    var end = new Date(+last[1], +last[2] - 1, +last[3]);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var days = Math.round((end - today) / 86400000);
    if (days < 0) return { text: '마감', expired: true, urgent: false, days: days };
    return {
      text: days === 0 ? '오늘 마감' : 'D-' + days,
      expired: false, urgent: days <= 7, days: days
    };
  };

  // 지원금 카드 한 장 (검색 결과·함께 보면 좋은 지원금에서 같은 모양으로 사용)
  GS24.supportCardHtml = function (svc) {
    var esc = GS24.esc;
    var dl = GS24.deadlineInfo(svc.deadline);
    var topic = GS24.topicInfo(svc.topic);
    // 긴 기한 글은 한 줄로 줄이고, 자세한 기한은 상세 화면에서 보여줌
    var dlText = dl.days != null ? dl.text : dl.text.replace(/\s+/g, ' ');
    return '<a class="support-card ' + topic.color + '" href="' + esc(GS24.detailUrl(svc.id)) + '" title="' + esc(svc.summary) + '">' +
      '<div class="support-meta">' + topic.icon + ' ' + esc(svc.topic) + ' · ' + esc(svc.supportType || '지원') + '</div>' +
      '<div class="support-title">' + esc(svc.name) + '</div>' +
      '<div class="support-org">' + (dl.urgent ? '<span class="support-dday">' + esc(dl.text) + '</span>' : '') +
      esc(svc.org) + (dl.urgent ? '' : ' · ' + esc(dlText)) + '</div>' +
      // 버튼 문구: 최대 금액·비율·대표 혜택 (데이터 만들 때 지원내용에서 뽑음)
      '<div class="support-icon">' + esc(svc.benefit || '확인하기') + '</div>' +
      '</a>';
  };

  /* ───────── 애드센스 광고 ───────── */

  function loadAdScript() {
    var ads = GS24.config.ads;
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ads.client);
    document.head.appendChild(s);
  }

  /*
   * box 안에 광고 1개 넣기
   *  opts.label : 미리보기 상자에 보일 이름
   *  opts.side  : true면 160x600 세로 광고
   */
  GS24.renderAd = function (box, slot, opts) {
    var ads = GS24.config.ads;
    opts = opts || {};
    if (!box || !slot || !ads.client) return;

    if (ads.preview) {
      box.innerHTML = '<div class="gs24-ad-preview' + (opts.side ? ' side' : '') + '">📢 광고 영역<br><small>' +
        GS24.esc(opts.label || '') + '<br>(' + GS24.esc(slot) + ')</small></div>';
      return;
    }

    loadAdScript();
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('data-ad-client', ads.client);
    ins.setAttribute('data-ad-slot', slot);
    if (opts.side) {
      ins.style.cssText = 'display:inline-block;width:160px;height:600px';
    } else {
      ins.style.display = 'block';
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
    }
    box.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 광고 차단 등 */ }
  };

  // 양쪽 사이드 광고 (넓은 화면에서만, 페이지에 한 번만)
  GS24.renderSideAds = function () {
    var ads = GS24.config.ads;
    if (document.querySelector('.gs24-side-ad')) return;
    if (window.innerWidth < ads.sideMinWidth) return; // 좁은 화면에서는 넣지 않음 (광고 크기 오류 방지)
    [['left', ads.sideLeft, '왼쪽 사이드 광고'], ['right', ads.sideRight, '오른쪽 사이드 광고']].forEach(function (s) {
      if (!s[1]) return;
      var box = document.createElement('div');
      box.className = 'gs24-side-ad ' + s[0];
      document.body.appendChild(box);
      GS24.renderAd(box, s[1], { side: true, label: s[2] });
    });
  };

  /* ───────── 데이터 불러오기 ───────── */

  var listCache = null;

  GS24.loadList = function () {
    if (listCache) return listCache;
    if (window.GS24_SAMPLE) {
      listCache = Promise.resolve(window.GS24_SAMPLE.list);
    } else {
      listCache = fetch(GS24.config.dataBaseUrl + 'list.json').then(function (r) {
        if (!r.ok) throw new Error('목록을 불러오지 못했어요');
        return r.json();
      });
    }
    return listCache;
  };

  // 데이터 갱신 정보 { updatedAt, count }
  GS24.loadMeta = function () {
    if (window.GS24_SAMPLE) return Promise.resolve(null);
    return fetch(GS24.config.dataBaseUrl + 'meta.json').then(function (r) { return r.ok ? r.json() : null; });
  };

  GS24.loadDetail = function (id) {
    if (window.GS24_SAMPLE) return Promise.resolve(window.GS24_SAMPLE.details[id] || null);
    return fetch(GS24.config.dataBaseUrl + 'detail/' + encodeURIComponent(id) + '.json')
      .then(function (r) { return r.ok ? r.json() : null; });
  };
})();
