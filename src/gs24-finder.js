/* 정부지원금24 - 검색 화면 (<div id="gs24-finder"></div> 안에 그림) */
(function () {
  'use strict';
  var GS24 = window.GS24;
  var esc = GS24.esc;
  var STORE_KEY = 'gs24-finder-state';

  var root;
  var state = {
    target: 'person', region: '', keyword: '', topics: [], picks: {},
    sort: 'deadline', page: 1
  };
  var SORTS = [['deadline', '마감임박순'], ['popular', '인기순'], ['latest', '최신순']];
  var results = [];
  var moreOpen = false; // '조건 더 보기' 열림 여부 (처음엔 닫힘)

  function saveState() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 안 돼도 동작 */ }
  }

  // 상세 화면에서 돌아왔을 때만 고른 조건을 되살림 (그 외에는 항상 기본값: 개인·가구)
  function cameFromDetail() {
    var detailPath = String(GS24.config.detailPageUrl || '').split('?')[0];
    return !!detailPath && document.referrer.indexOf(detailPath) > -1;
  }

  function loadState() {
    if (!cameFromDetail()) return;
    try {
      var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (saved && GS24.FILTERS[saved.target]) state = Object.assign(state, saved);
      if (!SORTS.some(function (s) { return s[0] === state.sort; })) state.sort = 'deadline';
    } catch (e) { /* 무시 */ }
  }

  /* ───────── 조건 영역 그리기 ───────── */

  function chip(opts) {
    // onClass: 선택됐을 때만 붙는 색 (관심 분야 = 카드 색과 같게)
    return '<button type="button" class="gs24-chip' + (opts.on ? ' on' + (opts.onClass ? ' ' + opts.onClass : '') : '') + '"' +
      ' data-act="' + opts.act + '" data-key="' + esc(opts.key || '') + '" data-value="' + esc(opts.value) + '">' +
      esc(opts.label) + (opts.sub ? '<small>' + esc(opts.sub) + '</small>' : '') + '</button>';
  }

  function groupHtml(g) {
    var pick = state.picks[g.key];
    var single = g.kind !== 'multi';
    function isOn(v) { return single ? pick === v : (pick || []).indexOf(v) > -1; }
    function chips(options) {
      return '<div class="gs24-chips">' + options.map(function (o) {
        return chip({ act: 'pick', key: g.key, value: o.value, label: o.label, sub: o.sub, single: single, on: isOn(o.value) });
      }).join('') + '</div>';
    }

    var body = g.subgroups
      ? g.subgroups.map(function (sg) { return '<div class="gs24-subtitle">' + esc(sg.title) + '</div>' + chips(sg.options); }).join('')
      : chips(g.options);

    return '<div class="gs24-group"><h3>' + g.icon + ' ' + esc(g.title) + '</h3>' +
      '<p class="gs24-hint">' + esc(g.hint || (single ? '선택하지 않으면 전체' : '여러 개 선택할 수 있어요')) + '</p>' +
      body + '</div>';
  }

  function renderFilters() {
    var groups = GS24.FILTERS[state.target];
    var basic = groups.filter(function (g) { return g.basic; });
    var more = groups.filter(function (g) { return !g.basic; });
    var moreCount = more.reduce(function (n, g) {
      var p = state.picks[g.key];
      return n + (Array.isArray(p) ? p.length : (p ? 1 : 0));
    }, 0);

    var html =
      '<div class="gs24-group"><h3>🙌 누구를 위한 지원금을 찾나요?</h3><div class="gs24-chips gs24-chips-3">' +
      GS24.TARGETS.map(function (t) {
        return '<button type="button" class="gs24-chip gs24-target' + (state.target === t.id ? ' on' : '') +
          '" data-act="target" data-value="' + t.id + '">' + t.icon + ' ' + esc(t.label) + '</button>';
      }).join('') + '</div></div>' +

      '<div class="gs24-group"><h3>🔎 지원금 이름으로 찾기</h3>' +
      '<input class="gs24-input" type="search" data-act="keyword" placeholder="예) 월세, 출산, 취업" value="' + esc(state.keyword) + '"></div>' +

      '<div class="gs24-group"><h3>📍 지역</h3><p class="gs24-hint">지역을 고르면 전국 지원금 + 우리 지역 지원금이 나와요</p><div class="gs24-chips gs24-chips-4">' +
      chip({ act: 'region', value: '', label: '전국', single: true, on: !state.region }) +
      GS24.REGIONS.map(function (r) {
        return chip({ act: 'region', value: r.value, label: r.label, single: true, on: state.region === r.value });
      }).join('') + '</div></div>' +

      '<div class="gs24-group"><h3>📂 관심 분야</h3><p class="gs24-hint">여러 개 선택할 수 있어요</p><div class="gs24-chips">' +
      GS24.TOPICS.map(function (t) {
        return chip({ act: 'topic', value: t.value, label: t.icon + ' ' + t.value, on: state.topics.indexOf(t.value) > -1, onClass: t.color });
      }).join('') + '</div></div>' +

      basic.map(groupHtml).join('');

    if (more.length) {
      // 기본은 닫힘. 사용자가 직접 열었을 때만 다시 그려도 열린 상태 유지
      html += '<details class="gs24-more gs24-filter-more"' + (moreOpen ? ' open' : '') + '>' +
        '<summary>➕ 조건 더 보기 (소득·가구·특성)' + (moreCount ? ' · ' + moreCount + '개 선택됨' : '') + '</summary>' +
        more.map(groupHtml).join('') + '</details>';
    }

    html += '<div class="gs24-actions">' +
      '<button type="button" class="gs24-btn-main" data-act="search">🔍 지원금 검색하기</button>' +
      '<button type="button" class="gs24-btn-sub" data-act="reset">초기화</button></div>';

    root.querySelector('.gs24-filters').innerHTML = html;
  }

  /* ───────── 결과 영역 그리기 ───────── */

  var cardHtml = GS24.supportCardHtml; // 카드 모양은 gs24-core.js 에서 공통 관리

  function sortResults() {
    var by = {
      // 날짜가 적힌 지원금을 마감 가까운 순으로 먼저, 날짜 없는(상시 등) 지원금은 그 뒤에 인기순
      deadline: function (a, b) {
        if (a.days == null && b.days == null) return b.svc.views - a.svc.views;
        if (a.days == null) return 1;
        if (b.days == null) return -1;
        return a.days - b.days || b.svc.views - a.svc.views;
      },
      popular: function (a, b) { return b.svc.views - a.svc.views; },
      latest: function (a, b) { return String(b.svc.updated).localeCompare(String(a.svc.updated)); }
    };
    results.sort(by[state.sort] || by.deadline);
  }

  function renderResults() {
    var box = root.querySelector('.gs24-results');
    var per = GS24.config.perPage;
    var totalPages = Math.max(1, Math.ceil(results.length / per));
    if (state.page > totalPages) state.page = totalPages;
    var pageItems = results.slice((state.page - 1) * per, state.page * per);

    var sorts = SORTS;
    var html =
      '<h2 class="section-title">📋 검색 결과 <span class="gs24-count">' + results.length.toLocaleString() + '개</span></h2>' +
      '<div class="gs24-sort">' + sorts.map(function (s) {
        return '<button type="button" data-act="sort" data-value="' + s[0] + '" class="' + (state.sort === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="support-grid">' + (pageItems.length
        ? pageItems.map(function (r) { return cardHtml(r.svc); }).join('')
        : '<div class="gs24-empty"><b>😔</b>선택한 조건에 맞는 지원금이 없어요.<br><small>조건을 조금 줄여서 다시 검색해 보세요.</small></div>') +
      '</div>';

    if (totalPages > 1) {
      var start = Math.max(1, Math.min(state.page - 2, totalPages - 4));
      var end = Math.min(totalPages, start + 4);
      html += '<div class="gs24-pages">' +
        '<button type="button" data-act="page" data-value="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>← 이전</button>';
      for (var p = start; p <= end; p++) {
        html += '<button type="button" data-act="page" data-value="' + p + '" class="' + (p === state.page ? 'on' : '') + '">' + p + '</button>';
      }
      html += '<button type="button" data-act="page" data-value="' + (state.page + 1) + '"' + (state.page === totalPages ? ' disabled' : '') + '>다음 →</button></div>';
    }
    box.innerHTML = html;
  }

  function search(scroll) {
    var box = root.querySelector('.gs24-results');
    box.innerHTML = '<div class="gs24-empty"><span class="gs24-spinner"></span><br>지원금을 찾고 있어요...</div>';

    GS24.loadList().then(function (list) {
      var total = root.querySelector('.gs24-total');
      if (total) total.textContent = list.length.toLocaleString();
      results = [];
      list.forEach(function (svc) {
        if (GS24.deadlineInfo(svc.deadline).expired) return;
        var m = GS24.match(svc, state);
        if (m) results.push({ svc: svc, score: m.score, days: GS24.deadlineInfo(svc.deadline).days });
      });
      sortResults();
      renderResults();
      saveState();
      if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      box.innerHTML = '<div class="gs24-empty"><b>⚠️</b>지원금 정보를 불러오지 못했어요.<br><small>잠시 후 다시 시도해 주세요.</small></div>';
    });
  }

  /* ───────── 중위소득 계산기 ───────── */

  var calc = { people: 1, income: '' };

  function won(n) { return Math.round(n).toLocaleString() + '원'; }

  function renderCalcPeople() {
    var html = '';
    for (var n = 1; n <= 8; n++) {
      html += chip({ act: 'calc-people', value: String(n), label: n + '인' + (n === 8 ? ' 이상' : ''), on: calc.people === n });
    }
    root.querySelector('.gs24-calc-people').innerHTML = html;
  }

  function renderCalcResult() {
    var box = root.querySelector('.gs24-calc-result');
    var value = parseFloat(String(calc.income).replace(/,/g, ''));
    if (!(value > 0)) {
      box.innerHTML = '<div class="gs24-calc-box gs24-calc-empty">👆 가구원 수를 고르고 한 달 소득을 입력하면<br>기준 중위소득의 몇 %인지 바로 알려드려요.</div>';
      return;
    }

    // 원 단위로 입력한 경우(10만 이상)는 만원으로 바꿔서 계산
    var note = '';
    if (value >= 100000) {
      note = '<p class="gs24-hint">※ 원 단위로 입력하신 것 같아 ' + Math.round(value / 10000).toLocaleString() + '만원으로 계산했어요.</p>';
      value = value / 10000;
    }

    var median = GS24.medianIncome(calc.people);
    var percent = Math.round((value * 10000 / median) * 1000) / 10;
    var code = GS24.incomeCodeOf(percent);
    var incomeGroup = GS24.FILTERS.person.filter(function (g) { return g.key === 'income'; })[0];
    var option = incomeGroup.options.filter(function (o) { return o.value === code; })[0];

    box.innerHTML =
      '<div class="gs24-calc-box">' +
      '<div class="gs24-calc-label">우리 집(' + (calc.people >= 8 ? '8인 이상' : calc.people + '인') + ' 가구) 소득은 기준 중위소득의</div>' +
      '<div class="gs24-calc-percent">약 <b>' + percent.toLocaleString() + '%</b></div>' +
      '<div class="gs24-calc-bar"><span style="width:' + Math.min(percent / 2, 100) + '%"></span></div>' +
      '<div class="gs24-calc-ticks"><span>0</span><span>50%</span><span>100%</span><span>150%</span><span>200%+</span></div>' +
      '<div class="gs24-calc-band">검색조건 소득 구간: <b>중위소득 ' + esc(option.label) + '</b>' + (option.sub ? ' (' + esc(option.sub) + ')' : '') + '</div>' +
      '<div class="gs24-calc-sub">' + (calc.people >= 8 ? '8인' : calc.people + '인') + ' 가구 기준 중위소득 ' + won(median) + ' · 입력 소득 ' + won(value * 10000) + '</div>' +
      note +
      '<div class="gs24-actions"><button type="button" class="gs24-btn-main" data-act="calc-apply" data-value="' + code + '">🔍 이 소득 구간으로 지원금 찾기</button></div>' +
      '</div>';
  }

  function calcHtml() {
    var mi = GS24.MEDIAN_INCOME;
    var rows = '';
    for (var n = 1; n <= 7; n++) {
      var m = GS24.medianIncome(n);
      rows += '<tr><td>' + n + '인</td><td>' + won(m) + '</td><td>' + won(m * 0.5) + '</td><td>' + won(m * 0.75) + '</td></tr>';
    }
    return '<h2 class="section-title" id="gs24-income">🧮 중위소득 계산기</h2>' +
      '<div class="gs24-panel gs24-calc">' +
      '<p class="gs24-calc-intro">지원금 조건에 자주 나오는 <b>"기준 중위소득 ○○% 이하"</b>, 우리 집은 몇 %일까요?</p>' +
      '<div class="gs24-group"><h3>👨‍👩‍👧 가구원 수</h3><p class="gs24-hint">주민등록상 함께 사는 가족 수</p>' +
      '<div class="gs24-chips gs24-chips-4 gs24-calc-people"></div></div>' +
      '<div class="gs24-group"><h3>💵 한 달 가구 소득 (세전)</h3><p class="gs24-hint">가족 모두의 월 소득을 더한 금액을 만원 단위로 입력하세요</p>' +
      '<div class="gs24-money"><input class="gs24-input" type="number" inputmode="numeric" min="0" data-act="calc-income" placeholder="예) 250"><span>만원</span></div></div>' +
      '<div class="gs24-calc-result"></div>' +
      '<details class="gs24-more gs24-calc-table"><summary>📊 ' + mi.year + '년 기준 중위소득표 보기</summary>' +
      '<table><thead><tr><th>가구원</th><th>100%</th><th>50%</th><th>75%</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="gs24-hint">월 기준 · ' + esc(mi.notice) + ' · 7인 이상은 1인 늘 때마다 ' + won(mi.monthly[5] - mi.monthly[4]) + '씩 더해요</p>' +
      '</details>' +
      '<p class="gs24-hint">※ 실제 지원 대상은 재산·자동차 등을 소득으로 환산한 <b>소득인정액</b>으로 판단하는 경우가 많아요. 참고용으로 활용하세요.</p>' +
      '</div>';
  }

  /* ───────── 클릭 처리 ───────── */

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.tagName === 'INPUT') return;
    var act = el.getAttribute('data-act');
    var value = el.getAttribute('data-value');

    if (act === 'target') {
      if (state.target !== value) { state.target = value; state.picks = {}; }
      renderFilters();
    } else if (act === 'region') {
      state.region = value;
      renderFilters();
    } else if (act === 'topic') {
      toggle(state.topics, value);
      renderFilters();
    } else if (act === 'pick') {
      var key = el.getAttribute('data-key');
      var group = GS24.FILTERS[state.target].filter(function (g) { return g.key === key; })[0];
      if (group.kind === 'multi') {
        state.picks[key] = state.picks[key] || [];
        toggle(state.picks[key], value);
      } else {
        state.picks[key] = state.picks[key] === value ? '' : value; // 한 번 더 누르면 해제
      }
      renderFilters();
    } else if (act === 'search') {
      state.page = 1;
      search(true);
    } else if (act === 'reset') {
      state = { target: state.target, region: '', keyword: '', topics: [], picks: {}, sort: 'deadline', page: 1 };
      renderFilters();
      search(false);
    } else if (act === 'sort') {
      state.sort = value;
      state.page = 1;
      sortResults();
      renderResults();
      saveState();
    } else if (act === 'page') {
      state.page = +value;
      renderResults();
      saveState();
      root.querySelector('.gs24-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (act === 'calc-people') {
      calc.people = +value;
      renderCalcPeople();
      renderCalcResult();
    } else if (act === 'calc-apply') {
      // 계산 결과를 검색조건(개인·가구 > 소득)에 넣고 바로 검색
      if (state.target !== 'person') { state.target = 'person'; state.picks = {}; }
      state.picks.income = value;
      state.page = 1;
      renderFilters();
      search(true);
    }
  }

  function toggle(arr, v) {
    var i = arr.indexOf(v);
    if (i > -1) arr.splice(i, 1); else arr.push(v);
  }

  /* ───────── 시작 ───────── */

  function koreanDate(d) {
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  function init() {
    root = document.getElementById('gs24-finder');
    if (!root) return;
    loadState();

    root.className = 'gs24';
    root.innerHTML =
      '<div class="content-card">' +
      '<h2 class="card-title">💰 정부지원금 찾기</h2>' +
      '<p class="card-sub">(공공데이터포털 최신 Data)</p>' +
      '<p class="card-text">내 상황을 선택하면 받을 수 있는 정부지원금을 찾아드려요.<br>' +
      '전국 지원금 <b class="gs24-total">10,000</b>여 개 · 📅 <span class="gs24-date">' + koreanDate(new Date()) + '</span> 기준</p>' +
      '</div>' +
      '<div class="gs24-ad-slot" data-ad="top"></div>' +
      '<h2 class="section-title" id="gs24-search">🔍 조건 선택</h2>' +
      '<div class="gs24-panel gs24-filters"></div>' +
      '<div class="gs24-ad-slot" data-ad="middle"></div>' +
      '<div class="gs24-results" id="gs24-results"></div>' +
      '<div class="gs24-ad-slot" data-ad="bottom"></div>' +
      calcHtml() +
      '<div class="gs24-source" id="gs24-source">📡 <b>데이터 출처</b> 행정안전부 「대한민국 공공서비스(혜택) 정보」 (공공데이터포털)<br>' +
      '정확한 지원 내용과 자격은 반드시 담당기관에 확인하세요.</div>';

    root.addEventListener('click', onClick);
    // '조건 더 보기'를 열고 닫은 상태 기억 (toggle 이벤트는 위로 전달되지 않아 capture 로 받음)
    root.addEventListener('toggle', function (e) {
      if (e.target.classList && e.target.classList.contains('gs24-filter-more')) moreOpen = e.target.open;
    }, true);
    root.addEventListener('input', function (e) {
      var act = e.target.getAttribute('data-act');
      if (act === 'keyword') state.keyword = e.target.value;
      if (act === 'calc-income') { calc.income = e.target.value; renderCalcResult(); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.getAttribute('data-act') === 'keyword') { state.page = 1; search(true); }
    });

    // 기준 날짜 = 데이터를 마지막으로 받은 날 (못 읽으면 오늘 날짜 유지)
    GS24.loadMeta().then(function (meta) {
      var el = root.querySelector('.gs24-date');
      if (meta && meta.updatedAt && el) el.textContent = koreanDate(new Date(meta.updatedAt));
    }).catch(function () { /* 오늘 날짜 유지 */ });

    // 광고: 조건 선택 위 / 검색 결과 위 / 중위소득 계산기 위 + 양쪽 사이드
    var ads = GS24.config.ads;
    GS24.renderAd(root.querySelector('[data-ad="top"]'), ads.top, { label: '블로그 상단 해더 광고' });
    GS24.renderAd(root.querySelector('[data-ad="middle"]'), ads.middle, { label: '블로그 중간 광고' });
    GS24.renderAd(root.querySelector('[data-ad="bottom"]'), ads.bottom, { label: '블로그 하단 광고' });
    GS24.renderSideAds();

    renderFilters();
    renderCalcPeople();
    renderCalcResult();
    search(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
