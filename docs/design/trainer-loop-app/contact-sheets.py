"""Lay the unmodified captures of each state into one labelled review sheet (WebP).

Columns: EN light, EN dark, PT light, PT dark. Rows: 390 normal text, 390 at 200%, 320 normal, 320 at 200%.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

cells = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
heading = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24)
paper, ink = '#F4F2EF', '#1B1A17'  # sheet framing only; the frames keep the app's own colours
cols = [('en', 'light'), ('en', 'dark'), ('pt', 'light'), ('pt', 'dark')]
rows = [(390, 'normal', 844), (390, 'text200', 844), (320, 'normal', 568), (320, 'text200', 568)]
cw, gap, top, label = 390, 18, 70, 24
by_state = {}
for cell in cells:
    by_state.setdefault(cell['state'], []).append(cell)
for state, group in by_state.items():
    height = top + sum(h + label + gap for _, _, h in rows)
    sheet = Image.new('RGB', (gap + len(cols) * (cw + gap), height), paper)
    draw = ImageDraw.Draw(sheet)
    first = group[0]
    draw.text((gap, 14), f"Slice {first['slice']} · {first['title']}", fill=ink, font=heading)
    draw.text((gap, 44), 'Candidate for owner approval · mock data · columns EN light, EN dark, PT light, PT dark', fill=ink, font=font)
    y = top
    for width, text, h in rows:
        for c, (lang, theme) in enumerate(cols):
            x = gap + c * (cw + gap)
            match = next((m for m in group if m['width'] == width and m['text'] == text and m['lang'] == lang and m['theme'] == theme), None)
            draw.text((x, y + 2), f"{width} · {lang.upper()} {theme} · {'200% text' if text == 'text200' else 'normal text'}", fill=ink, font=font)
            if match:
                with Image.open(match['file']) as image:
                    sheet.paste(image.convert('RGB'), (x, y + label))
        y += h + label + gap
    sheet.save(out / f'{state}.webp', quality=82, method=6)
    print(out / f'{state}.webp')
