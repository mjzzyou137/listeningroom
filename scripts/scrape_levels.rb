#!/usr/bin/env ruby

require "fileutils"
require "json"
require "net/http"
require "nokogiri"
require "open3"
require "time"
require "uri"

ROOT = File.expand_path("..", __dir__)
DATA_DIR = File.join(ROOT, "public", "data", "levels")
AUDIO_ROOT = File.join(ROOT, "public", "audio")
FileUtils.mkdir_p(DATA_DIR)

LEVELS = {
  "A1" => { name: "Beginner", index: "https://elllo.org/book/A1/index.html" },
  "A2" => { name: "High-Beginner", index: "https://elllo.org/book/A2/index.html" },
  "B1" => { name: "Intermediate", index: "https://elllo.org/book/B1/index.html" },
  "B2" => { name: "High-Intermediate", index: "https://elllo.org/book/B2/index.html" },
  "C1" => { name: "Advanced", index: "https://elllo.org/book/C1/index.html" }
}.freeze

def fetch(url, limit = 5)
  raise "Too many redirects for #{url}" if limit.zero?
  uri = URI(url)
  request = Net::HTTP::Get.new(uri)
  request["User-Agent"] = "Listeningroom educational prototype"
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
    http.open_timeout = 20
    http.read_timeout = 90
    http.request(request)
  end
  return response.body if response.is_a?(Net::HTTPSuccess)
  return fetch(URI.join(url, response["location"]).to_s, limit - 1) if response.is_a?(Net::HTTPRedirection)
  raise "HTTP #{response.code} for #{url}"
end

def clean_html(node)
  return "" unless node
  clone = node.dup
  clone.css("script, style, iframe, audio, form, button, .quiz, .puzzle").remove
  clone.css("a").each { |link| link.replace(link.text) }
  clone.css("*").each { |element| element.attribute_nodes.each { |attribute| element.delete(attribute.name) } }
  clone.inner_html.strip
end

def lesson_entries(level, index_url)
  document = Nokogiri::HTML(fetch(index_url))
  pattern = %r{#{level}-(?!00)[0-9]{2}[A-B]?-.+\.(?:html?|HTML?)$}
  links = document.css("a[href]").each_with_object({}) do |link, result|
    href = link["href"]
    next unless href && href.match?(pattern)
    url = URI.join(index_url, href).to_s
    title = link.text.gsub(/\s+/, " ").strip
    result[url] = title unless title.empty?
    result[url] ||= ""
  end
  links.to_a
end

def download_file(url, path)
  return if File.exist?(path) && File.size(path).positive?
  File.binwrite(path, fetch(url))
end

def combine_audio(parts, output)
  return if File.exist?(output) && File.size(output).positive?
  list_path = "#{output}.txt"
  File.write(list_path, parts.map { |path| "file '#{path.gsub("'", "'\\''")}'" }.join("\n"))
  command = ["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c:a", "libmp3lame", "-q:a", "4", output]
  _stdout, stderr, status = Open3.capture3(*command)
  raise "ffmpeg failed: #{stderr}" unless status.success?
ensure
  FileUtils.rm_f(list_path) if list_path
end

def scrape_level(level, config)
  entries = lesson_entries(level, config[:index])
  audio_dir = File.join(AUDIO_ROOT, level.downcase)
  FileUtils.mkdir_p(audio_dir)
  lessons = entries.map.with_index do |(url, index_title), position|
    warn "#{level} [#{position + 1}/#{entries.length}] #{url}"
    document = Nokogiri::HTML(fetch(url))
    filename_code = File.basename(URI(url).path)[/\A(#{level}-[0-9]{2}[A-B]?)/i, 1]
    code = filename_code || document.text[/\b(#{level}-[0-9]{2}[A-B]?)\b/i, 1] || "#{level}-#{format('%02d', position + 1)}"
    code = code.upcase
    slug = File.basename(URI(url).path, ".*").downcase.gsub(/[^a-z0-9]+/, "-").gsub(/^-|-$/, "")
    id = slug

    title = document.at_css(".lessonpromo h1, .lessonpromo h2, .topset h1, .topset h2, h2")&.text&.gsub(/\s+/, " ")&.strip
    title = index_title if title.nil? || title.empty?
    description = document.at_css(".lesson2blurb")&.text&.gsub(/\s+/, " ")&.strip
    description ||= document.at_css("meta[name='Description'], meta[name='description']")&.[]("content")
    description ||= "English conversation and grammar practice for #{config[:name]} learners."

    transcript = document.at_css("#transcript") || document.at_css("#view1 .transcript") || document.at_css("#view1")
    grammar = document.at_css("#view2 .notes_box .spacer") || document.at_css("#view2 .transcript") || document.at_css("#view2")
    topic = grammar&.at_css("p strong")&.text&.gsub(/\s+/, " ")&.strip
    topic = title if topic.nil? || topic.empty?

    speakers = transcript ? transcript.css("p").each_with_object([]) do |paragraph, names|
      name = paragraph.text.gsub(/\s+/, " ").strip[/\A([\p{L} .'-]{1,24}):/, 1]
      names << name if name && !names.include?(name)
    end : []

    youtube_src = document.at_css("iframe[src*='youtube.com']")&.[]("src")
    youtube_id = youtube_src&.match(%r{embed/([^?&/]+)})&.[](1)
    all_sources = document.css("audio source[src]").map { |source| URI.join(url, source["src"].gsub(" ", "%20")).to_s }
    combined_source = document.css("audio source[src]").find { |source| !source.ancestors("#view1").any? }
    preferred_sources = combined_source ? [URI.join(url, combined_source["src"].gsub(" ", "%20")).to_s] : document.css("#view1 audio source[src]").map { |source| URI.join(url, source["src"].gsub(" ", "%20")).to_s }
    preferred_sources = all_sources.first(1) if preferred_sources.empty?
    audio_filename = "#{id}.mp3"
    audio_path = File.join(audio_dir, audio_filename)

    if combined_source
      begin
        download_file(preferred_sources.first, audio_path)
      rescue StandardError => error
        warn "  Combined audio unavailable (#{error.message}); using conversation parts"
        preferred_sources = document.css("#view1 audio source[src]").map { |source| URI.join(url, source["src"].gsub(" ", "%20")).to_s }
      end
    end

    if !File.exist?(audio_path) && preferred_sources.length == 1
      begin
        download_file(preferred_sources.first, audio_path)
      rescue StandardError => error
        warn "  Audio unavailable: #{error.message}"
      end
    elsif !File.exist?(audio_path) && preferred_sources.length > 1
      part_dir = File.join(audio_dir, ".parts", id)
      FileUtils.mkdir_p(part_dir)
      parts = preferred_sources.map.with_index do |source_url, part_index|
        part_path = File.join(part_dir, format("%02d.mp3", part_index + 1))
        begin
          download_file(source_url, part_path)
          part_path
        rescue StandardError => error
          warn "  Audio part #{part_index + 1} unavailable: #{error.message}"
          nil
        end
      end.compact
      combine_audio(parts, audio_path) if parts.length > 1
      FileUtils.cp(parts.first, audio_path) if parts.length == 1
    end

    {
      id: id, code: code, level: level, levelName: config[:name], title: title,
      description: description, topic: topic, speakers: speakers,
      youtubeUrl: youtube_id ? "https://www.youtube.com/watch?v=#{youtube_id}" : nil,
      youtubeEmbedUrl: youtube_src, audioUrl: File.exist?(audio_path) ? "/audio/#{level.downcase}/#{audio_filename}" : nil,
      transcriptHtml: clean_html(transcript), grammarHtml: clean_html(grammar), sourceUrl: url
    }
  rescue StandardError => error
    warn "ERROR #{url}: #{error.message}"
    nil
  end.compact

  payload = { level: level, levelName: config[:name], collection: "Natural Conversations", source: config[:index], generatedAt: Time.now.utc.iso8601, lessons: lessons }
  File.write(File.join(DATA_DIR, "#{level.downcase}.json"), JSON.pretty_generate(payload))
  warn "Saved #{lessons.length}/#{entries.length} lessons for #{level}"
  payload
end

targets = ARGV.empty? ? LEVELS.keys : ARGV.map(&:upcase)
payloads = LEVELS.map do |level, config|
  path = File.join(DATA_DIR, "#{level.downcase}.json")
  if targets.include?(level)
    scrape_level(level, config)
  elsif File.exist?(path)
    JSON.parse(File.read(path))
  else
    scrape_level(level, config)
  end
end
all = payloads
File.write(File.join(ROOT, "public", "data", "all-lessons.json"), JSON.pretty_generate({ generatedAt: Time.now.utc.iso8601, levels: all }))
warn "Saved combined dataset with #{all.sum { |payload| payload['lessons']&.length || payload[:lessons].length }} lessons"
