"""Crops round-2 renders to the bands the landing shows, and records their sizes.

Each capture has a sidecar JSON with the rows to keep ([top, bottom] in CSS px
of a 430x932 screen). Form Studio tilts the device, so screen rows do not map
to render rows by a constant. For every render angle this script renders a
calibration screen (red lines at known heights) through the same scene, finds
the lines, and maps rows through them. Nothing is estimated by eye.

    python3 bands.py            # needs Pillow; renders calibration once
Env: R2_SRC, R2_RENDER, FORM_STUDIO.
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("R2_SRC", "/tmp/r2-src")
RENDER = os.environ.get("R2_RENDER", "/tmp/r2-render")
STUDIO = os.environ.get("FORM_STUDIO", "/home/ubuntu/projects/form-iphone-studio")
CFG = os.path.join(HERE, "../../../plan-054-landing-prototype/render/scene.json")
OUT = os.path.join(HERE, "../assets")
PAGE = os.path.join(HERE, "../index.html")
FRACS = [i / 20 for i in range(1, 20)]
WIDTH = 720  # 2x the widest display (360 CSS px)

# band name -> (source scene, render angle); must match render.sh
BANDS = {
    "focus-add": ("focus-add", (-4, 1, 0.5, 30)),
    "focus-hold": ("focus-hold", (4, 1, -0.5, 30)),
    "focus-reduce": ("focus-reduce", (-4, 1, 0.5, 30)),
    "exchart-six": ("exchart-six", (3, 1, 0, 30)),
    "paste-send": ("paste-send", (-3, 1, 0.5, 30)),
    "paste-review": ("paste-review", (3, 1, -0.5, 30)),
    "hub-own": ("hub-own", (-3, 1, 0.5, 30)),
}


def calibration(angle):
    ry, rx, rz, fov = angle
    name = "calib_%s_%s_%s_%s" % (ry, rx, rz, fov)
    out = os.path.join(RENDER, name + ".png")
    if not os.path.exists(out):
        src = os.path.join(RENDER, "calib-src.png")
        if not os.path.exists(src):
            im = Image.new("RGB", (1290, 2796), "white")
            d = ImageDraw.Draw(im)
            for f in FRACS:
                y = round(f * 2796)
                d.rectangle([0, y - 6, 1290, y + 6], fill=(255, 0, 0))
            im.save(src)
        cmd = ["node", os.path.join(STUDIO, "bin/form-studio.mjs"), "render", src, "--config", CFG, "--no-build",
               "--rotate-y", str(ry), "--rotate-x", str(rx), "--rotate-z", str(rz), "--fov", str(fov),
               "--fit", "fill", "--resolution", "2160", "--transparent", "--timeout", "300000", "-o", out]
        print("calibrating", name, flush=True)
        subprocess.run(cmd, cwd=STUDIO, check=True, stdout=subprocess.DEVNULL)
    im = Image.open(out).convert("RGBA")
    px = im.load()
    box = im.getbbox()
    cx = (box[0] + box[2]) // 2
    lines = []
    run = []
    for y in range(im.height):
        r, g, b, a = px[cx, y]
        red = a > 200 and r > 150 and g < 110 and b < 110
        if red:
            run.append(y)
        elif run:
            lines.append(sum(run) / len(run))
            run = []
    if len(lines) != len(FRACS):
        sys.exit("%s: found %d calibration lines, expected %d" % (name, len(lines), len(FRACS)))
    return list(zip(FRACS, lines))


def to_render(frac, table):
    """Piecewise-linear through the calibration lines, extended at both ends."""
    seg = next((i for i in range(len(table) - 1) if frac <= table[i + 1][0]), len(table) - 2)
    (f0, y0), (f1, y1) = table[seg], table[seg + 1]
    return y0 + (y1 - y0) * (frac - f0) / (f1 - f0)


def main():
    os.makedirs(OUT, exist_ok=True)
    sizes = {}
    tables = {}
    for band, (scene, angle) in BANDS.items():
        tables.setdefault(angle, calibration(angle))
        for lang in ("pt", "en"):
            box = None
            for theme in ("light", "dark"):
                # Both themes share one layout, so the light capture's rows and
                # crop box are applied to dark too; the <picture> sources match.
                tag = "%s-%s-%s" % (scene, lang, theme)
                im = Image.open(os.path.join(RENDER, "%s-%s-%s.png" % (band, lang, theme))).convert("RGBA")
                if box is None:
                    meta = json.load(open(os.path.join(SRC, tag + ".json")))
                    if not meta.get("rows"):
                        sys.exit(tag + ": no band rows (" + str(meta.get("bandError")) + ")")
                    top, bottom = meta["rows"]
                    vh = meta["viewport"][1]
                    y0 = round(to_render(top / vh, tables[angle]))
                    y1 = round(to_render(bottom / vh, tables[angle]))
                    bb = im.crop((0, y0, im.width, y1)).getbbox()
                    box = (max(0, bb[0] - 4), y0, min(im.width, bb[2] + 4), y1)
                strip = im.crop(box)
                h = round(strip.height * WIDTH / strip.width)
                strip = strip.resize((WIDTH, h), Image.LANCZOS)
                strip.save(os.path.join(OUT, "%s-%s-%s.webp" % (band, lang, theme)), "WEBP", quality=84, method=6)
                sizes.setdefault(band, {})[lang] = [WIDTH, h]
                print("band", tag, WIDTH, "x", h, flush=True)
    html = open(PAGE, encoding="utf8").read()
    line = "var ASSETS = " + json.dumps(sizes, separators=(",", ":")) + ";"
    html2 = re.sub(r"/\*@ASSETS\*/.*?/\*@end\*/", lambda m: "/*@ASSETS*/" + line + "/*@end*/", html, flags=re.S)
    open(PAGE, "w", encoding="utf8").write(html2)
    print("wrote ASSETS", json.dumps(sizes))


if __name__ == "__main__":
    main()
