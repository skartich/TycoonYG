from pathlib import Path
import sys
from collections import deque

import numpy as np
from PIL import Image


SHELF_NAMES = [
    "groceries",
    "dairy",
    "snacks",
    "drinks",
    "bakery",
    "frozen",
    "produce",
    "canned",
    "ready-food",
    "meat",
    "seafood",
    "household",
    "hygiene",
    "pets",
    "kitchen",
    "textile",
    "toys",
    "electronics",
]

SHELF_BOXES = [
    (55, 45, 375, 305), (380, 45, 575, 305), (580, 45, 835, 305),
    (850, 45, 1095, 305), (1100, 45, 1350, 305), (1360, 45, 1615, 305),
    (45, 300, 310, 550), (315, 300, 565, 550), (570, 300, 830, 550),
    (835, 300, 1095, 550), (1100, 300, 1350, 550), (1360, 300, 1615, 550),
    (45, 535, 310, 790), (315, 535, 565, 790), (570, 535, 830, 790),
    (835, 535, 1095, 790), (1100, 535, 1350, 790), (1360, 535, 1615, 790),
]

PROP_BOXES = {
    "checkout": (55, 40, 260, 270),
    "queue-rope": (295, 75, 480, 245),
    "entrance-bollard": (515, 75, 585, 250),
    "entrance": (600, 65, 965, 270),
    "topiary": (965, 65, 1110, 270),
    "entrance-bench": (1120, 90, 1270, 245),
    "trash-bin": (1300, 85, 1400, 245),
    "plant": (1510, 75, 1625, 250),
    "promo-drinks": (50, 290, 260, 535),
    "promo-snacks": (275, 290, 460, 535),
    "promo-household": (470, 290, 700, 535),
    "promo-electronics": (720, 290, 940, 535),
    "floor-tile": (960, 300, 1170, 525),
}


def remove_magenta(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    values = rgb.astype(np.int16)
    red = values[..., 0]
    green = values[..., 1]
    blue = values[..., 2]
    minimum_magenta = np.minimum(red, blue)
    maximum_magenta = np.maximum(red, blue)
    magenta = (
        (minimum_magenta >= 18)
        & (green + 10 < minimum_magenta * 0.55)
        & (np.abs(red - blue) < np.maximum(22, maximum_magenta * 0.22))
    )

    height, width = magenta.shape
    outside = np.zeros_like(magenta)
    queue = deque()
    for x in range(width):
        if magenta[0, x]: queue.append((0, x))
        if magenta[height - 1, x]: queue.append((height - 1, x))
    for y in range(height):
        if magenta[y, 0]: queue.append((y, 0))
        if magenta[y, width - 1]: queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if outside[y, x] or not magenta[y, x]:
            continue
        outside[y, x] = True
        if y > 0: queue.append((y - 1, x))
        if y + 1 < height: queue.append((y + 1, x))
        if x > 0: queue.append((y, x - 1))
        if x + 1 < width: queue.append((y, x + 1))

    # Catch the last chroma-contaminated edge pixels touching the removed backdrop.
    spill = (green + 8 < minimum_magenta * 0.72) & (np.abs(red - blue) < 48)
    for _ in range(2):
        adjacent = (
            np.roll(outside, 1, axis=0)
            | np.roll(outside, -1, axis=0)
            | np.roll(outside, 1, axis=1)
            | np.roll(outside, -1, axis=1)
        )
        outside |= adjacent & spill

    rgba = np.dstack([rgb, np.where(outside, 0, 255).astype(np.uint8)])
    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getchannel("A").point(lambda value: 255 if value > 6 else 0).getbbox()
    if not bounds:
        raise ValueError("Asset crop contains no visible pixels")
    left, top, right, bottom = bounds
    padding = 2
    return result.crop((
        max(0, left - padding),
        max(0, top - padding),
        min(result.width, right + padding),
        min(result.height, bottom + padding),
    ))


def export_assets(sheet_path: Path, boxes, output_dir: Path, prefix: str = "") -> None:
    sheet = Image.open(sheet_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, box in boxes:
        asset = remove_magenta(sheet.crop(box))
        asset.save(output_dir / f"{prefix}{name}.png", optimize=True)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: extract_hypermarket_assets.py SHELVES_SHEET PROPS_SHEET OUTPUT_DIR")

    shelves_sheet = Path(sys.argv[1])
    props_sheet = Path(sys.argv[2])
    output_root = Path(sys.argv[3])
    export_assets(
        shelves_sheet,
        zip(SHELF_NAMES, SHELF_BOXES),
        output_root / "shelves",
        "shelf-",
    )
    export_assets(
        props_sheet,
        PROP_BOXES.items(),
        output_root / "props",
    )


if __name__ == "__main__":
    main()
