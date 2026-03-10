from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path("public/branding")
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 1024
PADDING = 96
RADIUS = 220


def gradient_bg(size, top_color, bottom_color):
    img = Image.new("RGB", (size, size), top_color)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top_color[0] * (1 - t) + bottom_color[0] * t)
        g = int(top_color[1] * (1 - t) + bottom_color[1] * t)
        b = int(top_color[2] * (1 - t) + bottom_color[2] * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def rounded_tile(bg):
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=RADIUS, fill=255)
    rgba = bg.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def save_sizes(img, stem):
    for size in (1024, 512, 256):
        scaled = img.resize((size, size), Image.Resampling.LANCZOS)
        scaled.save(OUT / f"{stem}-{size}.png")
    img.save(OUT / f"{stem}.png")


def configurate_icon():
    bg = gradient_bg(SIZE, (16, 58, 145), (54, 134, 255))
    tile = rounded_tile(bg)

    draw = ImageDraw.Draw(tile)

    # subtle glow
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((220, 220, 804, 804), fill=(255, 255, 255, 28))
    glow = glow.filter(ImageFilter.GaussianBlur(38))
    tile.alpha_composite(glow)

    # stylized C (configuration ring)
    ring_bounds = (238, 238, 786, 786)
    draw.arc(ring_bounds, start=35, end=325, fill=(255, 255, 255, 255), width=90)

    # node markers
    draw.rounded_rectangle((640, 264, 742, 366), radius=26, fill=(255, 255, 255, 255))
    draw.rounded_rectangle((640, 658, 742, 760), radius=26, fill=(255, 255, 255, 255))

    save_sizes(tile, "configurate-icon")


def control_icon():
    bg = gradient_bg(SIZE, (26, 28, 33), (58, 62, 72))
    tile = rounded_tile(bg)

    draw = ImageDraw.Draw(tile)

    # subtle highlight
    highlight = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.ellipse((180, 120, 850, 760), fill=(255, 255, 255, 24))
    highlight = highlight.filter(ImageFilter.GaussianBlur(50))
    tile.alpha_composite(highlight)

    # control sliders
    x_positions = [330, 512, 694]
    knob_positions = [390, 540, 430]

    for x, y in zip(x_positions, knob_positions):
        draw.rounded_rectangle((x - 24, 250, x + 24, 774), radius=24, fill=(255, 255, 255, 210))
        draw.rounded_rectangle((x - 82, y - 52, x + 82, y + 52), radius=44, fill=(255, 255, 255, 255))

    # small accent pulse
    draw.rounded_rectangle((278, 794, 746, 850), radius=28, fill=(104, 180, 255, 235))

    save_sizes(tile, "control-icon")


if __name__ == "__main__":
    configurate_icon()
    control_icon()
    print("Generated icons in", OUT)
