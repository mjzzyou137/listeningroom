#!/usr/bin/env ruby

require "fileutils"
require "json"
require "net/http"
require "nokogiri"
require "open3"
require "thread"
require "time"
require "uri"
require_relative "grammar_generator"

ROOT = File.expand_path("..", __dir__)
DATA_DIR = File.join(ROOT, "public", "data", "natural")
AUDIO_ROOT = File.join(ROOT, "public", "audio", "natural")
YTDLP_PATH = File.join(ROOT, "work", "yt_dlp")
YTDLP_CACHE = File.join(ROOT, "work", "yt_dlp_cache")
FileUtils.mkdir_p(DATA_DIR)
FileUtils.mkdir_p(AUDIO_ROOT)
FileUtils.mkdir_p(YTDLP_CACHE)

LEVELS = {
  "A2" => "High-Beginner", "B1" => "Intermediate",
  "B2" => "High-Intermediate", "C1" => "Advanced"
}.freeze

FEATURED_LESSONS = {
  "B2" => ["https://elllo.org/english/1451/1487-Gyri-Viyasan-HardWork-Talent.htm", "Hard Work vs Talent"],
  "C1" => ["https://elllo.org/english/1451/1493-Rachel-Todd-Expiration.htm", "Throwing Things Out"]
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
  clone.css("script, style, iframe, audio, form, button, .quiz").remove
  clone.css("a").each { |link| link.replace(link.text) }
  clone.css("*").each { |element| element.attribute_nodes.each { |attribute| element.delete(attribute.name) } }
  clone.inner_html.strip
end

def download(url, path)
  return if File.exist?(path) && File.size(path).positive?
  File.binwrite(path, fetch(url))
end

def download_soundcloud(track_id, path)
  return if File.exist?(path) && File.size(path).positive?
  template = path.sub(/\.mp3\z/, ".%(ext)s")
  env = { "PYTHONPATH" => YTDLP_PATH, "XDG_CACHE_HOME" => YTDLP_CACHE }
  command = ["python3", "-m", "yt_dlp", "--no-playlist", "--no-warnings", "--quiet", "-x", "--audio-format", "mp3", "-o", template, "https://api.soundcloud.com/tracks/#{track_id}"]
  _stdout, stderr, status = Open3.capture3(env, *command)
  raise "SoundCloud download failed: #{stderr}" unless status.success? && File.exist?(path)
end

def index_entries(level)
  index_url = "https://elllo.org/levels/views/#{level}-views.html"
  document = Nokogiri::HTML(fetch(index_url))
  entries = document.css("a[href]").each_with_object({}) do |link, result|
    begin
      url = URI.join(index_url, link["href"]).to_s
      next unless url.match?(%r{/english/\d+/[^/]+\.htm$}i)
      title = link.text.gsub(/\s+/, " ").strip
      result[url] = title unless title.empty?
      result[url] ||= ""
    rescue URI::InvalidURIError
      next
    end
  end
  featured = FEATURED_LESSONS[level]
  entries[featured[0]] = featured[1] if featured
  entries.to_a
end

def scrape_lesson(level, level_name, url, index_title)
  document = Nokogiri::HTML(fetch(url))
  number = document.text[/Views\s*#?\s*(\d{3,4})/i, 1] || File.basename(URI(url).path)[/\A(\d{3,4})/, 1]
  raise "Cannot find lesson number" unless number
  id = "natural-#{level.downcase}-#{number}"
  audio_key = "natural-#{number}"
  title = document.at_css("h1")&.text&.gsub(/\s+/, " ")&.strip
  title = index_title if title.nil? || title.empty?
  title = "Likes and Favorites" if level == "A2" && number == "1451"
  title = "Hard Work vs Talent" if level == "B2" && number == "1487"
  description = document.at_css(".lesson2blurb")&.text&.gsub(/\s+/, " ")&.strip
  description ||= document.at_css("meta[name='Description'], meta[name='description']")&.[]("content")
  description ||= "Natural English conversation for #{level_name} learners."
  transcript = document.at_css("#transcript") || document.at_css("#view1 .transcript") || document.at_css("#view1")
  vocabulary = document.at_css("#view2 .vocab") || document.at_css("#view2 .spacer") || document.at_css("#view2")
  speakers = transcript ? transcript.css("p").each_with_object([]) do |paragraph, names|
    name = paragraph.text.gsub(/\s+/, " ").strip[/\A([\p{L} .'-]{1,24}):/, 1]
    names << name if name && !names.include?(name)
  end : []
  youtube_src = document.at_css("iframe[src*='youtube.com']")&.[]("src")
  youtube_id = youtube_src&.match(%r{embed/([^?&/]+)})&.[](1)
  main_source = document.css("audio source[src]").find { |source| !source.ancestors("#view2, #view3, #view4").any? }
  soundcloud_src = document.at_css("iframe[src*='soundcloud.com/player']")&.[]("src")
  audio_dir = File.join(AUDIO_ROOT, level.downcase)
  FileUtils.mkdir_p(audio_dir)
  audio_path = File.join(audio_dir, "#{audio_key}.mp3")
  begin
    if main_source
      download(URI.join(url, main_source["src"]).to_s, audio_path)
    elsif soundcloud_src && (track_id = soundcloud_src[/tracks%?2?F?(\d+)/, 1] || soundcloud_src[/tracks\/(\d+)/, 1])
      download_soundcloud(track_id, audio_path)
    end
  rescue StandardError => error
    warn "  Audio unavailable for #{id}: #{error.message.lines.first&.strip}"
  end
  {
    id: id, code: "VIEWS-#{number}", level: level, levelName: level_name,
    collection: "natural", title: title, description: description,
    topic: "Natural English Conversation", speakers: speakers,
    youtubeUrl: youtube_id ? "https://www.youtube.com/watch?v=#{youtube_id}" : nil,
    audioUrl: File.exist?(audio_path) ? "/audio/natural/#{level.downcase}/#{audio_key}.mp3" : nil,
    transcriptHtml: clean_html(transcript), vocabularyHtml: clean_html(vocabulary),
    grammarHtml: GrammarGenerator.generate(clean_html(transcript)), sourceUrl: url
  }
end

targets = ARGV.empty? ? LEVELS.keys : ARGV.map(&:upcase)
payloads = LEVELS.map do |level, level_name|
  saved_path = File.join(DATA_DIR, "#{level.downcase}.json")
  next JSON.parse(File.read(saved_path)) if !targets.include?(level) && File.exist?(saved_path)
  entries = index_entries(level)
  queue = Queue.new
  entries.each_with_index { |entry, index| queue << [index, entry] }
  results = Array.new(entries.length)
  mutex = Mutex.new
  workers = [8, entries.length].min.times.map do
    Thread.new do
      loop do
        begin
          index, (url, title) = queue.pop(true)
        rescue ThreadError
          break
        end
        begin
          result = scrape_lesson(level, level_name, url, title)
          results[index] = result
          mutex.synchronize { warn "#{level} [#{results.compact.length}/#{entries.length}] #{result[:code]} #{result[:title]}" }
        rescue StandardError => error
          mutex.synchronize { warn "ERROR #{url}: #{error.message}" }
        end
      end
    end
  end
  workers.each(&:join)
  lessons = results.compact.uniq { |lesson| lesson[:id] }
  payload = { level: level, levelName: level_name, collection: "Natural Conversations", source: "https://elllo.org/levels/views/#{level}-views.html", generatedAt: Time.now.utc.iso8601, lessons: lessons }
  File.write(File.join(DATA_DIR, "#{level.downcase}.json"), JSON.pretty_generate(payload))
  warn "Saved #{lessons.length}/#{entries.length} Natural Conversations for #{level}"
  payload
end

File.write(File.join(ROOT, "public", "data", "natural-conversations.json"), JSON.pretty_generate({ generatedAt: Time.now.utc.iso8601, levels: payloads }))
warn "Saved #{payloads.sum { |payload| (payload[:lessons] || payload["lessons"]).length }} Natural Conversations"
