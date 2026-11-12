import json
from pathlib import Path
root=Path(__file__).resolve().parent
s=json.loads((root/'simulation.json').read_text())['scenarios']
paths=[]
for key,style in [('beginner',''),('intermediate','stroke-dasharray="5 4"'),('change','stroke-dasharray="2 4"')]:
    points=' '.join(f'{32+i*28},{210-w["earned"]/w["budget"]*180:.1f}' for i,w in enumerate(s[key]))
    paths.append(f'<polyline points="{points}" fill="none" stroke="currentColor" stroke-width="2.5" {style}/>')
html='''<!doctype html><html><head><meta charset="utf-8"><style>
:root{color-scheme:light dark}body{margin:0;font-family:var(--font-sans,system-ui);color:var(--foreground,CanvasText)}h3{font-size:16px;margin:0 0 10px;font-weight:600}p{font-size:13px;line-height:1.5;margin:8px 0;color:var(--muted-foreground,GrayText)}svg{display:block;width:100%;height:240px}text{fill:currentColor;font-family:system-ui;font-size:11px}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px}.legend span{display:flex;align-items:center;gap:6px}.line{width:24px;border-top:2px solid currentColor}.dash{border-top-style:dashed}.dot{border-top-style:dotted}a{color:inherit}
</style></head><body><h3>16 weeks of saved evidence</h3><div class="legend"><span><i class="line"></i>Beginner, 3/week</span><span><i class="line dash"></i>Intermediate, 4/week, no tests</span><span><i class="line dot"></i>New program after week 8</span></div><svg viewBox="0 0 500 240" role="img" aria-label="Ring fill grows in all sixteen weeks for the three synthetic lifters. Adding two lifts at week eight changes the scale and keeps all 112 earned steps."><path d="M32 25V210H460" fill="none" stroke="currentColor" stroke-opacity=".3"/><text x="34" y="18">Full ring</text><text x="34" y="230">Week 1</text><text x="432" y="230">16</text><path d="M228 25V210" stroke="currentColor" stroke-opacity=".2" stroke-dasharray="3 4"/><text x="234" y="190">2 new lifts</text>'''+''.join(paths)+'''</svg><p>Synthetic design simulation, not an attendance target. The dotted line re-scales after week 8: 112 earned steps stay; the budget grows from 272 to 408. The plan contains the exact fractions and evidence rules.</p></body></html>'''
(root/'simulation-chart.html').write_text(html)
