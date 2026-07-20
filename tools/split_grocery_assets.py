from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ASSETS = {
    "shelf-grocery.png": (74, 74, 299, 289),
    "shelf-dairy.png": (352, 73, 587, 291),
    "shelf-snacks.png": (635, 74, 860, 291),
    "shelf-drinks.png": (907, 73, 1138, 291),
    "shelf-bakery.png": (1190, 73, 1408, 292),
    "shelf-frozen.png": (73, 366, 301, 570),
    "shelf-produce.png": (360, 355, 579, 572),
    "shelf-canned.png": (635, 355, 861, 573),
    "shelf-ready-food.png": (906, 355, 1136, 574),
    "self-checkout.png": (74, 588, 248, 781),
    "entrance-mat.png": (326, 588, 739, 753),
    "topiary.png": (790, 596, 883, 734),
    "entrance-bollard.png": (928, 603, 981, 731),
    "trash-bin.png": (1035, 610, 1118, 726),
    "customer-robot.png": (1163, 619, 1271, 733),
    "plant.png": (1293, 591, 1397, 728),
    "floor-tile.png": (94, 790, 243, 934),
    "aisle-horizontal.png": (359, 817, 705, 899),
    "aisle-vertical.png": (768, 770, 850, 929),
    "aisle-corner.png": (894, 776, 1068, 932),
    "aisle-t.png": (1118, 783, 1388, 934),
}


def connected_background(rgb: np.ndarray) -> np.ndarray:
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    magenta = (
        (red > 125)
        & (blue > 125)
        & (green < 150)
        & (np.abs(red - blue) < 105)
        & ((np.minimum(red, blue) - green) > 45)
    )

    height, width = magenta.shape
    background = np.zeros_like(magenta)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if magenta[0, x]:
            queue.append((0, x))
        if magenta[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if magenta[y, 0]:
            queue.append((y, 0))
        if magenta[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if background[y, x] or not magenta[y, x]:
            continue
        background[y, x] = True
        if y > 0:
            queue.append((y - 1, x))
        if y + 1 < height:
            queue.append((y + 1, x))
        if x > 0:
            queue.append((y, x - 1))
        if x + 1 < width:
            queue.append((y, x + 1))
    return background


def remove_magenta(crop: Image.Image) -> Image.Image:
    rgba = np.asarray(crop.convert("RGBA")).copy()
    background = connected_background(rgba[:, :, :3])
    alpha = np.where(background, 0, 255).astype(np.uint8)

    # Feather only the two-pixel boundary around the keyed background.
    background_image = Image.fromarray((background * 255).astype(np.uint8), "L")
    near_background = np.asarray(background_image.filter(ImageFilter.MaxFilter(5))) > 0
    red = rgba[:, :, 0].astype(np.int16)
    green = rgba[:, :, 1].astype(np.int16)
    blue = rgba[:, :, 2].astype(np.int16)
    magenta_strength = np.clip((np.minimum(red, blue) - green - 20) / 95, 0, 1)
    balance = np.clip(1 - np.abs(red - blue) / 115, 0, 1)
    brightness = np.clip((np.minimum(red, blue) - 90) / 115, 0, 1)
    similarity = magenta_strength * balance * brightness
    feather = np.clip(255 * (1 - similarity), 0, 255).astype(np.uint8)
    alpha = np.where(near_background & ~background, np.minimum(alpha, feather), alpha)

    rgba[:, :, 3] = alpha
    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


def main() -> None:
    parser = argparse.ArgumentParser(description="Split the grocery asset sheet into transparent PNG files.")
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    sheet = Image.open(args.source).convert("RGB")
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, bounds in ASSETS.items():
        asset = remove_magenta(sheet.crop(bounds))
        asset.save(args.output / filename, optimize=True)
        print(f"{filename}: {asset.width}x{asset.height}")


if __name__ == "__main__":
    main()
