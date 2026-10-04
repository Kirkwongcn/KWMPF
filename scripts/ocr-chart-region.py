#!/usr/bin/env python3
"""Read the printed text inside one chart region of a rendered fact-sheet page.

Used by `coverage:chart-allocations` (ADR 0013). The page is rendered by the caller;
this script only crops and runs two independent OCR engines, so the caller can
accept a value only when both engines print the same characters. It never infers a
number from a bar length or a slice angle.

Usage: ocr-chart-region.py IMAGE LEFT TOP RIGHT BOTTOM [VALUES_LEFT|axis]

With VALUES_LEFT (image pixels), Tesseract reads the percentages in a separate
pass over the column from VALUES_LEFT to RIGHT: coloured pixels (bars, legend
swatches) are whitened, the column is upscaled 2x and lightly blurred (3x3
Gaussian), and read with a digits-only whitelist. Read with the labels at normal
size, Tesseract drops small decimal points ("4.7%" read as "47%"). The settings
were chosen once over the 2026-06-30 Sun Life and Manulife charts and are fixed;
they are never retried until the engines agree. `axis` starts the column just right of the chart's axis line: the longest
vertical run of grey (unsaturated, non-white) pixels, which must span at least half
the region's height; otherwise the script fails rather than guessing.
Prints JSON: {"image": {"width", "height"}, "engines": {...versions},
"rapidocr": [...], "tesseract": [...]} where each box is
{"text", "left", "top", "right", "bottom"} in crop pixels.
"""

import json
import subprocess
import sys
import tempfile


def rapidocr_boxes(crop):
    from rapidocr_onnxruntime import RapidOCR

    result, _ = RapidOCR()(crop)
    boxes = []
    for box, text, _confidence in result or []:
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        boxes.append(
            {
                "text": text,
                "left": min(xs),
                "top": min(ys),
                "right": max(xs),
                "bottom": max(ys),
            }
        )
    return boxes


def tesseract_tsv(image, args):
    import cv2

    with tempfile.NamedTemporaryFile(suffix=".png") as handle:
        cv2.imwrite(handle.name, image)
        output = subprocess.run(
            ["tesseract", handle.name, "-", *args, "tsv"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    words = []
    for row in output.splitlines()[1:]:
        fields = row.split("\t")
        if len(fields) < 12 or fields[0] != "5" or fields[11].strip() == "":
            continue
        left, top, width, height = (int(value) for value in fields[6:10])
        words.append(
            {
                "text": fields[11],
                "left": left,
                "top": top,
                "right": left + width,
                "bottom": top + height,
            }
        )
    return words


def value_column(crop, values_left):
    """Percentages only: whiten coloured pixels, upscale 2x, blur, digits only."""
    import cv2

    column = crop[:, values_left:].copy()
    hsv = cv2.cvtColor(column, cv2.COLOR_BGR2HSV)
    column[hsv[:, :, 1] > 60] = (255, 255, 255)
    scale = 2
    column = cv2.resize(column, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(cv2.cvtColor(column, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    words = tesseract_tsv(
        gray,
        ["-l", "eng", "--psm", "6", "-c", "tessedit_char_whitelist=-0123456789.%"],
    )
    return [
        {
            "text": word["text"],
            "left": word["left"] / scale + values_left,
            "top": word["top"] / scale,
            "right": word["right"] / scale + values_left,
            "bottom": word["bottom"] / scale,
        }
        for word in words
        if "%" in word["text"]
    ]


def axis_left(crop):
    import numpy as np
    import cv2

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    grey = (hsv[:, :, 1] < 40) & (hsv[:, :, 2] < 200)
    best_x, best_run = -1, 0
    for x in range(grey.shape[1]):
        column = grey[:, x]
        run = longest = 0
        for pixel in column:
            run = run + 1 if pixel else 0
            longest = max(longest, run)
        if longest > best_run:
            best_x, best_run = x, longest
    if best_run < grey.shape[0] / 2:
        sys.exit("no chart axis found: longest vertical grey run is too short")
    return best_x + 3


def tesseract_boxes(crop, values_left):
    # 圖例：`--psm 6` 當成一整塊文字讀中英文（核對英文一樣、中文唔同的圖例用）；
    # 有數值欄就剔走呢一輪讀到的數字，數值改由 `value_column` 另讀。
    words = tesseract_tsv(crop, ["-l", "chi_tra+eng", "--psm", "6"])
    if values_left is not None:
        words = [
            word
            for word in words
            if not any(char.isdigit() for char in word["text"]) and "%" not in word["text"]
        ]
        words += value_column(crop, values_left)
    return [{"words": [word]} for word in words]


def engine_versions():
    from importlib.metadata import version

    tesseract = subprocess.run(
        ["tesseract", "--version"], check=True, capture_output=True, text=True
    ).stdout.splitlines()[0]
    return {
        "rapidocr": f"rapidocr-onnxruntime {version('rapidocr-onnxruntime')}",
        "tesseract": f"{tesseract} chi_tra+eng --psm 6; values: colour-masked column, 2x, 3x3 blur, eng --psm 6 digits-only",
    }


def main():
    import cv2

    image_path, left, top, right, bottom = sys.argv[1:6]
    values_arg = sys.argv[6] if len(sys.argv) > 6 else None
    image = cv2.imread(image_path)
    if image is None:
        sys.exit(f"cannot read {image_path}")
    crop = image[int(top) : int(bottom), int(left) : int(right)]
    values_left = (
        None
        if values_arg is None
        else axis_left(crop)
        if values_arg == "axis"
        else int(values_arg) - int(left)
    )
    result = {
        "image": {"width": image.shape[1], "height": image.shape[0]},
        "crop": {"width": crop.shape[1], "height": crop.shape[0]},
        "engines": engine_versions(),
        "rapidocr": rapidocr_boxes(crop),
        "tesseract": tesseract_boxes(crop, values_left),
        "valuesLeft": values_left,
    }
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
