#!/usr/bin/env ruby

require "fileutils"
require "json"
require "net/http"
require "nokogiri"
require "thread"
require "time"
require "uri"

ROOT = File.expand_path("..", __dir__)
DATA_DIR = File.join(ROOT, "public", "data", "videos")
AUDIO_ROOT = File.join(ROOT, "public", "audio", "videos")
FileUtils.mkdir_p(DATA_DIR)
FileUtils.mkdir_p(AUDIO_ROOT)

LEVELS = {
  "A2" => ["High-Beginner", "A2BEG"], "B1" => ["Intermediate", "B1INT"],
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

def sentences(node)
  node.text.gsub(/\s+/, " ").strip.split(/(?<=[.!?])\s+/).select { |line| line.length.between?(18, 240) }
end

def generated_grammar(node)
  lines = sentences(node)
  rules = [
    ["Present simple", /\b(?:do|does|am|is|are|have|has|like|want|need|work|live|think)\b/i, "Dùng hiện tại đơn cho thói quen, sự thật và ý kiến."],
    ["Present continuous", /\b(?:am|is|are|'m|'s|'re)\s+\w+ing\b/i, "Dùng be + V-ing cho hành động đang diễn ra hoặc tình huống tạm thời."],
    ["Past simple", /\b(?:did|was|were|went|had|made|got|saw|took|\w+ed)\b/i, "Dùng quá khứ đơn cho hành động đã hoàn tất trong quá khứ."],
    ["Present perfect", /\b(?:have|has|'ve|'s)\s+(?:been|done|gone|seen|had|\w+ed)\b/i, "Dùng have/has + past participle cho trải nghiệm hoặc kết quả liên quan hiện tại."],
    ["Future forms", /\b(?:will|going to)\b/i, "Dùng will cho quyết định/dự đoán; be going to cho kế hoạch hoặc dự định."],
    ["Modal verbs", /\b(?:can|could|should|would|might|must)\b/i, "Modal + động từ nguyên mẫu diễn tả khả năng, lời khuyên, nghĩa vụ hoặc giả định."],
    ["Conditionals", /\bif\b/i, "Mệnh đề if nêu điều kiện; mệnh đề còn lại cho biết kết quả."],
    ["Comparisons", /\b(?:than|more|less|most|best|better|worse)\b/i, "Dùng comparative với than để so sánh và superlative để nói mức cao nhất."],
    ["Relative clauses", /\b(?:who|which|that|where)\b/i, "Mệnh đề quan hệ bổ sung thông tin cho người, vật hoặc nơi chốn."],
    ["Reason and contrast", /\b(?:because|although|though|but|so)\b/i, "Các từ nối giúp thể hiện nguyên nhân, kết quả hoặc sự tương phản."],
  ]
  chosen = rules.map do |title, pattern, note|
    example = lines.find { |line| line.match?(pattern) }
    [title, note, example] if example
  end.compact.first(5)
  chosen = [["Sentence building", "Quan sát trật tự chủ ngữ + động từ + bổ ngữ trong lời nói tự nhiên.", lines.first]] if chosen.empty?
  intro = '<p class="generated-note">Grammar này được Listeningroom tự tạo từ transcript của bài, không sao chép tab Grammar của ELLLO.</p>'
  intro + chosen.map { |title, note, example| "<section><h3>#{title}</h3><p>#{note}</p><blockquote>#{example}</blockquote></section>" }.join
end

def index_entries(level, dir)
  index_url = "https://elllo.org/video/#{dir}/index.htm"
  doc = Nokogiri::HTML(fetch(index_url))
  entries = {}
  doc.css("a[href]").each do |link|
    href = link["href"]
    next unless href&.match?(/\A#{level}-\d{3}-.+\.htm\z/i)
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
    transcriptHtml: clean_html(transcript), grammarHtml: generated_grammar(transcript), sourceUrl: url
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
