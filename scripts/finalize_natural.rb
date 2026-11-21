#!/usr/bin/env ruby

require "json"
require "time"
require "uri"

root = File.expand_path("..", __dir__)
combined_path = File.join(root, "public", "data", "natural-conversations.json")
data = JSON.parse(File.read(combined_path))

data["levels"].each do |level|
  level["lessons"].each do |lesson|
    number = lesson["code"].to_s[/\d+/, 0]
    lesson["id"] = "natural-#{level['level'].downcase}-#{number}"
    next unless lesson["title"].to_s.strip.empty?

    slug = File.basename(URI(lesson["sourceUrl"]).path, ".*") rescue File.basename(lesson["sourceUrl"], ".*")
    slug = slug.sub(/\AT?\d+-?/i, "").tr("_-", " ").gsub(/([a-z])([A-Z])/, '\\1 \\2').gsub(/\s+/, " ").strip
    lesson["title"] = slug.split.map(&:capitalize).join(" ")
  end
  level_path = File.join(root, "public", "data", "natural", "#{level['level'].downcase}.json")
  File.write(level_path, JSON.pretty_generate(level))
end

data["generatedAt"] = Time.now.utc.iso8601
File.write(combined_path, JSON.pretty_generate(data))
