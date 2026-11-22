#!/usr/bin/env ruby

require "fileutils"
require "json"
require "net/http"
require "nokogiri"
require "thread"
require "time"
require "uri"
require "cgi"
require_relative "grammar_generator"

ROOT = File.expand_path("..", __dir__)
DATA_DIR = File.join(ROOT, "public", "data", "videos")
AUDIO_ROOT = File.join(ROOT, "public", "audio", "videos")
FileUtils.mkdir_p(DATA_DIR)
FileUtils.mkdir_p(AUDIO_ROOT)

LEVELS = {
  "A1" => ["Beginner", "A1BEG"], "A2" => ["High-Beginner", "A2BEG"], "B1" => ["Intermediate", "B1INT"],
  "B2" => ["High-Intermediate", "B2INT"], "C1" => ["Advanced", "C1ADV"]
}.freeze

def fetch(url, limit = 4)
  raise "Too many redirects" if limit.zero?
  uri = URI(url)
  request = Net::HTTP::Get.new(uri)
  request["User-Agent"] = "Listeningroom educational prototype"
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.open_timeout = 20; http.read_timeout = 90; http.request(request) }
  return response.body if response.is_a?(Net::HTTPSuccess)
  return fetch(URI.join(url, response["location"]).to_s, limit - 1) if response.is_a?(Net::HTTPRedirection)
  raise "HTTP #{response.code}"
end

def clean_html(node)
  return "" unless node
  clone = node.dup
  clone.css("script, style, iframe, audio, form, button").remove
  clone.css("a").each { |link| link.replace(link.text) }
  clone.css("*").each { |element| element.attribute_nodes.each { |attribute| element.delete(attribute.name) } }
  clone.inner_html.strip
end

def vocabulary_html(doc, lesson_url)
  frame = doc.at_css("#view3 iframe[src]")
  return clean_html(doc.at_css("#view3")) unless frame
  frame_url = URI.join(lesson_url, frame["src"].gsub(" ", "%20")).to_s
  vocab_doc = Nokogiri::HTML(fetch(frame_url))
  cards = vocab_doc.css(".picvocabwrap").map do |card|
    term = card.at_css(".vocab")&.text&.gsub(/\s+/, " ")&.strip
    image = card.at_css("img[src]")
    next if term.to_s.empty?
    image_url = image ? URI.join(frame_url, image["src"].gsub(" ", "%20")).to_s : nil
    image_html = image_url ? "<img src=\"#{CGI.escapeHTML(image_url)}\" alt=\"#{CGI.escapeHTML(term)}\" loading=\"lazy\">" : ""
    "<section class=\"vocab-item\">#{image_html}<h3>#{CGI.escapeHTML(term)}</h3></section>"
  end.compact
  return cards.join unless cards.empty?
  clean_html(doc.at_css("#view3"))
rescue StandardError
  clean_html(doc.at_css("#view3"))
end

def index_entries(level, dir)
  index_url = "https://elllo.org/video/#{dir}/index.htm"
  doc = Nokogiri::HTML(fetch(index_url))
  entries = {}
  doc.css("a[href]").each do |link|
    href = link["href"]
    next unless href&.match?(/\A#{level}-\d{3}-.+\.html?\z/i)
    url = URI.join(index_url, href.gsub(" ", "%20")).to_s
    title = link.text.gsub(/\s+/, " ").strip
    entries[url] = title unless title.empty?
    entries[url] ||= ""
  end
  entries.to_a
end

def scrape_lesson(level, level_name, url, index_title)
  doc = Nokogiri::HTML(fetch(url))
  number = File.basename(URI(url).path)[/#{level}-(\d{3})/i, 1]
  transcript = doc.at_css("#view1 .spacer") || doc.at_css("#view1")
  raise "No transcript" unless transcript
  title = doc.at_css("h1")&.text&.gsub(/\s+/, " ")&.strip
  title = index_title if title.nil? || title.empty?
  speaker_text = doc.at_css(".video-speaker-names")&.text&.gsub(/\s+/, " ")&.strip.to_s
  speakers = speaker_text.split("/").first.to_s.split(/\s*(?:,|&| and )\s*/).reject(&:empty?)
  video_frame = doc.css("iframe[src]").find { |frame| frame["src"].match?(/(?:player\.vimeo\.com|youtube\.com)/i) }
  video_url = video_frame&.[]("src")
  audio_src = doc.at_css(".audio audio source[src]")&.[]("src")
  audio_dir = File.join(AUDIO_ROOT, level.downcase)
  FileUtils.mkdir_p(audio_dir)
  audio_path = File.join(audio_dir, "video-#{level.downcase}-#{number}.mp3")
  File.binwrite(audio_path, fetch(URI.join(url, audio_src.gsub(" ", "%20")).to_s)) if audio_src && (!File.exist?(audio_path) || File.zero?(audio_path))
  {
    id: "video-#{level.downcase}-#{number}", code: "VIDEO-#{number}", level: level, levelName: level_name,
    collection: "videos", title: title, description: "One Minute English video lesson for #{level_name} learners.",
    topic: "One Minute English", speakers: speakers, videoUrl: video_url,
    audioUrl: File.exist?(audio_path) ? "/audio/videos/#{level.downcase}/#{File.basename(audio_path)}" : nil,
    transcriptHtml: clean_html(transcript), vocabularyHtml: vocabulary_html(doc, url),
    grammarHtml: GrammarGenerator.generate(clean_html(transcript)), grammarSource: "ai-generated-from-script", sourceUrl: url
  }
end

targets = ARGV.empty? ? LEVELS.keys : ARGV.map(&:upcase)
payloads = LEVELS.map do |level, (level_name, dir)|
  saved_path = File.join(DATA_DIR, "#{level.downcase}.json")
  next JSON.parse(File.read(saved_path), symbolize_names: true) if !targets.include?(level) && File.exist?(saved_path)
  entries = index_entries(level, dir)
  queue = Queue.new; entries.each_with_index { |entry, index| queue << [index, entry] }
  results = Array.new(entries.length); mutex = Mutex.new
  [8, entries.length].min.times.map do
    Thread.new do
      loop do
        index, (url, title) = queue.pop(true) rescue break
        begin
          results[index] = scrape_lesson(level, level_name, url, title)
          mutex.synchronize { warn "#{level} [#{results.compact.length}/#{entries.length}] #{results[index][:title]}" }
        rescue StandardError => error
          mutex.synchronize { warn "ERROR #{url}: #{error.message}" }
        end
      end
    end
  end.each(&:join)
  payload = { level: level, levelName: level_name, collection: "One Minute English Videos", source: "https://elllo.org/video/#{dir}/index.htm", generatedAt: Time.now.utc.iso8601, lessons: results.compact }
  File.write(saved_path, JSON.pretty_generate(payload)); payload
end

File.write(File.join(ROOT, "public", "data", "one-minute-videos.json"), JSON.pretty_generate({ generatedAt: Time.now.utc.iso8601, levels: payloads }))
warn "Saved #{payloads.sum { |payload| payload[:lessons].length }} One Minute English videos"
