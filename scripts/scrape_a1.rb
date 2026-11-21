#!/usr/bin/env ruby

require "fileutils"
require "json"
require "net/http"
require "nokogiri"
require "uri"
require "time"

ROOT = File.expand_path("..", __dir__)
INDEX_URL = "https://elllo.org/english/grammar/A1-00-Grammar-Lessons.htm"
OUTPUT_JSON = File.join(ROOT, "public", "data", "a1-lessons.json")
AUDIO_DIR = File.join(ROOT, "public", "audio", "a1")

FileUtils.mkdir_p(File.dirname(OUTPUT_JSON))
FileUtils.mkdir_p(AUDIO_DIR)

def fetch(url, limit = 5)
  raise "Too many redirects for #{url}" if limit.zero?

  uri = URI(url)
  request = Net::HTTP::Get.new(uri)
  request["User-Agent"] = "ELLLO A1 learning app prototype (educational mirror)"
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
    http.open_timeout = 15
    http.read_timeout = 45
    http.request(request)
  end

  case response
  when Net::HTTPSuccess
    response.body
  when Net::HTTPRedirection
    fetch(URI.join(url, response["location"]).to_s, limit - 1)
  else
    raise "HTTP #{response.code} for #{url}"
  end
end

def clean_html(node)
  return "" unless node

  clone = node.dup
  clone.css("script, style, iframe, audio, form, button").remove
  clone.css("*").each do |element|
    element.attribute_nodes.each { |attribute| element.delete(attribute.name) }
  end
  clone.inner_html.strip
end

index = Nokogiri::HTML(fetch(INDEX_URL))
lesson_links_by_url = index.css("a[href]").each_with_object({}) do |link, links|
  href = link["href"]
  next unless href && href.match?(%r{A1-(?!00|16)[0-9]{2}-.+\.htm$}i)

  url = URI.join(INDEX_URL, href).to_s
  candidate_title = link.text.gsub(/\s+/, " ").strip
  links[url] = candidate_title unless candidate_title.empty?
  links[url] ||= ""
end
lesson_links = lesson_links_by_url.to_a

lessons = lesson_links.map.with_index do |(url, index_title), index_number|
  warn "[#{index_number + 1}/#{lesson_links.length}] #{url}"
  document = Nokogiri::HTML(fetch(url))

  lesson_id = url[%r{/A1-([0-9]{2})-}, 1]
  code = "A1-#{lesson_id}"
  iframe_src = document.at_css("iframe[src*='youtube.com']")&.[]("src")
  youtube_id = iframe_src&.match(%r{embed/([^?&/]+)})&.[](1)
  audio_src = document.at_css("audio source")&.[]("src")
  audio_url = audio_src && URI.join(url, audio_src).to_s
  soundcloud_url = document.at_css("iframe[src*='soundcloud.com/player']")&.[]("src")
  audio_filename = "#{code.downcase}.mp3"
  audio_path = File.join(AUDIO_DIR, audio_filename)

  if audio_url && !File.exist?(audio_path)
    File.binwrite(audio_path, fetch(audio_url))
  end

  transcript = document.at_css("#transcript")
  grammar = document.at_css("#view2 .spacer") || document.at_css("#view2")
  speakers = transcript ? transcript.css("p").each_with_object([]) do |paragraph, names|
    name = paragraph.text.gsub(/\s+/, " ").strip[/\A([\p{L} .'-]{1,24}):/, 1]
    names << name if name && !names.include?(name)
  end : []
  title = document.at_css(".lessonpromo h1")&.text&.gsub(/\s+/, " ")&.strip
  blurb = document.at_css(".lesson2blurb")&.text&.gsub(/\s+/, " ")&.strip
  grammar_title = grammar&.at_css("p strong")&.text&.gsub(/\s+/, " ")&.strip

  {
    id: code.downcase,
    code: code,
    title: title.nil? || title.empty? ? index_title : title,
    description: blurb || "Natural English conversation for A1 learners.",
    topic: grammar_title || "Beginner grammar",
    speakers: speakers,
    youtubeUrl: youtube_id ? "https://www.youtube.com/watch?v=#{youtube_id}" : nil,
    youtubeEmbedUrl: iframe_src,
    audioUrl: File.exist?(audio_path) ? "/audio/a1/#{audio_filename}" : nil,
    originalAudioUrl: audio_url || soundcloud_url,
    transcriptHtml: clean_html(transcript),
    grammarHtml: clean_html(grammar),
    sourceUrl: url
  }
end.sort_by { |lesson| lesson[:code] }

payload = {
  level: "A1",
  levelName: "Beginner",
  collection: "Natural Conversations",
  source: INDEX_URL,
  generatedAt: Time.now.utc.iso8601,
  lessons: lessons
}

File.write(OUTPUT_JSON, JSON.pretty_generate(payload))
warn "Saved #{lessons.length} lessons to #{OUTPUT_JSON}"
