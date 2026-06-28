"""
MBTI-PRO 人格推广视频生成器
读取人格 JSON 数据，使用 OpenMontage Remotion 引擎生成竖屏动画视频。
配合剪映 SVIP 添加 AI 配音即可发布。

用法: python create_mbti_video.py ENFJ
"""
import json
import sys
import os
from pathlib import Path

# Windows 终端 UTF-8 编码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 将 OpenMontage 加入 Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "OpenMontage"))

from tools.video.video_compose import VideoCompose


def load_personality(code: str) -> dict:
    """加载人格 JSON 数据"""
    json_path = Path(__file__).resolve().parent.parent / "video" / "work" / code / f"{code}.json"
    if not json_path.exists():
        raise FileNotFoundError(f"人格数据文件不存在: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_theme(personality: dict) -> dict:
    """根据人格颜色构建 Remotion 主题"""
    primary = personality.get("_colorHex", "#319554")
    accent = personality.get("_colorTextHex", "#1F6E3A")
    return {
        "backgroundColor": "#0A1628",
        "primaryColor": primary,
        "accentColor": accent,
        "surfaceColor": "#152238",
        "textColor": "#F1F5F9",
        "mutedTextColor": "#94A3B8",
        "fontFamily": "Space Grotesk, Microsoft YaHei, sans-serif",
    }


def build_cuts(personality: dict) -> list[dict]:
    """根据人格数据构建 Remotion 场景序列"""
    code = personality["code"]
    name = personality["name"]
    overview = personality["overview"]
    strengths = personality["strengths"]
    growth = personality["growthAreas"]
    celebrities = personality["celebrities"]
    population = personality.get("population", "约 2.5%")
    color = personality.get("_colorHex", "#319554")

    # 截取概述核心句（约 60-80 字）
    overview_short = _summarize_overview(overview)

    # 代表人物文字
    celeb_text = " · ".join(celebrities[:4])

    # 优势特质（取前 3 条，精简）
    strengths_short = "\n".join(f"▸ {s}" for s in strengths[:3])

    # 成长方向（取前 3 条）
    growth_short = "\n".join(f"▸ {g}" for g in growth[:3])

    cuts = [
        # 开场标题 (0-3s)
        {
            "type": "hero_title",
            "in_seconds": 0,
            "out_seconds": 3,
            "text": code,
            "heroSubtitle": name,
            "accentColor": color,
            "animation": "zoom-in",
        },
        # 人格概览 (3-10s)
        {
            "type": "callout",
            "in_seconds": 3,
            "out_seconds": 10,
            "text": overview_short,
            "callout_type": "quote",
            "title": f"「{name}」人格画像",
            "accentColor": color,
        },
        # 人口占比 (10-14s)
        {
            "type": "stat_card",
            "in_seconds": 10,
            "out_seconds": 14,
            "stat": population,
            "subtitle": "人口占比",
            "accentColor": color,
        },
        # 代表人物 (14-18s)
        {
            "type": "callout",
            "in_seconds": 14,
            "out_seconds": 18,
            "text": celeb_text,
            "callout_type": "info",
            "title": "✨ 代表人物",
            "accentColor": color,
        },
        # 核心优势 (18-23s)
        {
            "type": "callout",
            "in_seconds": 18,
            "out_seconds": 23,
            "text": strengths_short,
            "callout_type": "tip",
            "title": "💪 核心优势",
            "accentColor": color,
        },
        # 成长方向 (23-28s)
        {
            "type": "callout",
            "in_seconds": 23,
            "out_seconds": 28,
            "text": growth_short,
            "callout_type": "info",
            "title": "🌱 成长方向",
            "accentColor": color,
        },
        # CTA 结尾 (28-31s)
        {
            "type": "hero_title",
            "in_seconds": 28,
            "out_seconds": 31,
            "text": "你是哪种人格？",
            "heroSubtitle": "MBTI-PRO · 81型精准测试",
            "accentColor": color,
            "animation": "zoom-out",
        },
    ]
    return cuts


def _summarize_overview(text: str, max_chars: int = 120) -> str:
    """从概述中提取核心句用于视频展示"""
    # 取前几个句子，控制在 max_chars 内
    sentences = text.replace("！", "。").replace("？", "。").split("。")
    result = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(result) + len(s) + 2 <= max_chars:
            result += s + "。"
        else:
            break
    return result.strip("。") + "……"


def build_script(personality: dict) -> str:
    """生成配音脚本文本（用于剪映 AI 配音）"""
    code = personality["code"]
    name = personality["name"]
    overview = personality["overview"]
    strengths = personality["strengths"]
    growth = personality["growthAreas"]
    celebrities = personality["celebrities"]

    # 配音脚本（对应视频时间轴）
    overview_voice = _summarize_overview(overview, max_chars=200)
    strengths_voice = "；".join(s for s in strengths[:3])
    growth_voice = "；".join(g for g in growth[:3])
    celeb_names = "、".join(celebrities[:3])
    # 处理 population 字段，去除可能重复的"约"前缀
    pop = personality.get('population', '2.5%')
    if pop.startswith("约"):
        pop_display = pop
    else:
        pop_display = f"约{pop}"

    script = f"""{code}，{name}。

{overview_voice}

在人群中的占比{pop_display}。
代表人物包括{celeb_names}。

{name}的核心优势：{strengths_voice}。

成长方向：{growth_voice}。

想了解你是什么人格类型吗？来 MBTI-PRO 做一次真正精准的 81 型测试吧。"""

    return script


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else "ENFJ"
    print(f"🎬 生成 {code} 人格推广视频...")

    # 加载数据
    personality = load_personality(code)
    print(f"  ✅ 加载人格数据: {personality['code']} - {personality['name']}")

    # 构建主题和场景
    theme = build_theme(personality)
    cuts = build_cuts(personality)

    # 构建 composition_data
    composition_data = {
        "renderer_family": "explainer-data",
        "themeConfig": theme,
        "cuts": cuts,
        "playbook": "flat-motion-graphics",
        "metadata": {
            "project": "MBTI-PRO",
            "personality_code": code,
            "personality_name": personality["name"],
        },
    }

    # 输出路径
    output_dir = Path(__file__).resolve().parent.parent / "video" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{code}_animated.mp4"

    print(f"  🎨 主题色: {personality.get('_colorHex', '#319554')}")
    print(f"  🎬 场景数: {len(cuts)}")
    print(f"  ⏱️  总时长: {cuts[-1]['out_seconds']}s")
    print(f"  📦 输出: {output_path}")

    # 渲染
    composer = VideoCompose()
    result = composer.execute({
        "operation": "remotion_render",
        "composition_data": composition_data,
        "output_path": str(output_path),
        "profile": "tiktok",  # 1080x1920 竖屏
    })

    if result.success:
        file_size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"\n✅ 视频生成成功!")
        print(f"  📁 {output_path}")
        print(f"  📏 {file_size_mb:.1f} MB")
        print(f"  ⏱️  渲染耗时: {result.duration_seconds:.1f}s")

        # 生成配音脚本
        script_text = build_script(personality)
        script_path = output_dir / f"{code}_script.txt"
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script_text)
        print(f"  📝 配音脚本: {script_path}")
        print(f"\n🎤 剪映操作：")
        print(f"  1. 导入 {output_path.name} 到剪映")
        print(f"  2. 点击「文本」→「新建文本」→ 粘贴脚本内容")
        print(f"  3. 点击「朗读」→ 选择喜欢的音色 → 开始朗读")
        print(f"  4. 调整语速匹配画面节奏，导出发布！")
    else:
        print(f"\n❌ 渲染失败: {result.error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
