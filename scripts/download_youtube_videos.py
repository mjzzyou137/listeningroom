#!/usr/bin/env python3
import json
import os
import re
import subprocess
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'public', 'data')
VIDEOS_DIR = os.path.join(ROOT, 'public', 'videos')

def fmt_time(sec):
    hrs = int(sec // 3600)
    mins = int((sec % 3600) // 60)
    secs = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"

def generate_vtt(lesson, vtt_path):
    raw_html = lesson.get('transcriptHtml', '')
    if not raw_html:
        return False
    paras = re.findall(r'<p>(.*?)</p>', raw_html, re.DOTALL)
    clean_paras = [re.sub(r'<[^>]+>', '', p).strip() for p in paras]
    clean_paras = [re.sub(r'\s+', ' ', p) for p in clean_paras if p]
    if not clean_paras:
        return False

    timings = lesson.get('scriptTimings') or []
    lines = ['WEBVTT', '']

    for i, para in enumerate(clean_paras):
        t_start = timings[i] if i < len(timings) else 0.0
        t_end = timings[i+1] if i+1 < len(timings) else (t_start + 4.0)
        if t_end <= t_start:
            t_end = t_start + 2.5
        lines.append(str(i + 1))
        lines.append(f"{fmt_time(t_start)} --> {fmt_time(t_end)}")
        lines.append(para)
        lines.append('')

    os.makedirs(os.path.dirname(vtt_path), exist_ok=True)
    with open(vtt_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return True

def download_youtube_video(yt_url, output_mp4):
    if os.path.exists(output_mp4) and os.path.getsize(output_mp4) > 100000:
        return True

    os.makedirs(os.path.dirname(output_mp4), exist_ok=True)
    temp_template = output_mp4.rsplit('.', 1)[0] + '.temp.%(ext)s'
    
    cmd = [
        'python3', '-m', 'yt_dlp',
        '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        '-o', temp_template,
        '--no-playlist',
        yt_url
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"  yt-dlp error: {res.stderr[:200]}")
        return False

    # Find the downloaded file
    temp_dir = os.path.dirname(output_mp4)
    base_name = os.path.basename(output_mp4).rsplit('.', 1)[0] + '.temp.'
    matched = [os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.startswith(base_name)]
    if not matched:
        return False

    downloaded = matched[0]
    # Remux or encode to standard H.264/AAC MP4
    cmd_ffmpeg = [
        'ffmpeg', '-i', downloaded,
        '-c:v', 'copy', '-c:a', 'aac',
        output_mp4, '-y'
    ]
    res_ffmpeg = subprocess.run(cmd_ffmpeg, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res_ffmpeg.returncode != 0:
        # Fallback to full re-encode if copy fails
        cmd_reencode = [
            'ffmpeg', '-i', downloaded,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
            '-c:a', 'aac',
            output_mp4, '-y'
        ]
        res_re = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res_re.returncode != 0:
            return False

    if os.path.exists(downloaded):
        os.remove(downloaded)

    return os.path.exists(output_mp4) and os.path.getsize(output_mp4) > 100000

def process_file(json_rel_path, target_level=None):
    full_path = os.path.join(DATA_DIR, json_rel_path)
    if not os.path.exists(full_path):
        return

    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modified = False

    def walk(obj):
        nonlocal modified
        if isinstance(obj, dict):
            lid = obj.get('id')
            yt = obj.get('youtubeUrl') or obj.get('youtubeEmbedUrl')
            coll = obj.get('collection') or 'natural'
            lvl = obj.get('level') or 'A1'
            
            if target_level and lvl != target_level:
                pass
            elif yt and lid:
                folder = os.path.join(VIDEOS_DIR, coll.lower(), lvl.lower())
                video_file = os.path.join(folder, f"{lid}.mp4")
                vtt_file = os.path.join(folder, f"{lid}.vtt")

                rel_video_url = f"/videos/{coll.lower()}/{lvl.lower()}/{lid}.mp4"
                rel_vtt_url = f"/videos/{coll.lower()}/{lvl.lower()}/{lid}.vtt"

                print(f"Processing [{lid}] {obj.get('title')}...")
                ok_vid = download_youtube_video(yt, video_file)
                ok_vtt = generate_vtt(obj, vtt_file)

                if ok_vid:
                    obj['videoUrl'] = rel_video_url
                    modified = True
                    print(f"  ✓ Video ready: {rel_video_url} ({os.path.getsize(video_file) // 1024} KB)")
                if ok_vtt:
                    obj['subtitleUrl'] = rel_vtt_url
                    modified = True
                    print(f"  ✓ Subtitle ready: {rel_vtt_url}")

            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)

    if modified:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Saved updated {json_rel_path}")

def process_all_files():
    # 1. Process natural-conversations.json
    process_file('natural-conversations.json')
    # 2. Process all individual level files
    for level in ['a1', 'a2', 'b1', 'b2', 'c1']:
        process_file(f'natural/{level}.json')
        process_file(f'levels/{level}.json')
    process_file('all-lessons.json')

if __name__ == '__main__':
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else 'ALL'
    if arg.upper() == 'ALL':
        print("=== Downloading all YouTube videos across all collections ===")
        process_all_files()
    else:
        print(f"=== Downloading and generating subtitles for Level {arg} ===")
        process_file('natural-conversations.json', target_level=arg)
        process_file(f'natural/{arg.lower()}.json')
    print("Done!")
