import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Icon from '../components/Icon';
import { diffTranslation } from '../utils/diffTranslation';

export default function TranslationPage({ lessonId, levelFilter = 'ALL' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState(levelFilter || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [userInput, setUserInput] = useState('');
  const [alwaysShowAnswer, setAlwaysShowAnswer] = useState(() => {
    try {
      return localStorage.getItem('openear-translation-always-show-answer') === 'true';
    } catch {
      return false;
    }
  });
  const [showAnswer, setShowAnswer] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('openear-translation-history');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const textareaRef = useRef(null);

  // Toggle "Luôn hiện đáp án" setting
  const toggleAlwaysShowAnswer = (checked) => {
    setAlwaysShowAnswer(checked);
    try {
      localStorage.setItem('openear-translation-always-show-answer', String(checked));
    } catch (e) {}

    if (currentLesson) {
      if (checked) {
        setUserInput(currentLesson.answer);
        setDiffResult(null);
      } else {
        let saved = history[currentLesson.id];
        if (!saved && currentLesson.legacyIds) {
          for (const oldId of currentLesson.legacyIds) {
            if (history[oldId]) {
              saved = history[oldId];
              break;
            }
          }
        }
        setUserInput(saved ? (saved.input || '') : '');
        setDiffResult(saved ? (saved.diff || null) : null);
      }
    }
  };

  // Load data
  useEffect(() => {
    fetch('/data/translation-practice.json?v=20261123_400')
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải dữ liệu luyện dịch');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Update levelFilter if prop changes
  useEffect(() => {
    if (levelFilter) {
      setSelectedLevel(levelFilter.toUpperCase());
    }
  }, [levelFilter]);

  // Current lesson if in detail view
  const currentLesson = useMemo(() => {
    if (!data || !lessonId) return null;
    return (
      data.lessons.find(
        (l) =>
          l.id === lessonId ||
          String(l.number) === lessonId ||
          (l.legacyIds && l.legacyIds.includes(lessonId))
      ) || null
    );
  }, [data, lessonId]);

  // Load saved input and diff when lesson changes
  useEffect(() => {
    if (currentLesson) {
      document.title = `Bài ${currentLesson.number}: ${currentLesson.title} · Luyện dịch Listeningroom`;
      let saved = history[currentLesson.id];
      if (!saved && currentLesson.legacyIds) {
        for (const oldId of currentLesson.legacyIds) {
          if (history[oldId]) {
            saved = history[oldId];
            break;
          }
        }
      }
      if (alwaysShowAnswer) {
        setUserInput(currentLesson.answer);
        setDiffResult(null);
      } else if (saved) {
        setUserInput(saved.input || '');
        setDiffResult(saved.diff || null);
      } else {
        setUserInput('');
        setDiffResult(null);
      }
      setShowAnswer(false);
    } else {
      document.title = 'Luyện dịch 400 bài khóa tiếng Anh theo chủ đề · Listeningroom';
    }
  }, [currentLesson, alwaysShowAnswer]);

  // Save history to localStorage
  const saveProgress = (id, input, diff) => {
    const next = {
      ...history,
      [id]: {
        input,
        diff,
        completedAt: new Date().toISOString()
      }
    };
    setHistory(next);
    try {
      localStorage.setItem('openear-translation-history', JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  // Check translation
  const handleCheck = () => {
    if (!currentLesson) return;
    const result = diffTranslation(userInput, currentLesson.answer);
    setDiffResult(result);
    saveProgress(currentLesson.id, userInput, result);
  };

  // Keyboard shortcut: Enter to check translation
  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim()) {
        handleCheck();
      }
    }
  };

  // Reset lesson
  const handleReset = () => {
    setUserInput(alwaysShowAnswer && currentLesson ? currentLesson.answer : '');
    setDiffResult(null);
    setShowAnswer(false);
    if (currentLesson) {
      const next = { ...history };
      delete next[currentLesson.id];
      setHistory(next);
      try {
        localStorage.setItem('openear-translation-history', JSON.stringify(next));
      } catch {}
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Insert hint chip into textarea
  const handleInsertHint = (hintText) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart || userInput.length;
    const end = textareaRef.current.selectionEnd || userInput.length;
    const textBefore = userInput.substring(0, start);
    const textAfter = userInput.substring(end);
    const spacingBefore = textBefore.length > 0 && !textBefore.endsWith(' ') ? ' ' : '';
    const spacingAfter = textAfter.length > 0 && !textAfter.startsWith(' ') ? ' ' : '';
    const nextText = `${textBefore}${spacingBefore}${hintText}${spacingAfter}${textAfter}`;
    setUserInput(nextText);
    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = start + spacingBefore.length + hintText.length + spacingAfter.length;
        textareaRef.current.selectionStart = nextPos;
        textareaRef.current.selectionEnd = nextPos;
        textareaRef.current.focus();
      }
    }, 50);
  };

  // Text-to-speech for model answer
  const handleSpeak = (text) => {
    if (!window.speechSynthesis) {
      alert('Trình duyệt không hỗ trợ phát âm.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Navigation: prev / next lesson
  const { prevLesson, nextLesson } = useMemo(() => {
    if (!data || !currentLesson) return { prevLesson: null, nextLesson: null };
    const idx = data.lessons.findIndex((l) => l.id === currentLesson.id);
    return {
      prevLesson: idx > 0 ? data.lessons[idx - 1] : null,
      nextLesson: idx < data.lessons.length - 1 ? data.lessons[idx + 1] : null
    };
  }, [data, currentLesson]);

  // Filter lessons in list view
  const filteredLessons = useMemo(() => {
    if (!data) return [];
    return data.lessons.filter((l) => {
      const matchLevel = selectedLevel === 'ALL' || l.level === selectedLevel;
      const matchSearch =
        !searchQuery.trim() ||
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.vietnamese.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.hintsText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `bài ${l.number}`.includes(searchQuery.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [data, selectedLevel, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, avgScore: 0 };
    const total = data.totalLessons || data.lessons.length;
    let completed = 0;
    let totalScore = 0;
    data.lessons.forEach((l) => {
      let saved = history[l.id]?.diff;
      if (!saved && l.legacyIds) {
        for (const oldId of l.legacyIds) {
          if (history[oldId]?.diff) {
            saved = history[oldId].diff;
            break;
          }
        }
      }
      if (saved) {
        completed++;
        totalScore += (saved.score || 0);
      }
    });
    const avgScore = completed > 0 ? Math.round(totalScore / completed) : 0;
    return { total, completed, avgScore };
  }, [data, history]);

  if (loading) {
    return (
      <div id="app">
        <Header collection="translation" level="A1" />
        <div className="loading">Đang tải dữ liệu 400 bài luyện dịch…</div>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div id="app">
        <Header collection="translation" level="A1" />
        <main className="not-found">
          <h1>Không thể tải dữ liệu luyện dịch</h1>
          <a className="primary-button" href="#/">
            Về trang chủ
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  // ==========================================
  // RENDER: DETAIL VIEW (WORKSHEET)
  // ==========================================
  if (currentLesson) {
    const wordCount = userInput.trim() ? userInput.trim().split(/\s+/).length : 0;
    const badgeClass = currentLesson.level.toLowerCase();

    return (
      <div id="app">
        <Header collection="translation" level={currentLesson.level} />

        <main className="translation-container">
          <nav className="worksheet-top-nav">
            <a className="worksheet-back-btn" href="#/translation">
              <Icon name="arrow-left" /> Danh sách 400 bài luyện dịch
            </a>
            <div className="worksheet-nav-arrows">
              {prevLesson ? (
                <a
                  className="worksheet-arrow-btn"
                  href={`#/translation/lesson/${prevLesson.id}`}
                  title={`Bài ${prevLesson.number}: ${prevLesson.title}`}
                >
                  <Icon name="arrow-left" /> Bài {prevLesson.number}
                </a>
              ) : (
                <span className="worksheet-arrow-btn disabled">
                  <Icon name="arrow-left" /> Bài trước
                </span>
              )}
              {nextLesson ? (
                <a
                  className="worksheet-arrow-btn"
                  href={`#/translation/lesson/${nextLesson.id}`}
                  title={`Bài ${nextLesson.number}: ${nextLesson.title}`}
                >
                  Bài {nextLesson.number} <Icon name="arrow-right" />
                </a>
              ) : (
                <span className="worksheet-arrow-btn disabled">
                  Bài sau <Icon name="arrow-right" />
                </span>
              )}
            </div>
          </nav>

          {/* Worksheet Sheet (Matching Image 1) */}
          <article className="worksheet-sheet">
            <header className="worksheet-sheet-header">
              <div className="worksheet-sheet-title">
                <h2>
                  Bài {currentLesson.number}: {currentLesson.title}
                </h2>
                <div className="worksheet-sheet-meta">
                  <span className={`translation-badge ${badgeClass}`}>
                    Cấp {currentLesson.level}
                  </span>
                  <span>Trọng tâm: {currentLesson.levelFocus}</span>
                </div>
              </div>
            </header>

            {/* Prompt: Vietnamese paragraph */}
            <div className="worksheet-prompt-section">
              <div className="worksheet-section-label">
                <Icon name="book" /> Tiếng Việt:
              </div>
              <div className="worksheet-vn-box">
                {currentLesson.vietnamese}
              </div>

              {/* Hints */}
              {currentLesson.hints && currentLesson.hints.length > 0 && (
                <div className="worksheet-hints-box">
                  <div className="hints-title">Từ gợi ý (bấm để chèn vào bài làm):</div>
                  <div className="worksheet-hint-chips">
                    {currentLesson.hints.map((h, i) => (
                      <button
                        type="button"
                        key={i}
                        className="hint-chip"
                        onClick={() => handleInsertHint(h.en)}
                        title={`Bấm để chèn "${h.en}" vào bài làm`}
                      >
                        <strong>{h.en}</strong>
                        {h.vi && <span>({h.vi})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Writing Section (Ruled textarea matching Image 1) */}
            <div className="worksheet-write-section">
              <div className="worksheet-section-header-flex">
                <div className="worksheet-section-label">
                  <Icon name="edit" /> Viết bản tiếng Anh của bạn:
                </div>
                <label
                  className="translation-checkbox-label"
                  title="Khi bật, khi vào chi tiết các bài học sẽ luôn hiển thị sẵn đáp án trong ô nhập này"
                >
                  <input
                    type="checkbox"
                    checked={alwaysShowAnswer}
                    onChange={(e) => toggleAlwaysShowAnswer(e.target.checked)}
                  />
                  <span>Hiện đáp án</span>
                </label>
              </div>

              <div className="ruled-textarea-container">
                <textarea
                  ref={textareaRef}
                  className="ruled-textarea"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Nhập bản dịch tiếng Anh của bạn tại đây... (Ví dụ: Hello! My name is Minh...)"
                  rows={6}
                />
                <div className="textarea-footer-info">
                  <span>{wordCount} từ đã nhập</span>
                  <span>Nhấn <strong>Enter</strong> để kiểm tra bài dịch · <strong>Shift + Enter</strong> để xuống dòng</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="worksheet-actions">
                <button
                  type="button"
                  className="btn-check-translation"
                  onClick={handleCheck}
                  disabled={!userInput.trim()}
                >
                  <Icon name="check" /> Kiểm tra bài dịch
                </button>

                <button
                  type="button"
                  className="btn-toggle-answer"
                  onClick={() => setShowAnswer(!showAnswer)}
                >
                  <Icon name={showAnswer ? 'eye-off' : 'eye'} />
                  {showAnswer ? 'Ẩn đáp án mẫu' : 'Xem đáp án mẫu'}
                </button>

                {userInput && (
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={handleReset}
                  >
                    <Icon name="refresh" /> Làm lại
                  </button>
                )}

                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => handleSpeak(currentLesson.answer)}
                  title="Nghe giọng đọc mẫu phát âm tiếng Anh"
                >
                  <Icon name="volume" /> Nghe phát âm mẫu
                </button>
              </div>

              {/* ================================================= */}
              {/* CLEAN INLINE DIFF RESULTS (Matching Image 1)      */}
              {/* ================================================= */}
              {diffResult && (() => {
                const userTokens =
                  diffResult.userTokens ||
                  (diffResult.tokens
                    ? diffResult.tokens
                        .filter((t) => t.word !== undefined)
                        .map((t) => ({
                          word: t.word,
                          isCorrect: t.type === 'correct',
                          expected: t.expected || null
                        }))
                    : []);

                const modelTokens =
                  diffResult.modelTokens ||
                  (currentLesson.answer
                    ? currentLesson.answer.trim().split(/\s+/).map((w) => ({ word: w, matched: true }))
                    : []);

                return (
                  <section className="diff-results-card">
                    <div className="diff-score-banner">
                      <div className="diff-score-badge">
                        <div
                          className={`score-circle ${
                            diffResult.score >= 80
                              ? 'high'
                              : diffResult.score >= 50
                              ? 'medium'
                              : 'low'
                          }`}
                        >
                          {diffResult.score}%
                        </div>
                        <div className="score-text">
                          <strong>
                            {diffResult.score >= 90
                              ? 'Xuất sắc! Bản dịch rất chuẩn xác 🎉'
                              : diffResult.score >= 75
                              ? 'Rất tốt! Cố gắng phát huy nhé 👏'
                              : diffResult.score >= 50
                              ? 'Khá tốt! Hãy xem lại các từ màu đỏ nhé 💪'
                              : 'Cố gắng lên! Hãy đối chiếu đáp án mẫu để học thêm 📖'}
                          </strong>
                          <span>
                            Đúng {diffResult.correctCount} / {diffResult.totalModelWords} từ mẫu ({diffResult.userWordCount} từ đã viết)
                          </span>
                        </div>
                      </div>

                      <div className="diff-legend">
                        <div className="diff-legend-item">
                          <span className="legend-dot green" />
                          <span>Từ đúng</span>
                        </div>
                        <div className="diff-legend-item">
                          <span className="legend-fix-badge">
                            <del>sai</del> ➔ đúng
                          </span>
                          <span>Từ cần sửa</span>
                        </div>
                        <div className="diff-legend-item">
                          <span className="legend-dot red" />
                          <span>Từ còn thiếu</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 1: Bạn viết (Matching Image 1 with inline corrections) */}
                    <div className="diff-block diff-block-user">
                      <div className="diff-block-header">
                        <span className="diff-block-label">Bạn viết</span>
                        {diffResult.hasMore && (
                          <span className="diff-incomplete-pill">Chưa dịch hết đoạn văn</span>
                        )}
                      </div>
                      <div className="diff-prose diff-user-prose">
                        {(diffResult.tokens || []).map((tok, idx) => {
                          if (tok.type === 'correct') {
                            return (
                              <span
                                key={idx}
                                className="diff-word word-correct"
                                title="Chính xác"
                              >
                                {tok.word}{' '}
                              </span>
                            );
                          }
                          if (tok.type === 'wrong_word') {
                            return (
                              <span
                                key={idx}
                                className="diff-correction-pair"
                                title={`Bạn viết: "${tok.word}" ➔ Đáp án chuẩn: "${tok.expected}"`}
                              >
                                <del className="diff-wrong-val">{tok.word}</del>
                                <span className="diff-arrow">➔</span>
                                <span className="diff-correct-val">{tok.expected}</span>
                                {' '}
                              </span>
                            );
                          }
                          if (tok.type === 'incorrect') {
                            return (
                              <span
                                key={idx}
                                className="diff-word word-extra"
                                title={`Từ thừa không cần thiết: "${tok.word}"`}
                              >
                                <del>{tok.word}</del>{' '}
                              </span>
                            );
                          }
                          if (tok.type === 'missing') {
                            return (
                              <span
                                key={idx}
                                className="diff-word word-missing"
                                title={`Bạn bị thiếu từ: "${tok.expected}"`}
                              >
                                {tok.expected}{' '}
                              </span>
                            );
                          }
                          return null;
                        })}
                        {diffResult.hasMore && (
                          <span className="diff-remaining-ellipsis" title="Còn các câu tiếp theo chưa dịch">…</span>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Đáp án chuẩn (Matching Image 1 clean style) */}
                    <div className="diff-block diff-block-model">
                      <div className="diff-block-header">
                        <span className="diff-block-label">Đáp án chuẩn</span>
                        <div className="diff-block-actions">
                          <button
                            type="button"
                            className="btn-inline-action"
                            onClick={() => handleSpeak(currentLesson.answer)}
                            title="Nghe phát âm đáp án chuẩn"
                          >
                            <Icon name="volume" /> Nghe đọc
                          </button>
                          <button
                            type="button"
                            className="btn-inline-action"
                            onClick={() => {
                              navigator.clipboard.writeText(currentLesson.answer);
                              alert('Đã sao chép đáp án chuẩn!');
                            }}
                            title="Sao chép đáp án chuẩn"
                          >
                            <Icon name="copy" /> Sao chép
                          </button>
                        </div>
                      </div>
                      <div className="diff-prose diff-model-prose">
                        {modelTokens.map((tok, idx) => (
                          <span
                            key={idx}
                            className={`diff-model-word ${tok.matched ? 'model-matched' : 'model-missing'}`}
                            title={tok.matched ? 'Bạn đã viết đúng từ này' : 'Từ bạn còn thiếu'}
                          >
                            {tok.word}{' '}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Model Answer Reveal Box */}
              {showAnswer && (
                <div className="model-answer-reveal">
                  <div className="model-answer-header">
                    <div className="model-answer-title">
                      <Icon name="check-circle" /> Đáp án mẫu chuẩn (English Model Answer)
                    </div>
                    <div className="model-answer-actions">
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => handleSpeak(currentLesson.answer)}
                      >
                        <Icon name="volume" /> Nghe đọc
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => {
                          navigator.clipboard.writeText(currentLesson.answer);
                          alert('Đã sao chép đáp án mẫu vào clipboard!');
                        }}
                      >
                        <Icon name="copy" /> Sao chép
                      </button>
                    </div>
                  </div>
                  <div className="model-answer-text">{currentLesson.answer}</div>
                  <p className="model-answer-note">
                    💡 <em>Lời khuyên:</em> Đáp án là bản mẫu chuẩn: câu của bạn có thể khác cách diễn đạt nhưng nếu đúng nghĩa và đúng ngữ pháp thì vẫn hoàn toàn chính xác. Hãy đọc to bản đáp án 2–3 lần cho quen miệng!
                  </p>
                </div>
              )}
            </div>
          </article>
        </main>
        <Footer />
      </div>
    );
  }

  // ==========================================
  // RENDER: LIST VIEW (HUB OF 90 LESSONS)
  // ==========================================
  return (
    <div id="app">
      <Header collection="translation" level="A1" />

      <main className="translation-container">
        {/* Hero Section */}
        <section className="translation-hero">
          <span className="translation-hero-badge">400 CHỦ ĐỀ · TỪ DỄ ĐẾN KHÓ</span>
          <h1>Luyện Dịch 400 Bài Khóa Tiếng Anh</h1>
          <p>
            Luyện tập chuyển ngữ từ tiếng Việt sang tiếng Anh theo 400 bài khóa qua 4 phần từ A1 đến B2. Tự viết bản dịch vào dòng kẻ, kiểm tra đối chiếu từng từ đúng/sai và rèn luyện phản xạ ngữ pháp tự nhiên.
          </p>
          <div className="translation-stats-row">
            <div className="translation-stat-pill">
              <Icon name="book" />
              <span>
                Tổng số bài: <strong>{stats.total} bài</strong>
              </span>
            </div>
            <div className="translation-stat-pill">
              <Icon name="check-circle" />
              <span>
                Đã hoàn thành: <strong>{stats.completed} bài</strong>
              </span>
            </div>
            {stats.completed > 0 && (
              <div className="translation-stat-pill">
                <Icon name="star" />
                <span>
                  Độ chính xác TB: <strong>{stats.avgScore}%</strong>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Navigation Filters & Search */}
        <div className="translation-nav-bar">
          <div className="translation-level-tabs">
            <button
              type="button"
              className={`translation-level-tab ${selectedLevel === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedLevel('ALL')}
            >
              Tất cả (400)
            </button>
            <button
              type="button"
              className={`translation-level-tab ${selectedLevel === 'A1' ? 'active' : ''}`}
              onClick={() => setSelectedLevel('A1')}
            >
              Phần 1 · Cấp A1 (Bài 1–100)
            </button>
            <button
              type="button"
              className={`translation-level-tab ${selectedLevel === 'A2' ? 'active' : ''}`}
              onClick={() => setSelectedLevel('A2')}
            >
              Phần 2 · Cấp A2 (Bài 101–200)
            </button>
            <button
              type="button"
              className={`translation-level-tab ${selectedLevel === 'B1' ? 'active' : ''}`}
              onClick={() => setSelectedLevel('B1')}
            >
              Phần 3 · Cấp B1 (Bài 201–300)
            </button>
            <button
              type="button"
              className={`translation-level-tab ${selectedLevel === 'B2' ? 'active' : ''}`}
              onClick={() => setSelectedLevel('B2')}
            >
              Phần 4 · Cấp B2 (Bài 301–400)
            </button>
          </div>

          <div className="translation-nav-right">
            <label
              className="translation-checkbox-label"
              title="Khi bật, khi vào chi tiết các bài học sẽ luôn hiển thị sẵn đáp án mẫu"
            >
              <input
                type="checkbox"
                checked={alwaysShowAnswer}
                onChange={(e) => toggleAlwaysShowAnswer(e.target.checked)}
              />
              <span>Hiện đáp án</span>
            </label>

            <div className="translation-search-box">
              <Icon name="search" />
              <input
                type="text"
                placeholder="Tìm theo chủ đề, từ gợi ý, số bài..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Lesson Cards Grid */}
        <div className="translation-grid">
          {filteredLessons.map((l) => {
            const badgeClass = l.level.toLowerCase();
            let prevResult = history[l.id]?.diff;
            if (!prevResult && l.legacyIds) {
              for (const oldId of l.legacyIds) {
                if (history[oldId]?.diff) {
                  prevResult = history[oldId].diff;
                  break;
                }
              }
            }
            const isCompleted = Boolean(prevResult);

            return (
              <a
                key={l.id}
                href={`#/translation/lesson/${l.id}`}
                className={`translation-card ${isCompleted ? 'completed' : ''}`}
              >
                <div className="translation-card-top">
                  <span className={`translation-badge ${badgeClass}`}>
                    Cấp {l.level}
                  </span>
                  <span className="translation-card-num">
                    Bài {l.number}
                    {isCompleted && <span className="completed-check-icon"> ✓</span>}
                  </span>
                </div>

                <h3>{l.title}</h3>

                <p className="translation-card-preview">{l.vietnamese}</p>

                <div className="translation-card-focus">
                  <Icon name={isCompleted ? 'check-circle' : 'sparkles'} />
                  <span>
                    {prevResult
                      ? `Đã làm · Độ khớp: ${prevResult.score}%`
                      : l.levelFocus}
                  </span>
                </div>
              </a>
            );
          })}
        </div>

        {filteredLessons.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#688279' }}>
            <p>Không tìm thấy bài học nào phù hợp với từ khóa "{searchQuery}".</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
