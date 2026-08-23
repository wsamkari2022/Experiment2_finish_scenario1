"""
optimize_scenario_images.py — turn the scenario artwork masters into web-ready assets.

    python tools/optimize_scenario_images.py            # convert anything new or changed
    python tools/optimize_scenario_images.py --force    # re-convert everything

WHAT IT DOES
Walks `scenarios_images/` and writes a WebP copy of every image into
`public/scenario-images/`, mirroring the folder structure exactly. Masters are never modified.

WHY IT EXISTS
The masters are ~1400 px wide and 2-3 MB each. They are displayed in a column roughly 300 px
wide, so they carry an order of magnitude more pixels and roughly 40x more bytes than the page
can use. At full size a single Block 1 context would be ~20 MB and every click would wait on a
download. Downscaled to 900 px (still 2x for a high-DPI screen) and encoded as WebP they come
out around 50 KB, which is small enough that the app preloads a whole context up front and the
picture swap between questions becomes instant.

ADDING ARTWORK FOR A NEW BLOCK
 1. Put the images in `scenarios_images/<BlockN_Something_scenario_images>/`.
 2. Run this script. It only converts what changed, so re-running is cheap.
 3. Register the new files in `src/experiment/scenarioImages.ts` — the paths there are the
    mirrored ones under `/scenario-images/...`, with a `.webp` extension.
"""
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.path.join(ROOT, "scenarios_images")
DST_ROOT = os.path.join(ROOT, "public", "scenario-images")

# 900 px is 2x the widest the artwork is ever displayed at, so it stays crisp on a high-DPI
# screen while being ~40x smaller than the master. Quality 82 is visually lossless for these
# flat-shaded illustrations.
TARGET_WIDTH = 900
QUALITY = 82
SOURCE_EXTENSIONS = (".png", ".jpg", ".jpeg")

force = "--force" in sys.argv


def long_path(path: str) -> str:
    """
    Return a path that is safe to open on Windows regardless of length.

    This project already sits ~150 characters deep, and the Block 3 artwork adds two more
    nested folders plus long descriptive filenames, which pushes some outputs past the classic
    260-character MAX_PATH limit — `open()` then fails with a bare "No such file or directory"
    even though the parent folder exists. Prefixing an absolute path with \?\ opts into the
    extended-length API and removes the limit. No-op on other platforms.
    """
    if os.name != "nt":
        return path
    abs_path = os.path.abspath(path)
    prefix = "\\\\?\\"  # literal \\?\
    return abs_path if abs_path.startswith(prefix) else prefix + abs_path


def web_safe(name: str) -> str:
    """
    Make one path segment safe to use in a URL.

    Master folders are named for humans and contain spaces and commas ("Block 3 images",
    "100,000_Entry_level"). Those survive in a URL only as percent-escapes, which is brittle and
    unreadable in the image map. The mirrored copy therefore uses a sanitised name: anything
    outside [A-Za-z0-9._-] becomes an underscore, and runs of underscores collapse.

    Names that are already safe — every Block 1 and Block 2 folder and file — pass through
    unchanged, so this does not churn assets that already exist.
    """
    return re.sub(r"_+", "_", re.sub(r"[^A-Za-z0-9._-]", "_", name)).strip("_")


def convert(src_path: str, dst_path: str) -> tuple[int, int, str, str]:
    """Downscale and re-encode one image. Returns (bytes_before, bytes_after, dims, dims)."""
    before = os.path.getsize(long_path(src_path))
    img = Image.open(long_path(src_path)).convert("RGB")
    w, h = img.size
    new_h = round(h * TARGET_WIDTH / w)
    img = img.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
    os.makedirs(long_path(os.path.dirname(dst_path)), exist_ok=True)
    img.save(long_path(dst_path), "WEBP", quality=QUALITY, method=6)
    return before, os.path.getsize(long_path(dst_path)), f"{w}x{h}", f"{TARGET_WIDTH}x{new_h}"


def main() -> None:
    if not os.path.isdir(SRC_ROOT):
        print(f"No masters directory at {SRC_ROOT}")
        return

    rows, skipped = [], 0
    total_before = total_after = 0

    for dirpath, _dirnames, filenames in os.walk(SRC_ROOT):
        for filename in sorted(filenames):
            if not filename.lower().endswith(SOURCE_EXTENSIONS):
                continue
            src_path = os.path.join(dirpath, filename)
            rel_dir = os.path.relpath(dirpath, SRC_ROOT)
            rel_dir = "" if rel_dir == "." else rel_dir
            safe_dir = os.path.join(*[web_safe(p) for p in rel_dir.split(os.sep)]) if rel_dir else ""
            dst_path = os.path.join(
                DST_ROOT, safe_dir, web_safe(os.path.splitext(filename)[0]) + ".webp"
            )

            # Incremental: leave alone anything already converted from an unchanged master.
            if (
                not force
                and os.path.exists(long_path(dst_path))
                and os.path.getmtime(long_path(dst_path)) >= os.path.getmtime(long_path(src_path))
            ):
                skipped += 1
                total_before += os.path.getsize(long_path(src_path))
                total_after += os.path.getsize(long_path(dst_path))
                continue

            before, after, dim_in, dim_out = convert(src_path, dst_path)
            total_before += before
            total_after += after
            rows.append(
                (
                    os.path.join(rel_dir, filename).replace("\\", "/"),
                    dim_in,
                    f"{before / 1024 / 1024:.2f} MB",
                    dim_out,
                    f"{after / 1024:.0f} KB",
                )
            )

    if rows:
        headers = ("source", "master", "bytes", "output", "bytes")
        widths = [
            max(len(str(r[i])) for r in [headers, *rows]) for i in range(len(headers))
        ]
        print()
        print("  " + "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)))
        print("  " + "  ".join("-" * widths[i] for i in range(len(headers))))
        for r in rows:
            print("  " + "  ".join(str(r[i]).ljust(widths[i]) for i in range(len(r))))

    print()
    print(f"  converted {len(rows)}, unchanged {skipped}")
    if total_after:
        print(
            f"  masters {total_before / 1024 / 1024:.1f} MB  ->  "
            f"web {total_after / 1024:.0f} KB   "
            f"({total_before / total_after:.0f}x smaller)"
        )
    print()


if __name__ == "__main__":
    main()
