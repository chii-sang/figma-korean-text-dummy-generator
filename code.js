const PANEL_SIZE = { width: 360, height: 460 };
const DEFAULT_FONT_CANDIDATES = [
  { family: 'Pretendard', style: 'Regular' },
  { family: 'Noto Sans KR', style: 'Regular' },
  { family: 'Inter', style: 'Regular' }
];

const BRAND_PREFIXES = [
  '로맨틱 홈',
  '어반 클래식',
  '모노 스튜디오',
  '데일리 큐브',
  '살롱 무드',
  '리빙 아이디어',
  '코지 시그니처',
  '노르딕 브리즈'
];

const STYLE_TAGS = [
  '미니 원목',
  '시그니처 라탄',
  '소프트 패브릭',
  '모듈러 글라스',
  '데일리 메탈',
  '콤팩트 슬림',
  '라운드 엣지',
  '프리미엄 스톤'
];

const PRODUCT_TYPES = [
  '화장대',
  '와이드 서랍장',
  '포근 러그',
  '2인 패브릭 소파',
  '키친 아일랜드',
  '라운드 티테이블',
  '폴딩 수납장',
  '아치 장식 거울',
  '호텔식 침구 세트',
  '라운지 암체어'
];

const OPTION_GROUPS = [
  { label: '색상', values: ['화이트', '라이트 베이지', '샌드 그레이', '다크 우드', '미드나잇 블루', '세이지 그린'] },
  { label: '사이즈', values: ['S', 'M', 'L', 'Wide', 'Grande', 'Tall'] },
  { label: '구성', values: ['단품', '2EA 세트', '상판+거울', '본품+수납팩', '풀 패키지'] },
  { label: '소재', values: ['천연 원목', '스톤 세라믹', 'E0 등급 보드', '마이크로 화이버', '내열 강화유리'] },
  { label: '추가', values: ['LED 라이트 포함', '소프트 클로징', '케이블 정리홀', '360° 회전', '방수 코팅'] }
];

const PRICE_RANGE = { min: 12000, max: 950000, step: 500 };

showPluginUI();

function showPluginUI() {
  figma.showUI(__html__, PANEL_SIZE);
  notifySelectionInfo();
  figma.on('selectionchange', notifySelectionInfo);
}

figma.ui.onmessage = async (msg) => {
  const { type, payload } = msg;

  try {
    switch (type) {
      case 'ui-ready':
        notifySelectionInfo();
        sendPreview();
        break;
      case 'request-preview':
        sendPreview(payload?.textType);
        break;
      case 'fill-selection':
        await fillSelectionWithType(payload?.textType);
        break;
      case 'close-plugin':
        figma.closePlugin();
        break;
      default:
        console.warn('Unhandled message', msg);
    }
  } catch (error) {
    console.error(error);
    figma.notify('⚠️ 텍스트를 적용하는 중 오류가 발생했습니다.');
    figma.ui.postMessage({
      type: 'apply-result',
      payload: { status: 'error', reason: 'exception', message: `${error}` }
    });
  }
};

async function fillSelectionWithType(textType = 'product') {
  const selection = figma.currentPage.selection.filter((node) => node.type === 'TEXT');
  if (selection.length === 0) {
    figma.notify('텍스트 레이어를 선택해 주세요.');
    figma.ui.postMessage({
      type: 'fill-result',
      payload: { status: 'error', reason: 'no-selection' }
    });
    return;
  }

  for (const textNode of selection) {
    await ensureFonts(textNode);
    textNode.characters = generateTextByType(textType);
    textNode.textAutoResize = 'HEIGHT';
  }

  figma.notify('랜덤 텍스트를 적용했습니다.');
  figma.ui.postMessage({
    type: 'fill-result',
    payload: { status: 'ok', appliedCount: selection.length, textType }
  });
}

async function loadPreferredFont() {
  for (const font of DEFAULT_FONT_CANDIDATES) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch (err) {
      // Try the next fallback font.
    }
  }
  throw new Error('사용 가능한 서체를 불러올 수 없습니다.');
}

async function ensureFonts(textNode) {
  if (textNode.fontName !== figma.mixed) {
    await figma.loadFontAsync(textNode.fontName);
    return;
  }

  const length = textNode.characters.length;
  if (length === 0) {
    const fallback = await loadPreferredFont();
    textNode.fontName = fallback;
    return;
  }

  const fontMap = new Map();

  for (const font of textNode.getRangeAllFontNames(0, length)) {
    fontMap.set(`${font.family}-${font.style}`, font);
  }

  for (const font of fontMap.values()) {
    await figma.loadFontAsync(font);
  }
}

function notifySelectionInfo() {
  const selection = figma.currentPage.selection;
  const textLayers = selection.filter((node) => node.type === 'TEXT').length;
  figma.ui.postMessage({
    type: 'selection-update',
    payload: { textLayers, totalLayers: selection.length }
  });
}

function sendPreview(textType = 'product') {
  const result = generateTextByType(textType);
  figma.ui.postMessage({
    type: 'preview-text',
    payload: { textType, text: result }
  });
}

function generateTextByType(textType = 'product') {
  switch (textType) {
    case 'option':
      return generateOptionLine();
    case 'price':
      return generatePriceTag();
    case 'product':
    default:
      return generateProductName();
  }
}

function generateProductName() {
  return `${pickRandom(BRAND_PREFIXES)} ${pickRandom(STYLE_TAGS)} ${pickRandom(PRODUCT_TYPES)}`;
}

function generateOptionLine() {
  const groups = shuffle([...OPTION_GROUPS]);
  const count = randomInt(2, Math.min(3, groups.length));
  const selected = groups.slice(0, count);
  return selected.map((group) => `${group.label}: ${pickRandom(group.values)}`).join(', ');
}

function generatePriceTag() {
  const steps = Math.floor((PRICE_RANGE.max - PRICE_RANGE.min) / PRICE_RANGE.step);
  const value = PRICE_RANGE.min + randomInt(0, steps) * PRICE_RANGE.step;
  return `${formatNumber(value)}원`;
}

function pickRandom(list = []) {
  if (!list.length) return '';
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
