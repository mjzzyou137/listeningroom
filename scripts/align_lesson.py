#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser

class ParagraphExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_p = False
        self.current_text = []
        self.paragraphs = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "p":
            self.in_p = True
            self.current_text = []

    def handle_endtag(self, tag):
        if tag.lower() == "p":
            self.in_p = False
            text = " ".join("".join(self.current_text).split())
            if text:
                self.paragraphs.append(text)
            self.current_text = []

    def handle_data(self, data):
        if self.in_p:
            self.current_text.append(data)

def extract_paragraphs(html):
    parser = ParagraphExtractor()
    parser.feed(html)
    return parser.paragraphs

CONTRACTIONS = {
    "i'm": ["i", "am"],
    "it's": ["it", "is"],
    "that's": ["that", "is"],
    "don't": ["do", "not"],
    "doesn't": ["does", "not"],
    "didn't": ["did", "not"],
    "can't": ["can", "not"],
    "won't": ["will", "not"],
    "what's": ["what", "is"],
    "where's": ["where", "is"],
    "who's": ["who", "is"],
    "how's": ["how", "is"],
    "you're": ["you", "are"],
    "we're": ["we", "are"],
    "they're": ["they", "are"],
    "he's": ["he", "is"],
    "she's": ["she", "is"],
    "isn't": ["is", "not"],
    "aren't": ["are", "not"],
    "wasn't": ["was", "not"],
    "weren't": ["were", "not"],
    "i've": ["i", "have"],
    "you've": ["you", "have"],
    "we've": ["we", "have"],
    "they've": ["they", "have"],
    "i'll": ["i", "will"],
    "you'll": ["you", "will"],
    "he'll": ["he", "will"],
    "she'll": ["she", "will"],
    "they'll": ["they", "will"],
    "we'll": ["we", "will"],
    "mum": ["mom"]
}

def normalize_word(w):
    w = w.lower().strip()
    w = re.sub(r"[^a-z0-9']", "", w)
    return w

def expand_words(text):
    words = []
    for raw in text.split():
        nw = normalize_word(raw)
        if not nw:
            continue
        if nw in CONTRACTIONS:
            words.extend(CONTRACTIONS[nw])
        else:
            pure = re.sub(r"'", "", nw)
            if pure:
                words.append(pure)
    return words

def run_whisper(audio_path, model_path="models/ggml-base.en.bin"):
    with tempfile.TemporaryDirectory() as tmpdir:
        out_prefix = os.path.join(tmpdir, "whisper_out")
        cmd = [
            "whisper-cli",
            "-m", model_path,
            "-f", audio_path,
            "-ojf",
            "-of", out_prefix,
            "-np"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"whisper-cli failed: {res.stderr}")
        json_path = out_prefix + ".json"
        if not os.path.exists(json_path):
            raise RuntimeError(f"Output json not found at {json_path}")
        with open(json_path) as f:
            return json.load(f)

def extract_whisper_words(whisper_data):
    whisper_words = []
    for seg in whisper_data.get("transcription", []):
        tokens = seg.get("tokens", [])
        for tok in tokens:
            raw = tok.get("text", "").strip()
            if not raw or raw.startswith("[_"):
                continue
            t_start = tok["offsets"]["from"] / 1000.0
            t_end = tok["offsets"]["to"] / 1000.0
            for w in expand_words(raw):
                whisper_words.append({"word": w, "start": t_start, "end": t_end})
    return whisper_words

def extract_script_lines(transcript_html):
    raw_paragraphs = extract_paragraphs(transcript_html)
    script_lines = []
    for line_idx, clean in enumerate(raw_paragraphs):
        speech = re.sub(r"^[A-Za-z0-9 _.'-]{1,25}:\s*", "", clean).strip()
        words = expand_words(speech)
        script_lines.append({"line_idx": line_idx, "raw": clean, "speech": speech, "words": words})
    return script_lines

def align_script_with_whisper(script_lines, whisper_words):
    if not script_lines or not whisper_words:
        return [0.0] * len(script_lines)

    script_words = []
    for line_idx, sline in enumerate(script_lines):
        for w_idx, w in enumerate(sline["words"]):
            script_words.append({
                "word": w,
                "line_idx": line_idx,
                "is_first": (w_idx == 0)
            })

    M = len(script_words)
    N = len(whisper_words)

    if M == 0 or N == 0:
        return [0.0] * len(script_lines)

    # Needleman-Wunsch / DP alignment
    dp = [[0] * (N + 1) for _ in range(M + 1)]
    MATCH = 3
    MISMATCH = -2
    GAP_S = -1
    GAP_W = -1

    for i in range(M + 1):
        dp[i][0] = i * GAP_S
    for j in range(N + 1):
        dp[0][j] = j * GAP_W

    for i in range(1, M + 1):
        sw = script_words[i - 1]["word"]
        for j in range(1, N + 1):
            ww = whisper_words[j - 1]["word"]
            score = MATCH if sw == ww else MISMATCH
            dp[i][j] = max(
                dp[i - 1][j - 1] + score,
                dp[i - 1][j] + GAP_S,
                dp[i][j - 1] + GAP_W
            )

    # Backtracking
    i, j = M, N
    aligned_pairs = []
    while i > 0 and j > 0:
        sw = script_words[i - 1]["word"]
        ww = whisper_words[j - 1]["word"]
        score = MATCH if sw == ww else MISMATCH
        if dp[i][j] == dp[i - 1][j - 1] + score:
            aligned_pairs.append((i - 1, j - 1, sw == ww))
            i -= 1
            j -= 1
        elif dp[i][j] == dp[i - 1][j] + GAP_S:
            i -= 1
        else:
            j -= 1

    aligned_pairs.reverse()

    line_matches = {idx: [] for idx in range(len(script_lines))}
    for sw_idx, ww_idx, is_exact in aligned_pairs:
        if is_exact:
            l_idx = script_words[sw_idx]["line_idx"]
            line_matches[l_idx].append(whisper_words[ww_idx]["start"])

    # Determine start timestamp for each line
    final_timings = [None] * len(script_lines)
    for l_idx in range(len(script_lines)):
        matches = line_matches[l_idx]
        if matches:
            final_timings[l_idx] = matches[0]

    # Fill unaligned gaps with monotonic interpolation
    last_known_idx = None
    for idx in range(len(final_timings)):
        if final_timings[idx] is not None:
            if last_known_idx is None:
                # Fill prefix from 0.0
                t_end = final_timings[idx]
                for k in range(idx):
                    final_timings[k] = round((k / idx) * t_end, 2)
            else:
                gap = idx - last_known_idx
                if gap > 1:
                    t_start = final_timings[last_known_idx]
                    t_end = max(t_start, final_timings[idx])
                    for k in range(1, gap):
                        final_timings[last_known_idx + k] = round(t_start + (k / gap) * (t_end - t_start), 2)
            last_known_idx = idx

    # If trailing lines are unaligned
    if last_known_idx is not None and last_known_idx < len(final_timings) - 1:
        t_last = final_timings[last_known_idx]
        for k in range(last_known_idx + 1, len(final_timings)):
            final_timings[k] = t_last
    elif last_known_idx is None:
        final_timings = [0.0] * len(script_lines)

    # Monotonic cleanup
    curr = 0.0
    for idx in range(len(final_timings)):
        if final_timings[idx] < curr:
            final_timings[idx] = curr
        else:
            curr = final_timings[idx]
        final_timings[idx] = round(final_timings[idx], 2)

    return final_timings
