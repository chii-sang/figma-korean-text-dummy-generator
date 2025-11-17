const PANEL_SIZE = { width: 380, height: 520 };
const DEFAULT_FONT_CANDIDATES = [
  { family: 'Pretendard', style: 'Regular' },
  { family: 'Noto Sans KR', style: 'Regular' },
  { family: 'Inter', style: 'Regular' }
];

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
        break;
      case 'apply-text':
        await handleApplyText(payload);
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

async function handleApplyText(payload = {}) {
  const { text = '', strategy = 'selection' } = payload;
  if (!text.trim()) {
    figma.notify('먼저 생성할 텍스트를 만들어 주세요.');
    return;
  }

  if (strategy === 'selection') {
    const applied = await fillSelection(text);
    if (!applied) {
      figma.notify('텍스트 레이어를 선택해 주세요.');
      figma.ui.postMessage({
        type: 'apply-result',
        payload: { status: 'error', reason: 'no-selection' }
      });
      return;
    }
  } else if (strategy === 'new') {
    await createNewTextLayer(text);
  }

  figma.notify('더미 텍스트를 적용했습니다.');
  figma.ui.postMessage({
    type: 'apply-result',
    payload: { status: 'ok', target: strategy }
  });
}

async function fillSelection(text) {
  const selection = figma.currentPage.selection.filter((node) => node.type === 'TEXT');
  if (selection.length === 0) {
    return false;
  }

  for (const textNode of selection) {
    await ensureFonts(textNode);
    textNode.characters = text;
    textNode.textAutoResize = 'HEIGHT';
  }

  return true;
}

async function createNewTextLayer(text) {
  const textNode = figma.createText();
  const font = await loadPreferredFont();
  textNode.fontName = font;
  textNode.characters = text;
  textNode.textAutoResize = 'WIDTH_AND_HEIGHT';

  const { center } = figma.viewport;
  textNode.x = center.x;
  textNode.y = center.y;

  figma.currentPage.selection = [textNode];
  figma.viewport.scrollAndZoomIntoView([textNode]);
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
