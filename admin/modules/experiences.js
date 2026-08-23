// experiences.js — 体验后台编辑器（薄封装，逻辑见 spot-core.js）
import { createSpotEditor } from './spot-core.js';

const editor = createSpotEditor({
  title: '🎢 体验 Experiences',
  itemLabel: '体验',
  template: 'templates/experience-page.html',
  kind: 'experience',
  imgBase: 'experiences',
});

export const { renderEditor, renderPreview } = editor;
