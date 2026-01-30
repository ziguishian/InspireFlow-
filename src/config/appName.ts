/**
 * 项目名称与资源前缀集中配置
 * 修改此处即可统一更新应用显示名和生成资源的文件命名前缀。
 * 若需同步到构建/安装包，请一并修改：
 * - index.html 的 <title>
 * - package.json 的 name、description、build.productName
 * - src/i18n/locales/*.json 的 app.name、app.subtitle
 */

/** 应用显示名称（窗口标题、关于页、帮助页等） */
export const APP_NAME = 'InspireFlow';

/** 应用副标题 / 中文名（可与 i18n 的 app.subtitle 保持一致） */
export const APP_SUBTITLE = '灵感流动';

/** 生成资源文件的文件名前缀（如：inspireflow123.png） */
export const APP_FILE_PREFIX = 'inspireflow';

const escapedPrefix = APP_FILE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 用于在 URL/路径中匹配已保存资源文件（如 inspireflow123.png） */
export const RESOURCE_FILENAME_MATCH_REGEX = new RegExp(
  `${escapedPrefix}\\d+\\.(png|jpg|jpeg|mp4|glb|txt)`,
  'i'
);
