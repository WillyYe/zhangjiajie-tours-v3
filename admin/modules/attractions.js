// attractions.js — 景点详情页后台编辑器（薄封装，逻辑见 spot-core.js）
import { createSpotEditor } from './spot-core.js';

const editor = createSpotEditor({
  title: '🏞 景点详情页 Attractions',
  itemLabel: '景点',
  template: 'templates/attraction-page.html',
  kind: 'attraction',
});

export const { renderEditor, renderPreview } = editor;
