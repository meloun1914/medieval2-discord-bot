#!/usr/bin/env python3
"""
Medieval II style world map generator (Pillow).
Reads JSON state from stdin, writes PNG to the path given as argv[1].
"""

import json
import sys
from PIL import Image, ImageDraw, ImageFont

# Simplified Europe + Near East regions (x, y center on 900x600 canvas)
REGIONS = {
    "london":       {"name": "London",        "xy": (180, 160), "r": 28},
    "paris":        {"name": "Paris",         "xy": (240, 200), "r": 30},
    "cologne":      {"name": "Cologne",       "xy": (310, 170), "r": 26},
    "milan":        {"name": "Milan",         "xy": (340, 250), "r": 24},
    "venice":       {"name": "Venice",        "xy": (380, 240), "r": 22},
    "rome":         {"name": "Rome",          "xy": (370, 300), "r": 26},
    "vienna":       {"name": "Vienna",        "xy": (420, 200), "r": 24},
    "krakow":       {"name": "Krakow",        "xy": (480, 180), "r": 24},
    "budapest":     {"name": "Budapest",      "xy": (460, 230), "r": 22},
    "constantinople": {"name": "Constantinople", "xy": (560, 280), "r": 32},
    "novgorod":     {"name": "Novgorod",      "xy": (560, 100), "r": 28},
    "kiev":         {"name": "Kiev",          "xy": (540, 170), "r": 26},
    "cordoba":      {"name": "Cordoba",       "xy": (150, 320), "r": 28},
    "cairo":        {"name": "Cairo",         "xy": (540, 380), "r": 30},
    "jerusalem":    {"name": "Jerusalem",     "xy": (580, 340), "r": 24},
    "tunis":        {"name": "Tunis",         "xy": (300, 360), "r": 22},
}

# Faction starting region + expansion order hints
FACTION_HOME = {
    "england": "london",
    "france": "paris",
    "hre": "cologne",
    "venice": "venice",
    "byzantium": "constantinople",
    "russia": "novgorod",
    "moors": "cordoba",
    "egypt": "cairo",
}

FACTION_COLORS = {
    "england": (200, 16, 46),
    "france": (0, 85, 164),
    "hre": (40, 40, 40),
    "venice": (206, 17, 38),
    "byzantium": (155, 35, 53),
    "russia": (213, 43, 30),
    "moors": (0, 98, 51),
    "egypt": (192, 147, 0),
    "rebel": (120, 120, 100),
}


def load_font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_map(state, out_path):
    """state = { regions: {region_id: faction_key|null}, highlight: user_id optional }"""
    W, H = 900, 600
    img = Image.new("RGB", (W, H), (34, 48, 64))  # sea-ish dark blue
    draw = ImageDraw.Draw(img)

    # Land mass rough blob
    draw.ellipse([40, 40, 860, 520], fill=(70, 95, 60))
    draw.ellipse([100, 280, 400, 560], fill=(34, 48, 64))  # mediterranean cut
    draw.ellipse([480, 300, 700, 560], fill=(34, 48, 64))

    # Soft grid
    for x in range(0, W, 50):
        draw.line([(x, 0), (x, H)], fill=(50, 65, 80), width=1)
    for y in range(0, H, 50):
        draw.line([(0, y), (W, y)], fill=(50, 65, 80), width=1)

    font = load_font(12)
    font_title = load_font(22)
    font_small = load_font(11)

    region_owners = state.get("regions", {})

    for rid, info in REGIONS.items():
        owner = region_owners.get(rid)
        color = FACTION_COLORS.get(owner, FACTION_COLORS["rebel"]) if owner else (90, 110, 80)
        x, y = info["xy"]
        r = info["r"]

        # Shadow
        draw.ellipse([x - r + 3, y - r + 3, x + r + 3, y + r + 3], fill=(20, 25, 30))
        # Region circle
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=(255, 255, 255), width=2)
        # Label
        name = info["name"]
        bbox = draw.textbbox((0, 0), name, font=font_small)
        tw = bbox[2] - bbox[0]
        draw.text((x - tw // 2, y + r + 4), name, fill=(230, 230, 220), font=font_small)

    # Title
    draw.rectangle([0, 0, W, 36], fill=(25, 30, 40))
    draw.text((16, 6), "Medieval II — World Map", fill=(220, 200, 140), font=font_title)

    # Legend
    legend_y = H - 70
    draw.rectangle([10, legend_y - 10, 280, H - 10], fill=(25, 30, 40, 200))
    draw.text((18, legend_y), "Legend (faction colors)", fill=(200, 200, 180), font=font)
    lx, ly = 18, legend_y + 22
    for i, (fk, col) in enumerate(FACTION_COLORS.items()):
        if fk == "rebel":
            continue
        draw.ellipse([lx, ly, lx + 12, ly + 12], fill=col)
        draw.text((lx + 16, ly - 1), fk.capitalize(), fill=(210, 210, 200), font=font_small)
        lx += 90
        if lx > 250:
            lx = 18
            ly += 16

    # Footer
    turn = state.get("turn", "?")
    player_name = state.get("player_label", "")
    draw.text((W - 280, 10), f"Turn {turn}  |  {player_name}", fill=(180, 180, 160), font=font)

    img.save(out_path, "PNG")
    print(out_path)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: generate_map.py <output.png>", file=sys.stderr)
        sys.exit(1)
    raw = sys.stdin.read()
    state = json.loads(raw) if raw.strip() else {"regions": {}}
    draw_map(state, sys.argv[1])
