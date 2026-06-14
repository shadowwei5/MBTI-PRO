"""为65个新人格类型生成AI几何图像提示词"""
import sqlite3, os, json, re

DB = os.path.join(os.path.dirname(__file__), 'prisma', 'dev.db')
traditional = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
               'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

# ---- 9组颜色体系 (基于感知(S/B/N) × 判断(T/C/F)) ----

GROUPS = {
    'ST': {
        'name': '钢蓝组',
        'color_hex': '#4682B4',
        'color_name': '钢蓝',
        'color_cn': '钢蓝色调，冷金属质感，带有银灰光泽',
        'mood': '理性、严谨、结构、效率、冷静、精密',
        'shapes': '直线、矩形、齿轮、机械结构、网格、锐角三角形',
        'texture': '拉丝金属、磨砂钢面、冷光反射、精密刻度',
        'atmosphere': '工业车间、实验室、深夜机房、极简工作台'
    },
    'SC': {
        'name': '岩灰组',
        'color_hex': '#7B8D8E',
        'color_name': '岩灰',
        'color_cn': '岩灰色调，中性石材质感，带有低调的哑光绿意',
        'mood': '务实、平衡、审慎、稳健、接地气、可靠',
        'shapes': '圆角矩形、同心圆、层叠石板、稳重梯形、水平线条',
        'texture': '天然石材、哑光混凝土、细砂质感、水泥抹面',
        'atmosphere': '安静工作室、日式庭院、午后图书馆、石阶小路'
    },
    'SF': {
        'name': '琥珀组',
        'color_hex': '#F59E0B',
        'color_name': '琥珀',
        'color_cn': '琥珀暖橙色调，温润光泽，带有蜂蜜与木质的暖意',
        'mood': '温暖、关怀、守护、细腻、日常、踏实',
        'shapes': '柔和的圆、心形弧线、织物纹理、花瓣层叠、环形',
        'texture': '琥珀蜜蜡、手工陶器、棉麻织物、原木纹理',
        'atmosphere': '温馨厨房、手作工坊、秋日午后、花园阳台'
    },
    'BT': {
        'name': '深炭灰组',
        'color_hex': '#4A4A4A',
        'color_name': '炭灰',
        'color_cn': '深炭灰色调，多层次暗灰渐变，带有石墨的光泽深度',
        'mood': '策略、全局、深度、弹性、理性、内敛力量',
        'shapes': '六边形、交叉线条、层叠透明面、数据节点图、折线',
        'texture': '石墨粉末、碳纤维纹理、暗色水磨石、哑光炭层',
        'atmosphere': '战略室、深夜书斋、高山观测站、极简建筑内部'
    },
    'BC': {
        'name': '月光银灰组',
        'color_hex': '#B8B8D0',
        'color_name': '月光银',
        'color_cn': '月光银色，柔和的银灰带淡紫微光，轻盈通透',
        'mood': '适应、包容、连接、弹性、全面、灵动',
        'shapes': '椭圆、柔边多边形、涟漪波纹、交错的弧形、网状',
        'texture': '月光下的水面、拉丝银器、雾面玻璃、丝绸光泽',
        'atmosphere': '月光湖畔、清晨薄雾、现代画廊、通透中庭'
    },
    'BF': {
        'name': '暖燕麦组',
        'color_hex': '#D2B48C',
        'color_name': '暖燕麦',
        'color_cn': '暖燕麦米色调，柔和的奶油棕，带有阳光烘焙的温暖',
        'mood': '治愈、温柔、调和、包容、亲和、平和',
        'shapes': '柔边椭圆、交叠的环形、麦穗弧线、云朵轮廓',
        'texture': '燕麦谷物、羊绒织物、亚麻纸张、柔光陶瓷',
        'atmosphere': '阳光书房、麦田黄昏、手作咖啡馆、羊毛毯旁'
    },
    'NT': {
        'name': '深紫组',
        'color_hex': '#5B2D8E',
        'color_name': '深紫',
        'color_cn': '深邃紫色渐变，从暗紫到靛蓝，带有星云般的光晕',
        'mood': '远见、创新、智识、颠覆、宏大、探索',
        'shapes': '星形节点、放射线、螺旋上升、晶体结构、非对称几何',
        'texture': '星云尘埃、紫水晶矿、深空背景、暗色棱镜折射',
        'atmosphere': '天文台穹顶、未来实验室、深夜星空、量子空间'
    },
    'NC': {
        'name': '靛青组',
        'color_hex': '#3F51B5',
        'color_name': '靛青',
        'color_cn': '靛青与蓝紫交织，深沉中透出智慧的光芒',
        'mood': '洞察、整合、哲思、深邃、设计、平衡智慧',
        'shapes': '曼陀罗对称、嵌套结构、光路交叉、书页层叠',
        'texture': '靛蓝染料、古老星图、磨砂靛玻璃、深水波纹',
        'atmosphere': '哲学书房、深夜灯塔、古老图书馆、冥想空间'
    },
    'NF': {
        'name': '翠绿组',
        'color_hex': '#2E8B57',
        'color_name': '翠绿',
        'color_cn': '翠绿色调，从嫩绿到深海绿渐变，充满生机与灵性',
        'mood': '理想、诗意、鼓舞、灵魂、共鸣、生长',
        'shapes': '藤蔓曲线、树叶脉络、生长的螺旋、晨露圆珠、羽状',
        'texture': '翡翠光泽、晨露叶面、森林苔藓、极光飘带',
        'atmosphere': '晨光森林、雨后花园、世外桃源、诗歌角落'
    }
}

def get_group_key(code):
    """从人格代码推导9组分类键 (pos2+pos3)"""
    s_type = code[1]  # S/B/N
    j_type = code[2]  # T/C/F
    return s_type + j_type

def extract_keywords(code, overview):
    """从概览中提取核心描述词 (每个维度2-3个关键词)"""
    keywords = {
        'essence': '',      # 本质标签
        'trait3': [],       # 3个核心特质
        'daily': '',        # 日常意象
        'social': '',       # 社交意象
        'metaphor': '',     # 核心隐喻
        'nickname': '',     # 网友昵称
    }

    # 提取网友昵称
    nickname_match = re.search(r'网友称[为]?[「「]([^」」]+)[」」]', overview)
    if nickname_match:
        keywords['nickname'] = nickname_match.group(1)

    # 从概览第一句提取核心定义
    first_sent = overview.split('。')[0] if '。' in overview else overview[:80]
    keywords['essence'] = first_sent[:60]

    return keywords

def build_prompt(code, group, keywords):
    """为一个人格类型构建AI图像生成提示词"""
    g = GROUPS[group]

    # 提取4维度特质
    dims = {
        'E': '外向活力', 'A': '从容弹性', 'I': '内向深度',
        'S': '务实感知', 'B': '全局视野', 'N': '直觉远见',
        'T': '逻辑思考', 'C': '平衡综合', 'F': '情感温暖',
        'P': '开放探索', 'D': '灵活稳健', 'J': '有序执行'
    }
    dim_traits = '、'.join([dims.get(c, '') for c in code if c in dims])

    prompt = f"""一幅抽象几何艺术作品，代表人格类型 {code}。
风格：极简几何抽象，包豪斯风格与现代数据可视化美学的融合。
配色：以{g['color_name']}（{g['color_hex']}）为主色调，{g['color_cn']}。
构图元素：{g['shapes']}。
质感：{g['texture']}。
氛围：{g['atmosphere']}。
画面情绪：{g['mood']}。
人格维度：{dim_traits}。
整体要求：画面整洁、有呼吸感、几何元素之间保持和谐的比例关系，适合作为人格卡片封面。无文字、无人脸、无具象物体。"""

    return prompt

def build_short_prompt(code, group):
    """简短版提示词 - 适合快速生成"""
    g = GROUPS[group]
    return f"抽象几何构成，{g['color_name']}色调（{g['color_hex']}），{g['shapes'][:30]}，{g['mood'][:20]}，极简风格，无文字，高质感渲染，--ar 1:1"

def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute('SELECT code, overview FROM PersonalityType ORDER BY code')
    rows = {c: o for c, o in cur.fetchall()}
    conn.close()

    results = []

    for code, overview in rows.items():
        if code in traditional:
            continue

        group_key = get_group_key(code)
        group_info = GROUPS[group_key]
        kw = extract_keywords(code, overview or '')

        full_prompt = build_prompt(code, group_key, kw)
        short_prompt = build_short_prompt(code, group_key)

        results.append({
            'code': code,
            'group_name': group_info['name'],
            'group_color': group_info['color_hex'],
            'color_name': group_info['color_name'],
            'nickname': kw['nickname'],
            'full_prompt': full_prompt,
            'short_prompt': short_prompt,
        })

    # 按分组排序输出
    results.sort(key=lambda r: (r['group_name'], r['code']))

    # 保存为JSON
    json_path = os.path.join(os.path.dirname(__file__), 'image_prompts_65.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f'JSON已保存: {json_path} ({len(results)}条)')

    # 保存为Markdown
    md_path = os.path.join(os.path.dirname(__file__), 'image_prompts_65.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('# 65型人格几何图像AI生成提示词\n\n')
        f.write('## 推荐大模型\n\n')
        f.write('### 国内首选：\n')
        f.write('1. **通义万相 (Tongyi Wanxiang)** — 阿里云出品\n')
        f.write('   - 优势：几何抽象风格表现出色，支持中英文提示词，色彩还原准确\n')
        f.write('   - 接入：阿里云百炼平台 / DashScope API\n')
        f.write('   - 模型：`tongyi-wanxiang-v1.0` 或 `wanx2.0`\n')
        f.write('   - 成本：约 ¥0.06-0.12/张\n\n')
        f.write('2. **即梦 (Dreamina / Jimeng)** — 字节跳动出品\n')
        f.write('   - 优势：概念艺术和抽象风格渲染力强，对几何构成理解到位\n')
        f.write('   - 接入：即梦网页版 / 火山引擎 API\n')
        f.write('   - 模型：`jimeng-t2i-v2`\n')
        f.write('   - 成本：约 ¥0.05-0.10/张\n\n')
        f.write('3. **文心一格 (ERNIE-ViLG)** — 百度出品\n')
        f.write('   - 优势：中文语义理解最优，对中国风抽象元素把握细腻\n')
        f.write('   - 接入：百度智能云 / 文心一言平台\n')
        f.write('   - 成本：会员制 or 按量计费\n\n')
        f.write('### 推荐优先使用：**通义万相**（几何抽象+色彩+成本综合最优）\n')
        f.write('### 备选方案：**即梦**（如果追求更强的艺术感和创意表现力）\n\n')
        f.write('---\n\n')

        # 按分组组织
        current_group = None
        for r in results:
            if r['group_name'] != current_group:
                current_group = r['group_name']
                f.write(f'## {current_group}（{r["color_name"]} · {r["group_color"]}）\n\n')

            f.write(f'### {r["code"]}')
            if r['nickname']:
                f.write(f' — {r["nickname"]}')
            f.write('\n\n')
            f.write(f'**完整提示词：**\n\n```\n{r["full_prompt"]}\n```\n\n')
            f.write(f'**简短版（快速测试）：**\n\n```\n{r["short_prompt"]}\n```\n\n')
            f.write('---\n\n')

    print(f'Markdown已保存: {md_path}')

    # 打印分组统计
    print('\n=== 9组分布 ===')
    from collections import Counter
    group_counts = Counter(r['group_name'] for r in results)
    for gname, count in group_counts.items():
        codes = [r['code'] for r in results if r['group_name'] == gname]
        print(f'  {gname}: {count}个 ({", ".join(codes)})')

if __name__ == '__main__':
    main()
