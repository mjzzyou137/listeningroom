#!/usr/bin/env python3
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from align_lesson import (
    run_whisper,
    extract_whisper_words,
    extract_script_lines,
    align_script_with_whisper
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, ".whisper_cache")

def process_single_lesson(lesson, model_path="models/ggml-base.en.bin"):
    lesson_id = lesson["id"]
    audio_url = lesson.get("audioUrl", "")
    transcript_html = lesson.get("transcriptHtml", "")

    if not audio_url or not transcript_html:
        return lesson_id, None, "No audio or transcript"

    audio_path = os.path.join(ROOT, "public", audio_url.lstrip("/"))
    if not os.path.exists(audio_path):
        return lesson_id, None, f"Audio file not found: {audio_path}"

    script_lines = extract_script_lines(transcript_html)
    if not script_lines:
        return lesson_id, None, "No script lines found in transcriptHtml"

    # Check cache for whisper output
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{lesson_id}.json")

    whisper_data = None
    if os.path.exists(cache_file):
        try:
            with open(cache_file) as f:
                whisper_data = json.load(f)
        except Exception:
            whisper_data = None

    if whisper_data is None:
        try:
            whisper_data = run_whisper(audio_path, model_path)
            with open(cache_file, "w") as f:
                json.dump(whisper_data, f)
        except Exception as e:
            return lesson_id, None, str(e)

    whisper_words = extract_whisper_words(whisper_data)
    timings = align_script_with_whisper(script_lines, whisper_words)
    return lesson_id, timings, None

def align_dataset(filename, level_filter=None, max_workers=2):
    dataset_path = os.path.join(ROOT, "public", "data", filename)
    with open(dataset_path) as f:
        data = json.load(f)

    # Flatten lessons
    targets = []
    for level_group in data.get("levels", []):
        lvl = level_group.get("level", "")
        if level_filter and lvl not in level_filter:
            continue
        for lesson in level_group.get("lessons", []):
            if lesson.get("audioUrl") and lesson.get("transcriptHtml"):
                targets.append(lesson)

    print(f"[{filename}] Found {len(targets)} lessons to align (filter: {level_filter})...")
    start_time = time.time()

    completed = 0
    # Process with ProcessPoolExecutor
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        future_to_lesson = {
            executor.submit(process_single_lesson, lesson): lesson
            for lesson in targets
        }

        for future in as_completed(future_to_lesson):
            lesson = future_to_lesson[future]
            lesson_id, timings, error = future.result()
            completed += 1
            if timings:
                lesson["scriptTimings"] = timings
                print(f"[{completed}/{len(targets)}] OK: {lesson_id} ({len(timings)} lines) - first: {timings[0]}s, last: {timings[-1]}s")
            else:
                print(f"[{completed}/{len(targets)}] FAIL: {lesson_id} - {error}")

            # Save incrementally every 5 lessons
            if completed % 5 == 0 or completed == len(targets):
                with open(dataset_path, "w") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

    elapsed = time.time() - start_time
    print(f"[{filename}] Finished {completed} lessons in {elapsed:.1f}s!")

if __name__ == "__main__":
    fn = sys.argv[1] if len(sys.argv) > 1 else "all-lessons.json"
    lvl = sys.argv[2].split(",") if len(sys.argv) > 2 else None
    align_dataset(fn, level_filter=lvl, max_workers=2)
