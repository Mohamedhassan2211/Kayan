#!/usr/bin/env python3
"""
Kayan Plus - web image builder.

Turns the original high-resolution sources (A4 scans, photos, logo) into the
small, responsive WebP files that index.html actually loads.

    python tools/optimize-images.py

Requires Pillow 10+ (pip install pillow). Writes everything to assets/img/.

To add a new document to the "سجل الإنجازات" section:
  1. Put the scan anywhere in the repo.
  2. Add a line to WORK below (slug + source path).
  3. Run this script, then copy one of the existing <li class="doc"> blocks in
     index.html and point it at the new slug.
"""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

Image.MAX_IMAGE_PIXELS = None  # the scans are 2481x3508, well within reason

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"

NAVY = (8, 17, 31)
WHITE = (255, 255, 255)

LICENSES = "التأسيس والترخيص"

# slug -> source (relative to the repo root)
WORK = {
    "license-garments":    f"{LICENSES}/رخصه تشغيل مقله اشرف.jpg",
    "license-carpets":     f"{LICENSES}/رخصه تشغيل .png",
    "registry-carpets":    f"{LICENSES}/سجل صناعي .png",
    "license-metal-parts": f"{LICENSES}/ابراهيم طهرخصه تشغيل .jpg",
    "registry-spare-parts": f"{LICENSES}/سجل صناعي ابراهيم طه.jpg",
    "registry-detergents": f"{LICENSES}/سجل صناعي احمد هزاغ.jpg",
    "license-paper":       f"{LICENSES}/عادل فؤاد وشركاه.png",
    "license-plastics":    f"{LICENSES}/قباء للصناعه والتوريدات .jpg",
    "license-transformers": f"{LICENSES}/رخصه تشغيل دائمه.png",
    "permit-building":     "رخص البناء والتصميم/Picture1.jpg",
}

THUMB_WIDTHS = (320, 560)  # document cards
FULL_WIDTH = 1240          # lightbox view (half the A4 scan resolution)
A4 = 2 ** 0.5              # portrait card ratio (height / width)

# Landscape documents get a portrait (A4) crop for their card thumbnail so
# they fill the card like the others; the lightbox still shows the whole page.
# Value = which side of the page to keep (Arabic documents start on the right).
LANDSCAPE_THUMB_ANCHOR = {"permit-building": "right"}


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def source(rel: str) -> Path:
    """Resolve a source path, tolerating NFC/NFD differences in Arabic names."""
    path = ROOT / rel
    if path.exists():
        return path
    parent = ROOT
    for part in Path(rel).parts:
        match = next((p for p in parent.iterdir() if nfc(p.name) == nfc(part)), None)
        if match is None:
            raise FileNotFoundError(rel)
        parent = match
    return parent


def flatten(img: Image.Image, bg=WHITE) -> Image.Image:
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        base = Image.new("RGB", img.size, bg)
        base.paste(img, mask=img.getchannel("A"))
        return base
    return img.convert("RGB")


def resize_w(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img.copy()
    height = round(img.height * width / img.width)
    return img.resize((width, height), Image.LANCZOS)


written: list[Path] = []


def save(img: Image.Image, rel: str, **opts) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".webp":
        opts = {"quality": 80, "method": 6, **opts}
    elif path.suffix == ".jpg":
        opts = {"quality": 82, "optimize": True, "progressive": True, **opts}
    elif path.suffix == ".png":
        opts = {"optimize": True, **opts}
    img.save(path, **opts)
    written.append(path)


# --------------------------------------------------------------------------- brand

def build_brand() -> None:
    logo = Image.open(source("mainlogo.png")).convert("RGBA")

    # The emblem (gold calligraphy + cap + gear) without the "KAYAN" wordmark.
    # The navy "K" key ornament pokes into the emblem box at the lower left,
    # so clear every non-gold pixel in that corner first.
    px = logo.load()
    for y in range(580, 700):
        for x in range(200, 340):
            r, g, b, a = px[x, y]
            if a and not (r > 170 and g > 140 and b < 140):
                px[x, y] = (0, 0, 0, 0)
    mark = logo.crop((282, 26, 766, 676))
    mark = mark.crop(mark.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())

    # Nav / footer mark: 128px tall covers a 44px slot up to 3x DPR.
    m = mark.copy()
    m.thumbnail((256, 128), Image.LANCZOS)
    save(m, "brand/kayan-mark.webp", quality=82)

    def square(img: Image.Image, size: int, pad: float, bg=None) -> Image.Image:
        canvas = Image.new("RGBA", (size, size), (*bg, 255) if bg else (0, 0, 0, 0))
        inner = img.copy()
        inner.thumbnail((round(size * (1 - pad)), round(size * (1 - pad))), Image.LANCZOS)
        canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
        return canvas

    save(square(mark, 32, 0.04), "brand/favicon-32.png")
    save(square(mark, 192, 0.10), "brand/favicon-192.png")
    save(square(mark, 180, 0.22, NAVY).convert("RGB"), "brand/apple-touch-icon.png")

    # Full logo for structured data (Google wants >=112px, crawlers only).
    full = Image.open(source("mainlogo.png")).convert("RGBA")
    full = full.crop(full.getchannel("A").getbbox())
    full.thumbnail((512, 512), Image.LANCZOS)
    save(full.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE), "brand/logo-512.png")


# --------------------------------------------------------------------------- photos

def build_photos() -> None:
    # Founder portrait: 3:4 crop for the arched frame, studio white warmed to
    # ivory so it sits on the page like paper instead of a bright hole.
    founder = flatten(Image.open(source("founder.jpg")))
    w = founder.width
    founder = founder.crop((0, 0, w, round(w * 4 / 3)))
    founder = ImageChops.multiply(founder, Image.new("RGB", founder.size, (246, 240, 228)))
    for width in (480, 600, 760):
        save(resize_w(founder, width), f"founder-{width}.webp", quality=78)
    # Round 48px avatar in the "وعدنا لك" card (96px for 2x screens): the top square.
    save(resize_w(founder.crop((0, 0, w, w)), 96), "founder-96.webp", quality=78)

    fire = flatten(Image.open(source("انظمه الحريق/1.png")))
    for width in (480, 760, fire.width):
        save(resize_w(fire, width), f"fire-systems-{width}.webp", quality=70)

    # Social share card (WhatsApp / Facebook preview), 1200x628 (1.91:1).
    # Crop above the poster's bottom strip so no line of text is cut in half.
    poster = flatten(Image.open(source("ChatGPT Image Aug 4, 2026, 04_43_42 PM.png")))
    poster = resize_w(poster, 1200).crop((0, 0, 1146, 600)).resize((1200, 628), Image.LANCZOS)
    save(poster, "og-image.jpg", quality=84)


# --------------------------------------------------------------------------- documents

def build_work() -> None:
    for slug, rel in WORK.items():
        doc = resize_w(flatten(Image.open(source(rel))), FULL_WIDTH)
        # Scanner grain on the security paper is what makes these files heavy.
        # A light blur removes it (-65% bytes) while the text stays crisp.
        doc = doc.filter(ImageFilter.GaussianBlur(0.8 * doc.width / FULL_WIDTH))
        save(doc, f"work/{slug}-full.webp", quality=70)
        card = doc
        if slug in LANDSCAPE_THUMB_ANCHOR:
            crop_w = round(doc.height / A4)
            left = doc.width - crop_w if LANDSCAPE_THUMB_ANCHOR[slug] == "right" else 0
            card = doc.crop((left, 0, left + crop_w, doc.height))
        for width in THUMB_WIDTHS:
            thumb = resize_w(card, width).filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2))
            save(thumb, f"work/{slug}-{width}.webp", quality=70)


def main() -> int:
    build_brand()
    build_photos()
    build_work()
    total = 0
    for path in written:
        size = path.stat().st_size
        total += size
        with Image.open(path) as im:
            dims = f"{im.width}x{im.height}"
        print(f"{size / 1024:8.1f} KB  {dims:>10}  {path.relative_to(ROOT).as_posix()}")
    print(f"{total / 1024:8.1f} KB  total ({len(written)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
