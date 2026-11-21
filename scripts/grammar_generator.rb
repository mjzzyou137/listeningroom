require "cgi"
require "nokogiri"

module GrammarGenerator
  RULES = [
    ["Present simple", /\b(?:do|does|am|is|are|have|has|like|want|need|work|live|think|usually|always|often)\b/i, "Dùng hiện tại đơn để diễn tả thói quen, sự thật và ý kiến."],
    ["Present continuous", /\b(?:am|is|are|'m|'s|'re)\s+(?:\w+ing)\b/i, "Dùng be + V-ing cho hành động đang diễn ra hoặc tình huống tạm thời."],
    ["Past simple", /\b(?:did|was|were|went|had|made|got|saw|took|came|said|\w+ed)\b/i, "Dùng quá khứ đơn cho hành động hoặc trạng thái đã kết thúc trong quá khứ."],
    ["Past continuous", /\b(?:was|were)\s+\w+ing\b/i, "Dùng was/were + V-ing cho hành động đang diễn ra tại một thời điểm trong quá khứ."],
    ["Present perfect", /\b(?:have|has|'ve|'s)\s+(?:been|done|gone|seen|had|made|\w+ed)\b/i, "Dùng have/has + past participle cho trải nghiệm hoặc kết quả còn liên quan đến hiện tại."],
    ["Future forms", /\b(?:will|going to|'ll)\b/i, "Dùng will cho quyết định hoặc dự đoán; be going to cho kế hoạch và dự định."],
    ["Modal verbs", /\b(?:can|could|should|would|might|must|may)\b/i, "Modal + động từ nguyên mẫu diễn tả khả năng, lời khuyên, nghĩa vụ hoặc giả định."],
    ["Conditionals", /\bif\b/i, "Mệnh đề if nêu điều kiện; mệnh đề còn lại cho biết kết quả hoặc hệ quả."],
    ["Comparisons", /\b(?:than|more|less|most|least|best|better|worse)\b/i, "Dùng dạng so sánh để đối chiếu người, vật, ý tưởng hoặc mức độ."],
    ["Relative clauses", /\b(?:who|which|that|where|whose)\b/i, "Mệnh đề quan hệ bổ sung thông tin cho người, vật hoặc nơi chốn."],
    ["Gerunds and infinitives", /\b(?:enjoy|like|love|hate|start|stop)\s+\w+ing\b|\b(?:want|need|plan|hope|try)\s+to\s+\w+/i, "V-ing và to + verb thường theo sau một số động từ để nói về hoạt động hoặc mục đích."],
    ["Reason, result and contrast", /\b(?:because|although|though|however|but|so)\b/i, "Các từ nối giúp thể hiện nguyên nhân, kết quả hoặc sự tương phản giữa các ý."],
  ].freeze

  def self.generate(transcript_html)
    text = Nokogiri::HTML.fragment(transcript_html.to_s).text.gsub(/\s+/, " ").strip
    sentences = text.split(/(?<=[.!?])\s+/).map { |sentence| sentence.sub(/\A[\p{L} .'-]{1,24}:\s*/, "") }.select { |sentence| sentence.length.between?(18, 260) }
    points = RULES.map do |title, pattern, explanation|
      example = sentences.find { |sentence| sentence.match?(pattern) }
      [title, explanation, example] if example
    end.compact.first(5)
    points = [["Sentence structure", "Quan sát trật tự chủ ngữ + động từ + bổ ngữ trong câu tiếng Anh tự nhiên.", sentences.first || text]] if points.empty?
    note = '<p class="generated-note">Grammar này được Listeningroom tự phân tích từ Script của bài.</p>'
    note + points.map do |title, explanation, example|
      "<section><h3>#{CGI.escapeHTML(title)}</h3><p>#{CGI.escapeHTML(explanation)}</p><blockquote>#{CGI.escapeHTML(example)}</blockquote></section>"
    end.join
  end
end
