#!/usr/bin/env ruby

require "cgi"
require "json"
require "nokogiri"
require_relative "grammar_generator"

ROOT = File.expand_path("..", __dir__)
levels_path = File.join(ROOT, "public", "data", "all-lessons.json")
natural_path = File.join(ROOT, "public", "data", "natural-conversations.json")
levels = JSON.parse(File.read(levels_path))
natural = JSON.parse(File.read(natural_path))
source = levels["levels"].find { |level| level["level"] == "A1" }
raise "A1 source not found" unless source

stopwords = %w[about after again also and are because been before being but can could did does doing for from had has have her here him his how into its just like more much not now one only our out over really said she some than that the their them then there they thing this very want was were what when where which who why will with would you your]
lessons = source["lessons"].map do |original|
  lesson = Marshal.load(Marshal.dump(original))
  lesson["id"] = "natural-a1-#{original["id"]}"
  lesson["collection"] = "natural"
  lesson["topic"] = "Natural English Conversation"
  lesson["grammarHtml"] = GrammarGenerator.generate(lesson["transcriptHtml"])
  lesson["grammarSource"] = "ai-generated-from-script"
  text = Nokogiri::HTML.fragment(lesson["transcriptHtml"].to_s).text.downcase
  words = text.scan(/[a-z][a-z'-]{3,}/).reject { |word| stopwords.include?(word) }
  counts = words.each_with_object(Hash.new(0)) { |word, result| result[word] += 1 }
  terms = counts.sort_by { |word, count| [-count, word] }.first(8).map(&:first)
  lesson["vocabularyHtml"] = terms.map { |term| "<section class=\"vocab-item text-only\"><h3>#{CGI.escapeHTML(term)}</h3></section>" }.join
  lesson["vocabularySource"] = "generated-from-script"
  lesson
end

natural["levels"].reject! { |level| level["level"] == "A1" }
natural["levels"].unshift({
  "level" => "A1", "levelName" => "Beginner", "collection" => "Natural Conversations",
  "source" => source["source"], "lessons" => lessons
})
File.write(natural_path, JSON.pretty_generate(natural))
warn "Added #{lessons.length} A1 Natural Conversations"
