#!/usr/bin/env ruby

require "json"
require "nokogiri"
require "open3"
require "thread"

ROOT = File.expand_path("..", __dir__)
FILES = %w[all-lessons.json natural-conversations.json one-minute-videos.json].freeze

def audio_analysis(path)
  command = ["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-38dB:d=0.22", "-f", "null", "-"]
  _stdout, stderr, status = Open3.capture3(*command)
  raise "ffmpeg failed" unless status.success?
  duration = stderr[/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/, 0]
  match = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/)
  raise "duration unavailable" unless match
  total = match[1].to_i * 3600 + match[2].to_i * 60 + match[3].to_f
  starts = stderr.scan(/silence_start:\s*([\d.]+)/).flatten.map(&:to_f)
  ends = stderr.scan(/silence_end:\s*([\d.]+)/).flatten.map(&:to_f)
  silences = starts.each_with_index.map { |start, index| [start, ends[index] || total] }
  [total, silences]
end

def voiced_segments(duration, silences)
  cursor = 0.0
  segments = []
  silences.each do |start, finish|
    segments << [cursor, start] if start > cursor
    cursor = [cursor, finish].max
  end
  segments << [cursor, duration] if duration > cursor
  segments.select { |start, finish| finish - start > 0.02 }
end

def real_time_for_voiced(target, segments)
  remaining = target
  segments.each do |start, finish|
    length = finish - start
    return start + remaining if remaining <= length
    remaining -= length
  end
  segments.last&.last || 0.0
end

def timings_for(lesson, audio_path)
  fragment = Nokogiri::HTML.fragment(lesson["transcriptHtml"].to_s)
  lines = fragment.css("p").map { |node| node.text.gsub(/\s+/, " ").strip }.reject(&:empty?)
  return nil if lines.empty?
  duration, silences = audio_analysis(audio_path)
  segments = voiced_segments(duration, silences)
  voiced_duration = segments.sum { |start, finish| finish - start }
  weights = lines.map do |line|
    speech = line.sub(/\A[\p{L} .'-]{1,24}:\s*/, "")
    [speech.scan(/[\p{L}\d']+/).length + 0.7, 1.0].max
  end
  total_weight = weights.sum
  cumulative = 0.0
  weights.map do |weight|
    timestamp = real_time_for_voiced((cumulative / total_weight) * voiced_duration, segments)
    cumulative += weight
    timestamp.round(3)
  end
end

files = ARGV.empty? ? FILES : ARGV.map { |name| name.end_with?(".json") ? name : "#{name}.json" }
files.each do |filename|
  path = File.join(ROOT, "public", "data", filename)
  payload = JSON.parse(File.read(path))
  lessons = payload["levels"].flat_map { |level| level["lessons"] }
  queue = Queue.new
  lessons.each { |lesson| queue << lesson if lesson["audioUrl"] }
  mutex = Mutex.new
  completed = 0
  workers = [8, queue.length].min.times.map do
    Thread.new do
      loop do
        lesson = queue.pop(true) rescue break
        audio_rel = lesson["audioUrl"].to_s.sub(%r{\Ahttps?://[^/]+/}, "").sub(%r{\A/}, "")
        audio_path = File.join(ROOT, "public", audio_rel)
        begin
          timing = timings_for(lesson, audio_path)
          lesson["scriptTimings"] = timing if timing
        rescue StandardError => error
          mutex.synchronize { warn "SKIP #{lesson["id"]}: #{error.message}" }
        ensure
          mutex.synchronize do
            completed += 1
            warn "#{filename}: #{completed}/#{lessons.count { |item| item["audioUrl"] }}" if (completed % 25).zero?
          end
        end
      end
    end
  end
  workers.each(&:join)
  File.write(path, JSON.pretty_generate(payload))
  warn "#{filename}: saved timelines for #{lessons.count { |lesson| lesson["scriptTimings"] }} lessons"
end
