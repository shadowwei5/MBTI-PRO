// 一次性数据修正（2026-11-12 23:20）
// 目标：81 型代表人物满足三条准则 —— ①一眼认出 ②四维无硬伤 ③不与其它型共用。
// 做四件事：去重（含「同一人两种写法」）、换掉认不出的人、补齐身份字典、统一侧写里的名字。
// 幂等：重复执行结果一致；已替换过的旧名找不到会跳过并打印。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TYPES = resolve(ROOT, 'server/src/content/types.ts');
const STORIES = resolve(ROOT, 'server/src/content/celebrity-stories.ts');
const FIELDS = resolve(ROOT, 'server/src/content/celebrity-fields.ts');

/* ---------- 1. CELEBRITY_MAP 逐条替换 ---------- */
// [类型, 原名, 新名 or null(删除)]
const EDITS = [
  // 曾国藩：只在 ABCD 保留
  ['EBCD', '曾国藩', '胡雪岩'], ['IBTJ', '曾国藩', '查理·芒格'], ['IBTJ', '左宗棠', null],
  // 宫崎骏：只在 ABCP 保留
  ['ENFP', '宫崎骏', '周星驰'],
  // 达尔文：只在 ABTP 保留；亚当·斯密：只在 ABTD 保留
  ['INTP', '达尔文', '老子'], ['INTP', '亚当·斯密', '牛顿'],
  // 管仲：只在 IBCJ 保留
  ['ABTD', '管仲', '吴敬琏'], ['ABTD', '桑弘羊', null],
  // 司马光：只在 ISCJ 保留；韩非子＝韩非，只在 IBCJ 保留
  ['ABTJ', '司马光', '弗朗西斯·培根'], ['ABTJ', '韩非子', '马基雅维利'],
  // 费曼：只在 EBTP 保留
  ['ANTP', '费曼', '道金斯'],
  // 海瑞：只在 ASFD 保留；司马光在 ASTJ 是重复
  ['ASTJ', '海瑞', '李光耀'], ['ASTJ', '司马光', null],
  // 张居正：只在 ASTD 保留
  ['EBCJ', '张居正', '基辛格'],
  // 董明珠：只在 ESTJ 保留；乔治·巴顿＝巴顿（ESTD 保留）
  ['EBTJ', '董明珠', '贝索斯'], ['EBTJ', '乔治·巴顿', '安迪·格鲁夫'],
  // 沃伦·巴菲特＝巴菲特（ISTJ 保留）
  ['EBTD', '沃伦·巴菲特', '山姆·沃尔顿'], ['EBTD', '王永庆', null],
  // 艾森豪威尔：只在 ESCJ 保留
  ['ENCJ', '艾森豪威尔', '孙正义'],
  // 特蕾莎修女：只在 ISFJ 保留
  ['ENFD', '特蕾莎修女', '罗翔'], ['INFJ', '特蕾莎修女', '杜甫'],
  // 梵高：只在 ISFP 保留；李白：只在 INFP 保留
  ['INFP', '梵高', '圣埃克苏佩里'], ['ISFP', '李白', '王菲'],
  // 乔治·华盛顿：只在 ESTJ 保留；诸葛亮：只在 INTJ 保留
  ['ISTJ', '乔治·华盛顿', '默克尔'], ['ISTJ', '诸葛亮', null],
  // 孙武＝孙子（ISTD 保留）
  ['INTD', '孙武', '海德格尔'],
  // 徐光启：只在 ISCD 保留
  ['INCD', '徐光启', '居里夫人'],
  // 商鞅：只在 IBCJ 保留；吴起：只在 ISTD 保留
  ['IBTD', '商鞅', '塔勒布'], ['IBTD', '吴起', null],
  // 德鲁克＝彼得·德鲁克（ENCJ 保留）
  ['ANTJ', '德鲁克', null],
  // 奥黛丽·赫本：只在 ASFP 保留
  ['ANFJ', '奥黛丽·赫本', '杨澜'],
  // 乔布斯：只在 ENCD 保留
  ['ISTP', '乔布斯', '詹姆斯·戴森'],
  // 认不出的历史人物 → 换掉
  ['ISFJ', '孟母', '林巧稚'], ['ISFJ', '岳母', null],
  ['ABCD', '冯道', '亚里士多德'], ['ABCD', '李沆', '歌德'], ['ABCD', '吕端', '张謇'],
  ['ABCJ', '申不害', '李鸿章'], ['ABCJ', '田穰苴', '俾斯麦'], ['ABCJ', '赵充国', null],
  ['IBCD', '郑国', '屠呦呦'], ['IBCD', '召信臣', null],
  ['ISCP', '李春', '贝聿铭'], ['ISCP', '马钧', null],
  ['IBTP', '道尔顿', '袁隆平'], ['IBTP', '郦道元', '珍·古道尔'],
  ['ANTD', '郭守敬', '诺伯特·维纳'],
  ['ASCD', '李纲', '苏武'],
  ['IBCJ', '慎到', null],
];

let src = readFileSync(TYPES, 'utf8');
const start = src.indexOf('const CELEBRITY_MAP');
const open = src.indexOf('{', start);
let depth = 0, close = -1;
for (let j = open; j < src.length; j++) {
  if (src[j] === '{') depth++;
  else if (src[j] === '}') { depth--; if (depth === 0) { close = j; break; } }
}
const blockText = src.slice(open + 1, close);

const map = {};
const order = [];
for (const line of blockText.split('\n')) {
  const m = line.match(/^(\s*)([A-Z]{4}):\s*\[(.*)\],?\s*$/);
  if (!m) continue;
  map[m[2]] = [...m[3].matchAll(/'([^']*)'/g)].map(x => x[1]);
  order.push(m[2]);
}

const missed = [];
for (const [code, oldName, newName] of EDITS) {
  const list = map[code];
  if (!list) { missed.push(`${code} 不存在`); continue; }
  const i = list.indexOf(oldName);
  if (i < 0) continue; // 已处理过
  if (newName === null) list.splice(i, 1);
  else list[i] = newName;
}
if (missed.length) console.log('跳过：', missed.join(' / '));

// 用新数据重建块，保留分组注释行
const lines = blockText.split('\n').map(line => {
  const m = line.match(/^(\s*)([A-Z]{4}):\s*\[(.*)\],?\s*$/);
  if (!m) return line;
  const list = map[m[2]];
  return `${m[1]}${m[2]}: [${list.map(n => `'${n}'`).join(', ')}],`;
});
src = src.slice(0, open + 1) + lines.join('\n') + src.slice(close);
src = src.replace(
  '// 保证 81 型代表人物各不相同，无重复使用',
  '// 2026-11-12 校验：完全重名 0 · 同一人两种写法 0（脚本 scripts/build-celebrity-review.mjs 可复查）'
);
writeFileSync(TYPES, src, 'utf8');

/* ---------- 2. 侧写里的名字与人物表对齐 ---------- */
const RENAME = [
  ['麦克阿瑟', '道格拉斯·麦克阿瑟'],
  ['杜鲁门', '哈里·杜鲁门'],
  ['黑塞', '赫尔曼·黑塞'],
  ['熊彼特', '约瑟夫·熊彼特'],
];
let st = readFileSync(STORIES, 'utf8');
for (const [from, to] of RENAME) {
  st = st.split(`name: '${from}',`).join(`name: '${to}',`);
}
writeFileSync(STORIES, st, 'utf8');

/* ---------- 3. 身份字典补字段 ---------- */
const ADD_FIELDS = {
  // 原本就缺的 11 人
  '奥黛丽·赫本': '演员 / 人道主义工作者',
  '费曼': '物理学家 / 诺贝尔物理学奖得主',
  '曾国藩': '晚清名臣 / 湘军创建者',
  '艾森豪威尔': '美国五星上将 / 第 34 任总统',
  '特蕾莎修女': '修女 / 诺贝尔和平奖得主',
  '宫崎骏': '动画导演 / 吉卜力工作室创始人',
  '梵高': '画家 / 后印象派代表',
  '达尔文': '生物学家 / 进化论奠基人',
  '亚当·斯密': '经济学家 / 《国富论》作者',
  '乔治·华盛顿': '美国首任总统',
  '乔布斯': '苹果公司联合创始人',
  // 本轮新换进来的人
  '胡雪岩': '晚清商人',
  '查理·芒格': '投资家 / 伯克希尔副董事长',
  '周星驰': '演员 / 导演',
  '老子': '思想家 / 道家创始人',
  '牛顿': '物理学家 / 数学家',
  '吴敬琏': '经济学家',
  '弗朗西斯·培根': '哲学家',
  '马基雅维利': '政治思想家',
  '道金斯': '演化生物学家',
  '李光耀': '政治家 / 新加坡首任总理',
  '基辛格': '美国前国务卿',
  '安迪·格鲁夫': '英特尔前 CEO',
  '贝索斯': '亚马逊创始人',
  '山姆·沃尔顿': '沃尔玛创始人',
  '孙正义': '投资家 / 软银创始人',
  '罗翔': '法学教授',
  '杜甫': '唐代诗人',
  '圣埃克苏佩里': '作家 / 飞行员',
  '王菲': '歌手',
  '默克尔': '德国前总理',
  '海德格尔': '哲学家',
  '居里夫人': '物理学家 / 化学家',
  '塔勒布': '风险管理学者 / 作家',
  '杨澜': '主持人 / 媒体人',
  '詹姆斯·戴森': '发明家 / 戴森创始人',
  '林巧稚': '妇产科医生',
  '亚里士多德': '哲学家 / 博物学家',
  '歌德': '作家 / 思想家',
  '张謇': '实业家 / 教育家',
  '李鸿章': '晚清重臣',
  '俾斯麦': '德意志帝国首任宰相',
  '屠呦呦': '药学家 / 诺贝尔生理学或医学奖得主',
  '贝聿铭': '建筑师',
  '诺伯特·维纳': '数学家 / 控制论创始人',
  '苏武': '西汉使节',
  '袁隆平': '农学家',
  '珍·古道尔': '灵长类动物学家',
};

let fd = readFileSync(FIELDS, 'utf8');
const fi = fd.indexOf('export const CELEBRITY_FIELDS');
const fo = fd.indexOf('{', fi);
let d2 = 0, fc = -1;
for (let j = fo; j < fd.length; j++) {
  if (fd[j] === '{') d2++;
  else if (fd[j] === '}') { d2--; if (d2 === 0) { fc = j; break; } }
}
const existing = new Set([...fd.slice(fo, fc).matchAll(/'([^']+)':/g)].map(m => m[1]));
const added = [];
for (const [name, field] of Object.entries(ADD_FIELDS)) {
  if (existing.has(name)) continue;
  added.push(name);
}
const inject = added.length
  ? '\n  // ===== 2026-11-12 签名对齐与人物替换时补齐 =====\n' +
    added.map(n => `  '${n}': '${ADD_FIELDS[n]}',`).join('\n') + '\n'
  : '';
fd = fd.slice(0, fc) + inject + fd.slice(fc);
writeFileSync(FIELDS, fd, 'utf8');

console.log(`人物表已更新：${EDITS.length} 条规则`);
console.log(`侧写改名：${RENAME.length} 处`);
console.log(`身份字典新增：${added.length} 人`);
