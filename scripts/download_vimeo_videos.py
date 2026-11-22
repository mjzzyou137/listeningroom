#!/usr/bin/env python3
import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from playwright.async_api import async_playwright

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
        # If no paragraphs, try line breaks or text
        text = re.sub(r'<[^>]+>', '', raw_html).strip()
        lines_raw = [l.strip() for l in text.split('\n') if l.strip()]
        clean_paras = lines_raw if lines_raw else [text]

    timings = lesson.get('scriptTimings') or []
    lines = ['WEBVTT', '']

    for i, para in enumerate(clean_paras):
        t_start = timings[i] if i < len(timings) else (i * 4.0)
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

from concurrent.futures import ThreadPoolExecutor

def fetch_seg(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Referer': 'https://elllo.org/'
            })
            return urllib.request.urlopen(req, timeout=15).read()
        except Exception as e:
            if attempt == 2:
                print(f"    Failed to fetch {url}: {e}")
                return b''
            import time
            time.sleep(0.5)

def assemble_vimeo_video(manifest_url, output_mp4):
    try:
        req = urllib.request.Request(manifest_url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Referer': 'https://elllo.org/'
        })
        manifest_data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode('utf-8'))
        base_url = urllib.parse.urljoin(manifest_url, manifest_data['base_url'])

        # Best video (capped at 720p max)
        videos_720 = [v for v in manifest_data['video'] if v.get('height', 0) <= 720]
        if videos_720:
            best_video = max(videos_720, key=lambda x: (x.get('height', 0), x.get('bitrate', 0)))
        else:
            best_video = min(manifest_data['video'], key=lambda x: x.get('height', 0))
        # Best audio
        best_audio = max(manifest_data['audio'], key=lambda x: x.get('bitrate', 0))

        temp_dir = output_mp4 + '.tmp'
        os.makedirs(temp_dir, exist_ok=True)
        v_temp = os.path.join(temp_dir, 'video.mp4')
        a_temp = os.path.join(temp_dir, 'audio.mp4')

        # Download video segments concurrently
        v_urls = [urllib.parse.urljoin(base_url, seg['url']) for seg in best_video['segments']]
        a_urls = [urllib.parse.urljoin(base_url, seg['url']) for seg in best_audio['segments']]

        with ThreadPoolExecutor(max_workers=8) as ex:
            v_chunks = list(ex.map(fetch_seg, v_urls))
            a_chunks = list(ex.map(fetch_seg, a_urls))

        with open(v_temp, 'wb') as vf:
            vf.write(base64.b64decode(best_video['init_segment']))
            for c in v_chunks:
                vf.write(c)

        with open(a_temp, 'wb') as af:
            af.write(base64.b64decode(best_audio['init_segment']))
            for c in a_chunks:
                af.write(c)

        # Mux to final MP4
        cmd = ['ffmpeg', '-i', v_temp, '-i', a_temp, '-c', 'copy', output_mp4, '-y']
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Cleanup temp
        if os.path.exists(v_temp): os.remove(v_temp)
        if os.path.exists(a_temp): os.remove(a_temp)
        if os.path.exists(temp_dir): os.rmdir(temp_dir)

        return os.path.exists(output_mp4) and os.path.getsize(output_mp4) > 100000
    except Exception as e:
        print(f"    Error assembling video: {e}")
        return False

async def get_vimeo_manifest_url(browser, vimeo_url):
    for attempt in range(2):
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            extra_http_headers={'Referer': 'https://elllo.org/'}
        )
        page = await context.new_page()
        captured = []
        def on_req(r):
            if 'playlist.json' in r.url:
                captured.append(r.url)

        page.on('request', on_req)
        try:
            await page.goto(vimeo_url, wait_until='load', timeout=15000)
            await page.wait_for_timeout(1000)

            # Look for any play button variant or click center
            play_btn = page.locator('button[data-title*="Play"], button[aria-label*="Play"], button[class*="playButton"], button[class*="PlayButton"]').first
            if await play_btn.count():
                try:
                    await play_btn.click(timeout=3000)
                except Exception:
                    await page.mouse.click(300, 200)
            else:
                await page.mouse.click(300, 200)

            for _ in range(15):
                if captured:
                    break
                await page.wait_for_timeout(200)
        except Exception as e:
            pass
        finally:
            await page.close()
            await context.close()

        if captured:
            return captured[0]
        await asyncio.sleep(0.5)

    return None

async def process_vimeo_lessons(target_level=None):
    with open(os.path.join(DATA_DIR, 'one-minute-videos.json'), 'r', encoding='utf-8') as f:
        main_data = json.load(f)

    lessons_to_process = []
    for lvl in main_data.get('levels', []):
        lvl_name = lvl.get('level', '').upper()
        if target_level and target_level.upper() != 'ALL' and lvl_name != target_level.upper():
            continue
        for lesson in lvl.get('lessons', []):
            vid = lesson.get('videoUrl') or ''
            if 'vimeo.com' in vid:
                lessons_to_process.append((lvl_name, lesson))

    print(f"Total Vimeo lessons to process: {len(lessons_to_process)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        completed = 0
        for lvl_name, lesson in lessons_to_process:
            lid = lesson.get('id')
            title = lesson.get('title')
            raw_vimeo = lesson.get('videoUrl')

            folder = os.path.join(VIDEOS_DIR, 'videos', lvl_name.lower())
            os.makedirs(folder, exist_ok=True)
            output_mp4 = os.path.join(folder, f"{lid}.mp4")
            output_vtt = os.path.join(folder, f"{lid}.vtt")

            rel_video_url = f"/videos/videos/{lvl_name.lower()}/{lid}.mp4"
            rel_vtt_url = f"/videos/videos/{lvl_name.lower()}/{lid}.vtt"

            print(f"[{completed+1}/{len(lessons_to_process)}] Processing {lid} ({title})...")

            # 1. Generate Subtitle
            generate_vtt(lesson, output_vtt)
            lesson['subtitleUrl'] = rel_vtt_url

            # 2. Check if video already downloaded
            if os.path.exists(output_mp4) and os.path.getsize(output_mp4) > 100000:
                print(f"  ✓ Video already exists ({os.path.getsize(output_mp4)//1024} KB)")
                lesson['videoUrl'] = rel_video_url
                completed += 1
                continue

            # 3. Intercept manifest
            manifest_url = await get_vimeo_manifest_url(browser, raw_vimeo)
            if not manifest_url:
                print(f"  ✗ Could not capture Vimeo manifest for {raw_vimeo}")
                completed += 1
                continue

            # 4. Assemble video
            ok = assemble_vimeo_video(manifest_url, output_mp4)
            if ok:
                lesson['videoUrl'] = rel_video_url
                print(f"  ✓ Downloaded & assembled: {rel_video_url} ({os.path.getsize(output_mp4)//1024} KB)")
            else:
                print(f"  ✗ Failed to assemble video")

            completed += 1

            # Save progress incrementally to files
            with open(os.path.join(DATA_DIR, 'one-minute-videos.json'), 'w', encoding='utf-8') as f:
                json.dump(main_data, f, ensure_ascii=False, indent=2)

            level_file = os.path.join(DATA_DIR, 'videos', f"{lvl_name.lower()}.json")
            if os.path.exists(level_file):
                with open(level_file, 'r', encoding='utf-8') as lf:
                    lf_data = json.load(lf)
                for item in lf_data.get('lessons', []):
                    if item.get('id') == lid:
                        item['videoUrl'] = rel_video_url
                        item['subtitleUrl'] = rel_vtt_url
                with open(level_file, 'w', encoding='utf-8') as lf:
                    json.dump(lf_data, lf, ensure_ascii=False, indent=2)

        await browser.close()

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'ALL'
    asyncio.run(process_vimeo_lessons(target))
