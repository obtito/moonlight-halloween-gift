"""Bake original, seamless pumpkin skin maps. Requires NumPy and Pillow.

The checked-in PNGs are runtime assets; this script is optional for rebuilding
them. No remote images or third-party texture assets are used.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public' / 'textures' / 'pumpkin'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1024, 512
u, v = np.meshgrid(np.arange(W) / W, np.arange(H) / H)


def noise(gx, gy, seed):
    """Smooth tileable lattice noise, sampled directly at texture resolution."""
    grid = np.random.default_rng(seed).random((gy, gx))
    x, y = u * gx, v * gy
    ix, iy = x.astype(int), y.astype(int)
    sx, sy = x - ix, y - iy
    sx, sy = sx * sx * (3 - 2 * sx), sy * sy * (3 - 2 * sy)
    a = grid[iy % gy, ix % gx]
    b = grid[iy % gy, (ix + 1) % gx]
    c = grid[(iy + 1) % gy, ix % gx]
    d = grid[(iy + 1) % gy, (ix + 1) % gx]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


large = noise(13, 9, 1412) - .5
patch = noise(35, 27, 54) - .5
streak = noise(153, 8, 17) - .5
grain = noise(420, 240, 31) - .5
fine = noise(683, 379, 82) - .5
vein = np.sin(u * np.pi * 2 * 210 + noise(18, 17, 94) * 4)
# SphereGeometry's ribs are periodic every eighth turn; keep map seams aligned.
groove = (.5 - .5 * np.cos(u * np.pi * 16)) ** 12
groove *= .82 + noise(24, 13, 57) * .25
speckle = np.maximum(0, noise(280, 170, 44) - .69) * 3
faint_flecks = np.maximum(0, noise(540, 360, 72) - .78) * 2
caps = np.exp(-(v / .048) ** 2) + .65 * np.exp(-((1 - v) / .045) ** 2)


def save(name, values):
    pixels = np.clip(values, 0, 255).astype(np.uint8)
    Image.fromarray(pixels).save(OUT / name, optimize=True)


for variant in range(2):
    variation = noise(17, 11, 104 + variant) - .5
    shade = large * 45 + patch * 18 + variation * 25 + streak * 18
    red = 207 + shade + grain * 7 + fine * 4 - groove * 34 - speckle * 15 + faint_flecks * 16 - caps * 21
    green = 111 + shade * .71 + vein * 1.1 + grain * 6 - groove * 22 - speckle * 14 + faint_flecks * 14 - caps * 5
    blue = 31 + shade * .24 + grain * 2 - groove * 6 - speckle * 4 + faint_flecks * 9 + caps * 4
    save(f'skin-color-{variant}.png', np.dstack([red, green, blue]))

height = .52 + grain * .18 + fine * .095 + streak * .055 + patch * .025 - groove * .19 - speckle * .06
save('skin-height.png', height * 255)
roughness = .79 + large * .12 + patch * .08 + grain * .08 + groove * .065 + caps * .04
save('skin-roughness.png', roughness * 255)

# Long woody fibers for the curved stem. TubeGeometry u follows its length.
fiber = np.sin(v * np.pi * 2 * 23 + noise(11, 19, 65) * 2) * .5 + .5
stem_shade = fiber * 19 + noise(8, 53, 79) * 20 + grain * 9
stem_rgb = np.dstack([58 + stem_shade * .83, 51 + stem_shade * .8, 30 + stem_shade * .43])
stem = Image.fromarray(np.clip(stem_rgb, 0, 255).astype(np.uint8)).resize((512, 128), Image.Resampling.LANCZOS)
stem.save(OUT / 'stem-color.png', optimize=True)
stem_height = Image.fromarray(np.clip((fiber * .5 + grain * .12) * 255, 0, 255).astype(np.uint8)).resize((512, 128), Image.Resampling.LANCZOS)
stem_height.save(OUT / 'stem-height.png', optimize=True)
print(f'Baked {len(list(OUT.glob("*.png")))} original texture maps.')
