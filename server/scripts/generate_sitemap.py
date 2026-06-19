# -*- coding: utf-8 -*-
"""Generate sitemap.xml for all 81 MBTI-PRO personality type pages"""
import sys
from pathlib import Path
from datetime import datetime

# Add server/src to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Generate all 81 type codes
EI = ["E", "A", "I"]
SN = ["N", "B", "S"]
TF = ["T", "C", "F"]
PJ = ["J", "D", "P"]

all_types = [f"{e}{s}{t}{p}" for e in EI for s in SN for t in TF for p in PJ]

BASE_URL = "https://mbti-pro.example.com"

today = datetime.now().strftime("%Y-%m-%d")

xml = ['<?xml version="1.0" encoding="UTF-8"?>']
xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

# Home page (top priority)
xml.append("  <url>")
xml.append(f"    <loc>{BASE_URL}/</loc>")
xml.append(f"    <lastmod>{today}</lastmod>")
xml.append("    <changefreq>weekly</changefreq>")
xml.append("    <priority>1.0</priority>")
xml.append("  </url>")

# Test page
xml.append("  <url>")
xml.append(f"    <loc>{BASE_URL}/test</loc>")
xml.append(f"    <lastmod>{today}</lastmod>")
xml.append("    <changefreq>monthly</changefreq>")
xml.append("    <priority>0.8</priority>")
xml.append("  </url>")

# 81 type detail pages
for code in sorted(all_types):
    is_traditional = not any(c in code for c in ["A", "B", "C", "D"])
    priority = "0.9" if is_traditional else "0.7"
    xml.append("  <url>")
    xml.append(f"    <loc>{BASE_URL}/result/{code}</loc>")
    xml.append(f"    <lastmod>{today}</lastmod>")
    xml.append("    <changefreq>monthly</changefreq>")
    xml.append(f"    <priority>{priority}</priority>")
    xml.append("  </url>")

xml.append("</urlset>")

out_path = Path(__file__).resolve().parent.parent.parent / "client" / "public" / "sitemap.xml"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text("\n".join(xml) + "\n", encoding="utf-8")

print(f"Generated sitemap.xml with {len(all_types) + 2} URLs")
print(f"Output: {out_path}")
