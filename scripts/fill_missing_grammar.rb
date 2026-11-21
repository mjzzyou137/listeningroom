#!/usr/bin/env ruby

require "json"
require "time"
require_relative "grammar_generator"

ROOT = File.expand_path("..", __dir__)
FILES = %w[all-lessons.json natural-conversations.json one-minute-videos.json].freeze

FILES.each do |filename|
  path = File.join(ROOT, "public", "data", filename)
  payload = JSON.parse(File.read(path))
  generated = 0
  payload["levels"].each do |level|
    level["lessons"].each do |lesson|
      next unless lesson["grammarHtml"].to_s.strip.empty?
      next if lesson["transcriptHtml"].to_s.strip.empty?
      lesson["grammarHtml"] = GrammarGenerator.generate(lesson["transcriptHtml"])
      generated += 1
    end
  end
  payload["grammarUpdatedAt"] = Time.now.utc.iso8601 if generated.positive?
  File.write(path, JSON.pretty_generate(payload)) if generated.positive?
  warn "#{filename}: generated #{generated} missing Grammar sections"
end
