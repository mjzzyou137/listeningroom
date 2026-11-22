import os, sys, glob, json, subprocess
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS_DIR = os.path.join(ROOT, 'public', 'videos')

def get_video_info(file_path):
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'json', file_path
    ]
    try:
        out = subprocess.check_output(cmd)
        data = json.loads(out)
        streams = data.get('streams', [])
        if streams:
            return streams[0].get('width', 0), streams[0].get('height', 0)
    except Exception as e:
        print(f"Error probing {file_path}: {e}")
    return 0, 0

def compress_file(file_path):
    w, h = get_video_info(file_path)
    if h <= 480 and h > 0:
        return file_path, False, f"Already <= 480p ({w}x{h})"

    orig_size = os.path.getsize(file_path)
    temp_out = file_path + '.480p.mp4'

    # Compress to 480p max height, keep aspect ratio (-2 ensures even width)
    cmd = [
        'ffmpeg', '-v', 'error',
        '-i', file_path,
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '24',
        '-c:a', 'aac',
        '-b:a', '96k',
        temp_out, '-y'
    ]

    try:
        subprocess.run(cmd, check=True)
        new_size = os.path.getsize(temp_out)
        if new_size > 1000:
            os.replace(temp_out, file_path)
            new_w, new_h = get_video_info(file_path)
            saved_pct = (orig_size - new_size) * 100 // orig_size if orig_size > 0 else 0
            return file_path, True, f"{w}x{h} -> {new_w}x{new_h} ({orig_size//1024}KB -> {new_size//1024}KB, -{saved_pct}%)"
        else:
            if os.path.exists(temp_out): os.remove(temp_out)
            return file_path, False, "Output too small / failed"
    except Exception as e:
        if os.path.exists(temp_out): os.remove(temp_out)
        return file_path, False, f"Error: {e}"

def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else 'public/videos/**/*.mp4'
    files = sorted(glob.glob(os.path.join(ROOT, pattern), recursive=True))
    # Filter out any non-mp4 or temp files
    files = [f for f in files if f.endswith('.mp4') and not f.endswith('.480p.mp4') and not f.endswith('.tmp.mp4')]

    print(f"Total video files found: {len(files)}")
    to_compress = []
    already_done = 0
    for f in files:
        w, h = get_video_info(f)
        if h > 480:
            to_compress.append(f)
        elif h > 0:
            already_done += 1

    print(f"Already <= 480p: {already_done}")
    print(f"Need compression to 480p: {len(to_compress)}")

    if not to_compress:
        print("All videos are already <= 480p!")
        return

    # Use 4 parallel workers on Mac CPU
    with ProcessPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(compress_file, f): f for f in to_compress}
        idx = 0
        for future in as_completed(futures):
            idx += 1
            f, converted, msg = future.result()
            rel = os.path.relpath(f, ROOT)
            status = "✓" if converted else "-"
            print(f"[{idx}/{len(to_compress)}] {status} {rel}: {msg}", flush=True)

    print("\nCompression to 480p finished!", flush=True)

if __name__ == '__main__':
    main()
