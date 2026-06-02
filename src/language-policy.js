export const OPENPRD_CONTENT_LOCALE = 'zh-CN';

export const OPENPRD_LANGUAGE_POLICY =
  'OpenPrd 默认用简体中文生成用户可见内容以及 Agent 产出的 spec、tasks 和说明文案；PRD、OpenPrd、OpenSpec、API、SDK、CLI、TypeScript、JSON、HTTP、WebSocket、字段 key、命令名、品牌名、产品名和协议名等必要专有名词按原文保留。';

export const TBD_ZH = '待补充';

const CJK_RE = /[\u3400-\u9fff]/;

export function scalarZh(value, fallback = TBD_ZH) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

export function hasSimplifiedChinese(value) {
  return CJK_RE.test(String(value ?? ''));
}

export function preferSimplifiedChinese(value, fallback = TBD_ZH) {
  const text = scalarZh(value, '');
  return hasSimplifiedChinese(text) ? text : fallback;
}

export function languagePolicyLines() {
  return [
    '> 语言规则：默认用简体中文生成 PRD、spec、tasks 和用户可见说明；除 PRD、OpenPrd、OpenSpec、API、SDK、CLI、TypeScript、JSON、HTTP、WebSocket、字段 key、命令名、品牌名、产品名和协议名等必要专有名词外，其余内容优先写成简体中文。',
    '',
  ];
}
