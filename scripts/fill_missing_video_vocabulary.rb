#!/usr/bin/env ruby

require "cgi"
require "json"
require "nokogiri"

ROOT = File.expand_path("..", __dir__)
PATH = File.join(ROOT, "public", "data", "one-minute-videos.json")
payload = JSON.parse(File.read(PATH))
stopwords = %w[about after again also and are because been before being but can could did does doing for from had has have her here him his how into its just like more much not now one only our out over really said she some than that the their them then there they thing this very want was were what when where which who why will with would you your]
generated = 0

payload["levels"].each do |level|
  level["lessons"].each do |lesson|
    next unless lesson["vocabularyHtml"].to_s.strip.empty?
    fragment = Nokogiri::HTML.fragment(lesson["transcriptHtml"].to_s)
    terms = fragment.css("span").map { |node| node.text.gsub(/\s+/, " ").strip }.reject(&:empty?).uniq
    if terms.length < 5
      words = fragment.text.downcase.scan(/[a-z][a-z'-]{3,}/).reject { |word| stopwords.include?(word) }
      counts = words.each_with_object(Hash.new(0)) { |word, result| result[word] += 1 }
      frequencies = counts.sort_by { |word, count| [-count, word] }.map(&:first)
      terms = (terms + frequencies).uniq.first(8)
    else
      terms = terms.first(8)
    end
    lesson["vocabularyHtml"] = terms.map { |term| "<section class=\"vocab-item text-only\"><h3>#{CGI.escapeHTML(term)}</h3></section>" }.join
    lesson["vocabularySource"] = "generated-from-script"
    generated += 1
  end
end

File.write(PATH, JSON.pretty_generate(payload))
warn "Generated Vocabulary for #{generated} video lessons"
