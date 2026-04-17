"""Generate PWA icons for the accounting site.

Re-run with: python icons/generate_icons.py
Outputs (in icons/):
  - icon-192.png, icon-512.png      (standard PWA icons, transparent rounded square)
  - icon-maskable-512.png           (full-bleed, safe-zone aware)
  - apple-touch-icon.png (180x180)  (iOS home-screen icon)
  - favicon-32.png, favicon-16.png  (browser tabs)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).parent

# Brand palette (matches styles.css --primary)
BG_TOP = (37, 99, 235)      # #2563eb
BG_BOTTOM = (29, 78, 216)   # #1d4ed8
FG = (255, 255, 255)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = round(top[0] * (1 - t) + bottom[0] * t)
        g = round(top[1] * (1 - t) + bottom[1] * t)
        b = round(top[2] * (1 - t) + bottom[2] * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def load_bold_font(px):
    # Try common bold fonts; fall back to PIL default
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/seguisb.ttf",   # Segoe UI Semibold
        "C:/Windows/Fonts/segoeuib.ttf",  # Segoe UI Bold
        "arialbd.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, px)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_dollar(canvas, glyph_size_ratio=0.62, offset_y_ratio=-0.02):
    """Draw a centered, bold '$' onto canvas (RGBA)."""
    w, h = canvas.size
    glyph_px = int(min(w, h) * glyph_size_ratio)
    font = load_bold_font(glyph_px)
    text = "$"
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (w - text_w) / 2 - bbox[0]
    y = (h - text_h) / 2 - bbox[1] + h * offset_y_ratio
    # Subtle drop shadow for depth
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    shadow_offset = max(1, int(min(w, h) * 0.012))
    sd.text((x + shadow_offset, y + shadow_offset), text, fill=(15, 23, 42, 70), font=font)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=max(1, min(w, h) * 0.01)))
    canvas.alpha_composite(shadow_layer)
    ImageDraw.Draw(canvas).text((x, y), text, fill=FG, font=font)


def make_rounded_icon(size):
    """Standard icon: gradient rounded square + '$'. Transparent corners."""
    bg = vertical_gradient(size, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = rounded_mask(size, radius=int(size * 0.22))
    rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rounded.paste(bg, (0, 0), mask)
    draw_dollar(rounded, glyph_size_ratio=0.62)
    return rounded


def make_maskable_icon(size):
    """Maskable: full bleed background, glyph kept inside ~80% safe zone."""
    bg = vertical_gradient(size, BG_TOP, BG_BOTTOM).convert("RGBA")
    # Smaller glyph so it survives circular/squircle masks
    draw_dollar(bg, glyph_size_ratio=0.46)
    return bg


def main():
    OUT.mkdir(exist_ok=True)
    targets = [
        ("icon-192.png", make_rounded_icon(192)),
        ("icon-512.png", make_rounded_icon(512)),
        ("icon-maskable-512.png", make_maskable_icon(512)),
        ("apple-touch-icon.png", make_rounded_icon(180)),
        ("favicon-32.png", make_rounded_icon(32)),
        ("favicon-16.png", make_rounded_icon(16)),
    ]
    for name, img in targets:
        path = OUT / name
        img.save(path, "PNG", optimize=True)
        print(f"  wrote {path.name} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
