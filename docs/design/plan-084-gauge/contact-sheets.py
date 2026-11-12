"""Lay unmodified 390 × 844 browser captures into labelled review sheets."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

cells = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
heading = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 28)
# Contact-sheet framing only. The captures retain the app's actual token colours.
paper, ink = '#F4F2EF', '#1B1A17'
names = {'A': 'Evidence ring', 'B': 'Coverage rail', 'C': 'History in use'}
for variant, name in names.items():
    selected = [cell for cell in cells if cell['variant'] == variant]
    sheet = Image.new('RGB', (2452, 3648), paper)
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 12), f'{variant} / {name} / Plan 084', fill=ink, font=heading)
    draw.text((16, 49), 'Synthetic evidence · 390 × 844 per frame · PT light / PT dark / EN light / EN dark', fill=ink, font=font)
    for i, cell in enumerate(selected):
        x, y = 16 + (i % 6) * 406, 86 + (i // 6) * 888
        draw.text((x, y), f"{cell['lang'].upper()} {cell['theme']} · {cell['label']}", fill=ink, font=font)
        with Image.open(cell['file']) as image:
            sheet.paste(image.convert('RGB'), (x, y + 28))
    sheet.save(out / f'contact-{variant.lower()}.png', optimize=True)
    print(out / f'contact-{variant.lower()}.png')
