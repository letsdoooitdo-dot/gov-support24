/* 정부지원금24 - 상세 화면 (<div id="gs24-detail"></div> 안에 그림, 주소의 ?id= 값 사용) */
(function () {
  'use strict';
  var GS24 = window.GS24;
  var esc = GS24.esc;

  // [데이터 칸, 제목, 카드 모양]
  var SECTIONS = [
    ['purpose', '🎯 이런 지원금이에요', 'farm-blue-card'],
    ['target', '👥 지원 대상', 'farm-white-card'],
    ['criteria', '✅ 선정 기준', 'farm-white-card'],
    ['content', '🎁 지원 내용', 'farm-blue-card'],
    ['howToApply', '📝 신청 방법', 'farm-white-card'],
    ['documents', '📄 구비 서류', 'farm-white-card'],
    ['laws', '⚖️ 관련 법령', 'farm-white-card']
  ];

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function bottomButton() {
    return '<button type="button" class="bottom-button" data-act="list">🔍 나에게 맞는 지원금 더 찾기</button>';
  }

  function render(root, d) {
    var dl = GS24.deadlineInfo(d.deadline);
    var topic = GS24.topicInfo(d.topic);
    var onlineUrl = GS24.safeUrl(d.onlineUrl);
    var gov24Url = GS24.safeUrl(d.gov24Url);

    var infoRows = [
      ['🏛️ 접수 기관', d.receiver],
      ['☎️ 문의처', d.contact],
      ['🔄 정보 수정일', d.updated]
    ].filter(function (row) { return row[1]; });

    var html =
      '<div class="farm-gray-card-center">' +
      '<div class="gs24-tags">' +
      (d.topic ? '<span class="gs24-tag">' + topic.icon + ' ' + esc(d.topic) + '</span>' : '') +
      (d.supportType ? '<span class="gs24-tag">🎁 ' + esc(d.supportType) + '</span>' : '') +
      (dl.expired ? '<span class="gs24-tag red">마감</span>' : '') +
      '</div>' +
      '<h2>' + esc(d.name) + '</h2>' +
      '<p>' + esc([d.org, d.dept].filter(Boolean).join(' · ')) + '</p>' +
      '</div>' +

      // 광고 ①: 지원금 이름 상자 아래 · 신청 기한 상자 위
      '<div class="gs24-ad-slot" data-ad="detail-top"></div>' +

      '<div class="farm-gray-card">' +
      '<h3>📅 신청 기한</h3>' +
      '<p class="apply-date-text">' + esc(d.deadline || '기한 확인 필요') + '</p>' +
      (dl.days != null ? '<p class="apply-text">' + esc(dl.text) + '</p>' : '') +
      (infoRows.length ? '<div class="highlight-box">' + infoRows.map(function (row) {
        return '<div class="requirement-item"><div class="requirement-title">' + row[0] + '</div>' +
          '<div class="requirement-desc">' + esc(row[1]) + '</div></div>';
      }).join('') + '</div>' : '') +
      (onlineUrl ? '<div class="farm-blue-button"><a href="' + esc(onlineUrl) + '" target="_blank" rel="noopener">✍️ 온라인 신청하기</a></div>' : '') +
      (gov24Url ? '<div class="farm-gray-button"><a href="' + esc(gov24Url) + '" target="_blank" rel="noopener">정부24에서 자세히 보기(' + esc(hostOf(gov24Url) || 'gov.kr') + ')</a></div>' : '') +
      '<button type="button" class="gs24-pdf-button" data-act="pdf">📄 PDF로 저장하기</button>' +
      // 인쇄/PDF에서만 보이는 링크 주소
      '<div class="gs24-print-only gs24-print-links">' +
      (onlineUrl ? '✍️ 온라인 신청: ' + esc(onlineUrl) + '<br>' : '') +
      (gov24Url ? '🔗 정부24: ' + esc(gov24Url) : '') +
      '</div>' +
      '</div>';

    SECTIONS.forEach(function (s) {
      var text = d[s[0]] && String(d[s[0]]).trim();
      var extra = s[0] === 'documents' && d.officialDocs
        ? '<div class="documents"><div class="documents-title">🗂️ 담당 공무원이 확인하는 서류</div>' +
          '<div class="gs24-text">' + GS24.multiline(d.officialDocs) + '</div></div>'
        : '';
      if (!text && !extra) return;
      html += '<div class="' + s[2] + '"><h2>' + s[1] + '</h2>' +
        (text ? '<div class="gs24-text">' + GS24.multiline(text) + '</div>' : '') + extra + '</div>';
    });

    // 광고 ②: 함께 보면 좋은 지원금 위
    html += '<div class="gs24-ad-slot" data-ad="detail-related"></div>' +
      '<div class="gs24-related"></div>' +
      '<p class="gs24-notice">※ 정확한 지원 내용과 자격은 반드시 담당기관에 확인하세요.<br>' +
      '📡 출처: 행정안전부 「대한민국 공공서비스(혜택) 정보」 (공공데이터포털)</p>';

    root.innerHTML = html;
    document.title = d.name + ' | 정부지원금 찾기';

    var ads = GS24.config.ads;
    GS24.renderAd(root.querySelector('[data-ad="detail-top"]'), ads.detailTop, { label: '블로그 상단 해더 광고 (신청 기한 위)' });
    GS24.renderAd(root.querySelector('[data-ad="detail-related"]'), ads.detailRelated, { label: '블로그 상단 해더 광고 (함께 보면 좋은 지원금 위)' });
    renderRelated(root, d);
  }

  // 같은 분야 인기 지원금 5개 (우리 지역 또는 전국)
  function renderRelated(root, d) {
    var box = root.querySelector('.gs24-related');
    var fallback = '<div class="benefit-card">' + bottomButton() + '</div>';

    GS24.loadList().then(function (list) {
      var self = list.filter(function (s) { return s.id === d.id; })[0];
      var region = self ? self.region : '전국';
      var related = list
        .filter(function (s) {
          return s.id !== d.id && s.topic === d.topic && (s.region === '전국' || s.region === region) &&
            !GS24.deadlineInfo(s.deadline).expired;
        })
        .sort(function (a, b) { return b.views - a.views; })
        .slice(0, 5);

      if (!related.length) { box.innerHTML = fallback; return; }
      box.innerHTML =
        '<div class="benefit-card">' +
        '<h2 class="benefit-title"><span class="icon">🔥</span>함께 보면 좋은 지원금</h2>' +
        '<div class="benefit-list">' + related.map(function (s) {
          return '<a class="benefit-item" href="' + esc(GS24.detailUrl(s.id)) + '">' +
            '<span class="benefit-text">' + esc(s.name) + '<small>' + esc(s.org) + '</small></span>' +
            '<span class="benefit-arrow">›</span></a>';
        }).join('') + '</div>' +
        bottomButton() +
        '</div>';
    }).catch(function () {
      box.innerHTML = fallback;
    });
  }

  /*
   * PDF 저장: 상세 내용만 복사해 body 바로 아래에 두고 브라우저 인쇄 창을 열어요.
   * (인쇄 창에서 '대상: PDF로 저장' 선택. 블로그 테마의 헤더·광고 등은 인쇄되지 않음)
   */
  // PDF에는 광고를 넣지 않음: 광고 자리, 애드센스 요소, 자동광고가 본문 단어에 붙인 링크(광고 인텐트)를 지움
  function removeAds(clone) {
    var adSelectors = '.gs24-ad-slot, ins, iframe, [data-ad-client], [data-ad-slot], [data-google-query-id],' +
      '[id^="aswift"], [id^="google_ads"], [class*="google-auto-placed"], [class*="adsbygoogle"]';
    Array.prototype.forEach.call(clone.querySelectorAll(adSelectors), function (el) { el.remove(); });

    // 광고 인텐트 링크는 글자만 남기고 링크를 없앰
    var adLinks = 'a[href="#"], a[href=""], a[href^="javascript:"], a[href*="googleadservices"],' +
      'a[href*="doubleclick"], a[href*="googlesyndication"], a[href*="/aclk"]';
    Array.prototype.forEach.call(clone.querySelectorAll(adLinks), function (a) {
      a.parentNode.replaceChild(document.createTextNode(a.textContent || ''), a);
    });
  }

  function savePdf(root) {
    var title = root.querySelector('.farm-gray-card-center h2');
    if (!title) return;

    Array.prototype.forEach.call(document.querySelectorAll('.gs24-print-root'), function (el) { el.remove(); });
    var clone = root.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('gs24-print-root');
    removeAds(clone);

    var now = new Date();
    var head = document.createElement('div');
    head.className = 'gs24-print-head';
    head.innerHTML = '<b>💰 정부지원금 찾기</b> · 지원금 상세 정보<br><small>저장일 ' +
      now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate() + ' · ' + esc(location.href) + '</small>';
    clone.insertBefore(head, clone.firstChild);
    document.body.appendChild(clone);

    var html = document.documentElement;
    function cleanup() {
      html.classList.remove('gs24-printing');
      clone.remove();
    }
    html.classList.add('gs24-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }

  function showMessage(root, icon, text) {
    root.innerHTML = '<div class="farm-gray-card-center"><div class="gs24-empty"><b>' + icon + '</b>' + text + '</div></div>' +
      '<div class="benefit-card">' + bottomButton() + '</div>';
  }

  function init() {
    var root = document.getElementById('gs24-detail');
    if (!root) return;
    root.className = 'gs24 gs24-detail-wrap';
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="list"]')) location.href = GS24.config.listPageUrl;
      if (e.target.closest('[data-act="pdf"]')) savePdf(root);
    });
    // 블로그 탭 등 페이지 어디서든 href="#gs24-pdf" 링크를 누르면 PDF 저장
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href$="#gs24-pdf"]');
      if (!link) return;
      e.preventDefault();
      savePdf(root);
    });

    var id = new URLSearchParams(location.search).get('id');
    if (!id) return showMessage(root, '🤔', '지원금 정보가 없어요.<br><small>목록에서 지원금을 선택해 주세요.</small>');

    root.innerHTML = '<div class="farm-gray-card-center"><div class="gs24-empty"><span class="gs24-spinner"></span><br>불러오는 중...</div></div>';
    GS24.loadDetail(id).then(function (d) {
      if (!d) return showMessage(root, '😔', '지원금을 찾을 수 없어요.<br><small>종료되었거나 주소가 바뀌었을 수 있어요.</small>');
      render(root, d);
    }).catch(function () {
      showMessage(root, '⚠️', '정보를 불러오지 못했어요.<br><small>잠시 후 다시 시도해 주세요.</small>');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
