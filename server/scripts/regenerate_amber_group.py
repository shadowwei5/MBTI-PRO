# -*- coding: utf-8 -*-
"""琥珀组 9 型人格图片重新生成 — Doubao-Seedream-5.0-lite + 皮肤斑点负面提示词增强"""
import sys, json, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import IMAGE_API_URL, VOLCENGINE_IMAGE_MODEL, volcengine_headers

API_URL = IMAGE_API_URL
MODEL = VOLCENGINE_IMAGE_MODEL  # doubao-seedream-5-0-lite-260128
SIZE = "2k"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_images"

# === 琥珀组 9 型 (S×F = S维度 + F决策) ===
AMBER_TYPES = [
    "ESFJ", "ESFD", "ESFP",
    "ASFJ", "ASFD", "ASFP",
    "ISFJ", "ISFD", "ISFP",
]

# === 角色原型（复用 generate_images.py 定义） ===
ROLE_ARCHETYPES = {
    "ESFJ": ("执政官",
        "中青年女性，藏蓝色职业套裙配金色纽扣，领口系同色系小丝巾。"
        "棕色短发打理得一丝不苟，耳戴小巧珍珠耳钉。"
        "双手交叠放在胸前呈"欢迎"姿态，手腕戴精致的细链手表。"
        "身体微微前倾如正在热情迎接来宾，站姿挺拔但亲和力十足。"
        "面部表情：灿烂温暖的笑容露出洁白牙齿，眼神真诚而充满善意"),

    "ESFD": ("领队",
        "中青年女性，琥珀色运动发带箍住利落马尾辫，腕戴运动手环。"
        "身穿运动速干POLO衫琥珀色调配深色运动长裤，腰间挂一只哨子。"
        "左手持扩音器举至嘴边，右臂高举过头做"集合"手势五指张开。"
        "身体站姿挺拔如即将出发，重心略前倾充满动势。"
        "面部表情：笑容热情开朗露出洁白牙齿，双眼神采奕奕如朝阳般活力四射"),

    "ESFP": ("表演家",
        "青年女性，暖金色长卷发高高扎成元气马尾，耳边垂下两缕卷须刘海。"
        "身穿暖金色闪闪亮片短外套配高腰阔腿裤，手腕戴一串彩色手环，颈间系小丝巾。"
        "双臂展开如谢幕鞠躬姿态，手掌向上托举似在拥抱世界。"
        "身体呈"大字"舒展站立，右脚脚尖微微踮起。"
        "面部表情：灿烂大笑露出洁白牙齿，双眼眯成月牙形，整张脸都在发光般极具感染力"),

    "ASFJ": ("志愿者",
        "中青年女性，藏蓝色针织开衫内搭浅色衬衫，颈间佩戴一条简单银链。"
        "头发整齐梳成低发髻用发网固定，面容温和带着不张扬的善意。"
        "双手捧着一个便当盒轻轻递向前方，拇指轻抚盒盖如传递温度。"
        "身体微向前倾如正在弯腰问候，姿态谦和而有分寸。"
        "面部表情：眼神温暖而克制传达着"有什么需要尽管说"的安静善意，嘴角带着含蓄的微笑"),

    "ASFD": ("客服师",
        "中青年女性，琥珀色丝巾优雅系于颈间，耳戴小小琥珀色圆扣耳环。"
        "身穿素雅职业套裙琥珀色调柔和，左手腕戴简约皮质表带手表。"
        "右手轻放在自己胸前做"我在听"的姿势，左手自然垂于身侧指尖微曲。"
        "身体微微前倾呈倾听姿态，肩膀放松不紧绷。"
        "面部表情：嘴角微微上扬带着职业而真诚的微笑，眼神对视不闪躲传递着"我理解你"的亲和力"),

    "ASFP": ("表演者",
        "中青年女性，暖金色大波浪卷发披肩，耳边别一朵小白花发饰。"
        "身穿暖金色丝质披肩罩在浅金色连衣裙外，颈间一条细金链吊着小调色盘坠子。"
        "右手执画笔轻触画架上的画布，左手端调色盘拇指穿过盘孔。"
        "身体微微侧转向后回眸，如被灵感突然击中般停驻。"
        "面部表情：回眸一笑眼波流转，眉梢带俏皮灵动之色，嘴唇轻启似有灵感呼之欲出"),

    "ISFJ": ("守护者",
        "中青年女性，藏蓝色围裙系在腰间，内搭浅色亚麻衬衫袖口卷至肘部。"
        "棕色头发整齐盘起用木簪固定，面容温柔带着岁月沉淀的安宁。"
        "双手捧着一杯刚泡好的热茶递向前方，茶杯冒着袅袅白汽。"
        "身体站在温馨的室内环境中姿态安稳如港湾。"
        "面部表情：眼神柔和而包容如看着归家的亲人，嘴角带着发自内心的温暖微笑"),

    "ISFD": ("护理师",
        "中青年女性，琥珀色发夹别起刘海露出温柔额头，耳戴小巧珍珠耳钉。"
        "身穿浅琥珀色医护制服外披深琥珀色针织开衫，左胸口袋插红蓝两色笔，手捧一个温热的陶瓷茶杯。"
        "另一只手翻开一本皮质封面的护理记录册，食指轻点在某条记录上。"
        "坐于沙发椅中身体微侧如正在与人对谈，姿态开放而亲切。"
        "面部表情：眼含关切之情微微俯首倾听，嘴角带温柔的微笑如春日暖阳"),

    "ISFP": ("艺人",
        "青年女性，暖金色微卷长发松散扎成低马尾，左耳戴一枚羽毛坠饰耳环。"
        "身穿暖金色亚麻衬衫外搭深暖金色针织背心，手腕系几条彩色编织绳。"
        "双手环抱一把原木色吉他，左手按弦右手轻拨琴弦的瞬间定格。"
        "身体微向后靠坐在高脚凳上，一腿屈膝脚踩凳杠，姿态松弛自然。"
        "面部表情：双眼微闭长睫低垂沉浸于旋律之中，嘴唇微启如在低吟，神情陶醉温柔"),
}

# === 颜色分组（UI 9组体系） ===
COLOR_GROUPS = {
    "ESFJ": "藏蓝", "ESFD": "琥珀", "ESFP": "暖金",
    "ASFJ": "藏蓝", "ASFD": "琥珀", "ASFP": "暖金",
    "ISFJ": "藏蓝", "ISFD": "琥珀", "ISFP": "暖金",
}

GROUP_COLORS = {
    "暖金": ("#D4A017", "warm gold"),
    "琥珀": ("#E8A840", "amber"),
    "藏蓝": ("#1B3A5C", "navy blue"),
}

# === 增强的负面提示词（针对皮肤斑点问题） ===
NEGATIVE_PROMPT = (
    "写实照片，3D渲染，厚涂手绘，渐变色彩，复杂阴影，模糊失焦，"
    "人物畸形，文字错乱，模糊不清，水印，多余装饰，杂乱背景，"
    "真人肖像，笔触纹理，画面噪点，多余肢体，"
    "皮肤纹理细节，皮肤斑点色块，面部斑纹，雀斑，痣，毛孔纹理，"
    "skin texture, skin blemishes, skin spots, freckles, moles, pores,"
    "任何文字、字母、数字、标题、标签、签名、水印、字体、排版、"
    "汉字、英文、符号、字符、字母数字组合、标识语、口号、"
    "typography, letters, words, characters, text, alphabet, calligraphy,"
    "low quality, distorted face, bad anatomy, deformed hands"
)

# === 正面提示词模板 ===
POSITIVE_TEMPLATE = """low poly 低多边形矢量插画，扁平化卡通风格，纯色几何色块拼接，无渐变无阴影，整体干净简约，高清矢量质感。
画面中心是{character_desc}。人物服装、配饰、发色使用{color_name}（{color_hex}）及其邻近色系。
人物皮肤使用均匀干净的扁平色块，面部无斑点无纹理无渐变，五官简洁清晰。
背景为干净的米白色纯色。
CRITICAL: 画面中绝对不出现任何形式的文字、字母、数字、汉字、符号、标题、标签、签名或水印。背景保持纯色空白。"""

def build_prompt(type_code: str) -> tuple[str, str]:
    group = COLOR_GROUPS.get(type_code, "未知")
    color_hex, _color_en = GROUP_COLORS.get(group, ("#808080", "gray"))
    role = ROLE_ARCHETYPES.get(type_code)
    if not role:
        raise ValueError(f"未找到类型 {type_code} 的角色原型")
    _title, char_desc = role
    positive = POSITIVE_TEMPLATE.format(
        character_desc=char_desc,
        color_name=group,
        color_hex=color_hex,
    )
    return positive, NEGATIVE_PROMPT

def call_seedream(positive: str, negative: str, max_retries: int = 3) -> str | None:
    payload = {
        "model": MODEL,
        "prompt": positive,
        "negative_prompt": negative,
        "size": SIZE,
        "response_format": "url",
        "watermark": False,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = volcengine_headers()
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            if "data" in result and len(result["data"]) > 0:
                return result["data"][0]["url"]
            elif "error" in result:
                print(f"  ❌ API 错误: {result['error']}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 5)
        except Exception as e:
            print(f"  ⚠️ 请求失败 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep((attempt + 1) * 10)
    return None

def download_image(url: str, path: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MBTI-PRO/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            path.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"  ❌ 下载失败: {e}")
        return False

def main():
    print(f"🎨 琥珀组 9 型重新生成 — 模型: {MODEL}")
    print(f"📁 输出目录: {OUTPUT_DIR}")
    print(f"🖼️  目标类型: {', '.join(AMBER_TYPES)}")
    print()

    success_count = 0
    fail_list = []

    for i, type_code in enumerate(AMBER_TYPES, 1):
        print(f"[{i}/9] {type_code} — 生成中...")

        positive, negative = build_prompt(type_code)
        print(f"  提示词长度: {len(positive)} 字符")

        image_url = call_seedream(positive, negative)
        if not image_url:
            print(f"  ❌ {type_code} 生成失败，所有重试已用尽")
            fail_list.append(type_code)
            continue

        print(f"  ✅ 生成成功，下载中...")
        output_path = OUTPUT_DIR / f"{type_code}.jpg"

        if download_image(image_url, output_path):
            file_size = output_path.stat().st_size
            print(f"  ✅ {type_code}.jpg 已保存 ({file_size:,} bytes)")
            success_count += 1
        else:
            print(f"  ❌ {type_code} 下载失败")
            fail_list.append(type_code)

        # API 限速等待
        if i < len(AMBER_TYPES):
            wait = 12
            print(f"  ⏳ 等待 {wait}s (API 限速)...")
            time.sleep(wait)
        print()

    # === 汇总 ===
    print("=" * 50)
    print(f"✅ 成功: {success_count}/9")
    if fail_list:
        print(f"❌ 失败: {', '.join(fail_list)}")
    else:
        print("🎉 全部 9 张琥珀组图片生成完成！")
    print(f"📁 输出目录: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
