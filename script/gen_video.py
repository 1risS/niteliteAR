import subprocess
import os
import tempfile
from glob import glob
from tqdm import tqdm


def run_command(cmd: str) -> None:
    # print(cmd)
    subprocess.run(cmd, shell=True, check=True)


def extract_alpha(image_path: str, *, output_dir: str) -> str:
    output_path = os.path.join(output_dir, os.path.basename(image_path))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    run_command(f"convert -alpha extract {image_path} {output_path}")
    return output_path


def concatenate_alpha(image_path: str, alpha_path: str, *, output_dir: str) -> str:
    output_path = os.path.join(output_dir, os.path.basename(image_path))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    run_command(f"convert -append {image_path} {alpha_path} {output_path}")
    return output_path


def build_video(images_dir: str, output_path: str, *, framerate: int = 30) -> None:
    # cmd = f"ffmpeg -framerate 60 -pattern_type glob -i '{images_dir}/*.png' -c:v libx264 -pix_fmt yuv420p {output_path}"
    run_command(
        f"ffmpeg -y -framerate {framerate} -pattern_type glob -i '{images_dir}/*.png' -c:v libvpx-vp9 -f webm {output_path}.webm"
    )
    run_command(
        f"ffmpeg -y -framerate {framerate} -pattern_type glob -i '{images_dir}/*.png' -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.1 -movflags +faststart -f mp4 {output_path}.mp4"
    )


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", help="path to input dir containing .png frames")
    parser.add_argument("--temp-dir", help="temporary directory for intermediary files")
    parser.add_argument(
        "--output",
        "-o",
        default="./out",
        help="output path, extension will be replaced",
    )
    parser.add_argument("--framerate", type=int, default=30, help="target framerate")

    args = parser.parse_args()

    temp_dir = args.temp_dir
    tmpdir = None
    if not args.temp_dir:
        tmpdir = tempfile.TemporaryDirectory()
        temp_dir = tmpdir.name

    image_paths = glob(os.path.join(args.input_dir, "*.png"))
    conc_path = os.path.join(temp_dir, "conc")
    for image_path in tqdm(image_paths):
        alpha_path = extract_alpha(image_path, output_dir=os.path.join(temp_dir, "alpha"))
        concatenate_alpha(image_path, alpha_path, output_dir=conc_path)

    build_video(conc_path, args.output, framerate=args.framerate)

    if tmpdir:
        tmpdir.cleanup()


if __name__ == "__main__":
    main()
