// 블로그스팟 테마 파일 만들기
// 실행: node scripts/build-theme.mjs [데이터 주소]
//   예) node scripts/build-theme.mjs https://아이디.github.io/gov-support24/data/
//
// 만들어지는 파일
//   blogger/theme-gov-support24.xml  → 블로그스팟 [테마 → HTML 편집]에 붙여넣을 파일
//   .theme-preview/index.html        → 내 컴퓨터에서 테마가 작동하는지 확인하는 파일
//                                      (node scripts/serve.mjs 실행 후 http://localhost:8080/ )

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const dataUrl = process.argv[2] || '';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

const template = await read('blogger/theme-template.xml');
const css = [await read('src/gs24-shell.css'), await read('src/gs24-style.css')].join('\n');
const js = [
  await read('src/gs24-blogger.js'),
  await read('src/gs24-core.js'),
  await read('src/gs24-finder.js'),
  await read('src/gs24-detail.js')
].join('\n');

// 블로그스팟 테마는 XML이라 CDATA 안에 "]]>" 가 있으면 깨짐
for (const [name, text] of [['CSS', css], ['JS', js]]) {
  if (text.includes(']]>')) throw new Error(`${name} 안에 ]]> 가 있어 테마에 넣을 수 없어요`);
}

const theme = template
  .replace('/*@@GS24_CSS@@*/', () => css)
  .replace('/*@@GS24_JS@@*/', () => js)
  .replace('@@GS24_DATA_URL@@', () => dataUrl);

await mkdir(new URL('../blogger/', import.meta.url), { recursive: true });
await writeFile(new URL('../blogger/theme-gov-support24.xml', import.meta.url), theme);

/* ───────── 내 컴퓨터 확인용: 블로그스팟이 테마를 HTML로 바꾸는 과정을 흉내 ───────── */

const localConfig = `window.GS24_CONFIG = {
  listPageUrl: '/',
  detailPageUrl: '/p/support-detail.html',
  dataBaseUrl: '/data/',
  ads: { preview: true }   // 애드센스는 승인된 블로그 주소에서만 나오므로 위치 표시 상자로 대신 보여줌
};`;

let html = theme
  .replace(/^<\?xml[^>]*>\s*/, '')
  .replace('<b:skin><![CDATA[', '<style>')
  .replace(']]></b:skin>', '</style>')
  .replace(/<title>[\s\S]*?<\/title>/, '<title>정부지원금찾기 (테마 확인용)</title>')
  .replace(/<b:include [^>]*\/>/g, '')
  .replace(/<b:section[\s\S]*?<\/b:section>/g,
    '<div class="post"><h3 class="post-title">(블로그 글 영역 · 일반 글 주소에서만 보임)</h3></div>')
  // 외부 광고·무효트래픽 스크립트는 내 컴퓨터에서 실행하지 않음
  .replace(/<script async='async' crossorigin='anonymous' src='https:\/\/pagead2[^']*'\/>/, '<!-- (확인용: 애드센스 자동광고 스크립트 생략) -->')
  .replace(/<script src='https:\/\/cdn\.jsdelivr\.net\/gh\/abaeksite[^']*'\/>/, '<!-- (확인용: 무효트래픽 방지 스크립트 생략) -->')
  .replace(/\/\*@@GS24_CONFIG_START@@\*\/[\s\S]*?\/\*@@GS24_CONFIG_END@@\*\//, () => localConfig)
  .replace(/\s(?:expr|b):[\w-]+='[^']*'/g, '')
  .replace(/\sxmlns(?::\w+)?='[^']*'/g, '')
  .replace(/<(div|script)([^>]*)\/>/g, '<$1$2></$1>'); // 블로그스팟처럼 <div/> → <div></div>

await mkdir(new URL('../.theme-preview/', import.meta.url), { recursive: true });
await writeFile(new URL('../.theme-preview/index.html', import.meta.url), html);

const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)}KB`;
console.log(`✅ blogger/theme-gov-support24.xml (${kb(theme)})`);
console.log(`✅ .theme-preview/index.html (확인용)`);
if (!dataUrl) console.log('⚠️ 데이터 주소가 비어 있어요. GitHub에 데이터를 올린 뒤 주소를 넣어 다시 만들어야 블로그에서 지원금이 보여요.');
