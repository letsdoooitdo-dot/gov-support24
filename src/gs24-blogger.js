/* 정부지원금24 - 블로그스팟 테마용: 주소를 보고 검색 화면 / 상세 화면 / 일반 글 화면을 정하고 탭 메뉴를 만듦 */
(function () {
  'use strict';
  var cfg = window.GS24_CONFIG || {};
  var root = document.getElementById('gs24-root');
  var tabs = document.getElementById('gs24-tabs');
  var html = document.documentElement;

  var path = location.pathname.replace(/\/+$/, '') || '/';
  var detailPath = cfg.detailPageUrl || '/p/support-detail.html';
  var home = cfg.listPageUrl || '/';

  var mode = 'blog';
  if (path === '/' || path === '/index.html') mode = 'home';
  else if (path === detailPath) mode = 'detail';
  html.classList.add('gs24-mode-' + mode);

  // 검색 화면·상세 화면 자리 정하기 (gs24-finder.js / gs24-detail.js 가 이 id를 찾아 그림)
  if (root) {
    if (mode === 'home') root.id = 'gs24-finder';
    else if (mode === 'detail') root.id = 'gs24-detail';
    else root.parentNode.removeChild(root);
  }
  if (mode === 'detail') document.body.classList.add('page-detail');

  // 탭 메뉴 [글자, 주소]
  var items;
  if (mode === 'home') {
    items = [['조건 선택', '#gs24-search'], ['검색 결과', '#gs24-results'], ['중위소득 계산기', '#gs24-income']];
  } else if (mode === 'detail') {
    items = [['조건 선택', home + '#gs24-search'], ['지원금 상세', '#'], ['PDF 저장', '#gs24-pdf']];
  } else {
    items = [['조건 선택', home + '#gs24-search'], ['검색 결과', home + '#gs24-results'], ['중위소득 계산기', home + '#gs24-income']];
  }
  var activeIndex = mode === 'detail' ? 1 : 0;

  if (tabs) {
    tabs.innerHTML = '<ul>' + items.map(function (it, i) {
      return '<li><a href="' + it[1] + '"' + (i === activeIndex ? ' class="active"' : '') + '>' + it[0] + '</a></li>';
    }).join('') + '</ul>';

    tabs.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      if (a.getAttribute('href') === '#') e.preventDefault();
      if (a.getAttribute('href') === '#gs24-pdf') return; // PDF 저장은 탭 표시를 바꾸지 않음
      Array.prototype.forEach.call(tabs.querySelectorAll('a'), function (x) { x.classList.toggle('active', x === a); });
    });
  }
})();
