import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Icon from '../components/Icon';

const CLOUDFLARE_R2_BASE = 'https://pub-5c009e46a0b34c0f831960b4fa794044.r2.dev';

function getAudioUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${CLOUDFLARE_R2_BASE}${url.startsWith('/') ? url : '/' + url}`;
}

function cleanSentence(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function SentenceBuildingPage({ topicId, partFilter = 'ALL' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPart, setSelectedPart] = useState(() => (partFilter || 'ALL').replace(/^part-/i, ''));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (partFilter) {
      setSelectedPart(partFilter.replace(/^part-/i, ''));
    }
  }, [partFilter]);
  
  // Practice state
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [assembledWords, setAssembledWords] = useState([]); // [{ id, text, bankIndex }]
  const [status, setStatus] = useState(null); // 'correct' | 'incorrect' | null
  const [showAnswer, setShowAnswer] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Audio player state
  const audioRef = useRef(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Progress history
  const [progress, setProgress] = useState(() => {
    try {
      const stored = localStorage.getItem('openear-sentence-building-progress');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Load data
  useEffect(() => {
    fetch('/data/sentence-building.json?v=20261122_01')
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải dữ liệu ghép câu');
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

  // Find current topic if in detail view
  const currentTopic = useMemo(() => {
    if (!data || !topicId) return null;
    return (
      data.topics.find((t) => t.id === topicId || String(t.number) === topicId) ||
      null
    );
  }, [data, topicId]);

  // Current sentence
  const currentSentence = useMemo(() => {
    if (!currentTopic || !currentTopic.sentences) return null;
    return currentTopic.sentences[currentSentenceIdx] || null;
  }, [currentTopic, currentSentenceIdx]);

  // Reset assembled words when sentence changes
  useEffect(() => {
    setAssembledWords([]);
    setStatus(null);
    setShowAnswer(false);
  }, [currentTopic, currentSentenceIdx]);

  // Audio player handlers
  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [currentTopic]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
    } else {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration || 0);
    }
  };

  const handleAudioSeek = (e) => {
    const time = parseFloat(e.target.value);
    setAudioCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Add word from bank to assembled list
  const handlePickWord = (word, index) => {
    if (status === 'correct') return; // locked after solving
    const next = [...assembledWords, { id: `${index}-${word}`, text: word, bankIndex: index }];
    setAssembledWords(next);
    setStatus(null);
  };

  // Remove word from assembled list
  const handleRemoveWord = (wordIndex) => {
    if (status === 'correct') return;
    const next = assembledWords.filter((_, i) => i !== wordIndex);
    setAssembledWords(next);
    setStatus(null);
  };

  // Clear all
  const handleClear = () => {
    setAssembledWords([]);
    setStatus(null);
  };

  // Text-To-Speech for individual sentence
  const handleSpeakSentence = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Check sentence
  const handleCheck = () => {
    if (!currentSentence || assembledWords.length === 0) return;
    const userBuilt = assembledWords.map((w) => w.text).join(' ');
    const isMatch = cleanSentence(userBuilt) === cleanSentence(currentSentence.answer);

    if (isMatch) {
      setStatus('correct');
      // Speak correct sentence
      handleSpeakSentence(currentSentence.answer);
      // Save progress
      const nextProgress = {
        ...progress,
        [currentSentence.id]: true
      };
      setProgress(nextProgress);
      try {
        localStorage.setItem(
          'openear-sentence-building-progress',
          JSON.stringify(nextProgress)
        );
      } catch {}
    } else {
      setStatus('incorrect');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!currentTopic || !currentSentence) return;

    const handleKeyDown = (e) => {
      // Don't intercept when user is in input or textarea
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return;
      }

      // Left arrow: Câu trước
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSentenceIdx((prev) => Math.max(0, prev - 1));
        return;
      }

      // Right arrow: Câu sau
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentSentenceIdx((prev) =>
          Math.min(currentTopic.sentences.length - 1, prev + 1)
        );
        return;
      }

      // Shift: Nghe câu này
      if (e.key === 'Shift') {
        e.preventDefault();
        handleSpeakSentence(currentSentence.answer);
        return;
      }

      // Enter: Xem / Ẩn đáp án
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowAnswer((prev) => !prev);
        return;
      }

      // Space: Kiểm tra câu hoặc Sang câu tiếp theo nếu đã làm đúng
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (status === 'correct') {
          if (currentSentenceIdx < currentTopic.sentences.length - 1) {
            setCurrentSentenceIdx((prev) => prev + 1);
          }
        } else if (assembledWords.length > 0) {
          handleCheck();
        }
        return;
      }

      // Backspace: Gỡ từ đã chọn gần nhất
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (assembledWords.length > 0 && status !== 'correct') {
          handleRemoveWord(assembledWords.length - 1);
        }
        return;
      }

      // Escape / Delete: Xóa hết các từ đang ráp
      if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        if (assembledWords.length > 0 && status !== 'correct') {
          handleClear();
        }
        return;
      }

      // Number keys 1..9, 0: Chọn nhanh mảnh từ
      if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        const wordIndex = num === 0 ? 9 : num - 1;
        if (wordIndex < currentSentence.words.length) {
          e.preventDefault();
          const word = currentSentence.words[wordIndex];
          const usedIndices = new Set(assembledWords.map((w) => w.bankIndex));
          if (!usedIndices.has(wordIndex) && status !== 'correct') {
            handlePickWord(word, wordIndex);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTopic,
    currentSentence,
    currentSentenceIdx,
    assembledWords,
    status,
    showAnswer,
    progress
  ]);

  // Navigation: prev / next topic
  const { prevTopic, nextTopic } = useMemo(() => {
    if (!data || !currentTopic) return { prevTopic: null, nextTopic: null };
    const idx = data.topics.findIndex((t) => t.id === currentTopic.id);
    return {
      prevTopic: idx > 0 ? data.topics[idx - 1] : null,
      nextTopic: idx < data.topics.length - 1 ? data.topics[idx + 1] : null
    };
  }, [data, currentTopic]);

  // Filter topics in list view
  const filteredTopics = useMemo(() => {
    if (!data) return [];
    const normSelected = String(selectedPart).replace(/^part-/i, '');
    return data.topics.filter((t) => {
      const matchPart = normSelected === 'ALL' || String(t.partNumber) === normSelected;
      const matchSearch =
        !searchQuery.trim() ||
        t.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.titleVi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `chủ đề ${t.number}`.includes(searchQuery.toLowerCase());
      return matchPart && matchSearch;
    });
  }, [data, selectedPart, searchQuery]);

  // Format time mm:ss
  const formatTime = (secs) => {
    if (!Number.isFinite(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Overall statistics
  const stats = useMemo(() => {
    if (!data) return { totalTopics: 0, totalSentences: 0, completedSentences: 0 };
    const totalTopics = data.totalTopics;
    const totalSentences = data.totalSentences;
    const completedSentences = Object.keys(progress).length;
    return { totalTopics, totalSentences, completedSentences };
  }, [data, progress]);

  // Topic completed count
  const getTopicCompletedCount = (topic) => {
    if (!topic || !topic.sentences) return 0;
    return topic.sentences.filter((s) => progress[s.id]).length;
  };

  if (loading) {
    return (
      <div id="app">
        <Header collection="sentence-building" level="A1" />
        <div className="loading">Đang tải dữ liệu ghép câu tiếng Anh…</div>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div id="app">
        <Header collection="sentence-building" level="A1" />
        <main className="not-found">
          <h1>Không thể tải dữ liệu ghép câu</h1>
          <a className="primary-button" href="#/">
            Về trang chủ
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  // ==========================================
  // RENDER: PRACTICE DETAIL VIEW
  // ==========================================
  if (currentTopic && currentSentence) {
    const topicCompletedCount = getTopicCompletedCount(currentTopic);
    const usedBankIndices = new Set(assembledWords.map((w) => w.bankIndex));

    return (
      <div id="app">
        <Header collection="sentence-building" level="A1" />

        <main className="sb-container">
          {/* Top navigation */}
          <nav className="sb-practice-top-nav">
            <a className="sb-back-btn" href="#/sentence-building">
              <Icon name="arrow-left" /> Danh sách {data?.totalTopics || 90} chủ đề
            </a>
            <div className="worksheet-nav-arrows">
              {prevTopic ? (
                <a
                  className="worksheet-arrow-btn"
                  href={`#/sentence-building/topic/${prevTopic.id}`}
                  title={`Chủ đề ${prevTopic.number}: ${prevTopic.titleEn}`}
                >
                  <Icon name="arrow-left" /> Chủ đề {prevTopic.number}
                </a>
              ) : (
                <span className="worksheet-arrow-btn disabled">
                  <Icon name="arrow-left" /> Chủ đề trước
                </span>
              )}
              {nextTopic ? (
                <a
                  className="worksheet-arrow-btn"
                  href={`#/sentence-building/topic/${nextTopic.id}`}
                  title={`Chủ đề ${nextTopic.number}: ${nextTopic.titleEn}`}
                >
                  Chủ đề {nextTopic.number} <Icon name="arrow-right" />
                </a>
              ) : (
                <span className="worksheet-arrow-btn disabled">
                  Chủ đề sau <Icon name="arrow-right" />
                </span>
              )}
            </div>
          </nav>

          {/* Topic Audio Player */}
          <section className="sb-topic-audio-card">
            <div className="sb-audio-info">
              <div className="sb-audio-icon">
                <Icon name="headphones" />
              </div>
              <div className="sb-audio-title">
                <h3>
                  Chủ đề {currentTopic.number}: {currentTopic.titleEn}
                </h3>
                <p>{currentTopic.titleVi} · {currentTopic.partName}</p>
              </div>
            </div>

            <div className="sb-audio-player-controls">
              <button
                type="button"
                className="sb-play-btn"
                onClick={togglePlayAudio}
                title={isPlayingAudio ? 'Tạm dừng audio' : 'Phát audio toàn bài'}
              >
                <Icon name={isPlayingAudio ? 'pause' : 'play'} />
              </button>

              <div className="sb-audio-seeker">
                <input
                  type="range"
                  className="sb-seek-range"
                  min="0"
                  max={audioDuration || 100}
                  step="0.1"
                  value={audioCurrentTime}
                  onChange={handleAudioSeek}
                />
                <span className="sb-time-display">
                  {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                {[0.75, 1, 1.25].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    style={{
                      background: playbackSpeed === spd ? '#72f3c7' : 'rgba(255,255,255,0.15)',
                      color: playbackSpeed === spd ? '#102e26' : '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: '750',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSpeedChange(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Hidden native audio element */}
              <audio
                ref={audioRef}
                src={getAudioUrl(currentTopic.audioUrl)}
                preload="metadata"
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onEnded={() => setIsPlayingAudio(false)}
              />
            </div>
          </section>

          {/* Sentence Puzzle Card */}
          <article className="sb-puzzle-card">
            <header className="sb-puzzle-header">
              <span className="sb-question-tracker">
                CÂU {currentSentence.number} / {currentTopic.sentences.length}
              </span>
              <span className="sb-score-tracker">
                Đã hoàn thành: {topicCompletedCount} / {currentTopic.sentences.length} câu
              </span>
            </header>

            {/* Vietnamese Prompt */}
            <div className="sb-vn-prompt-box">
              <div className="sb-vn-label">Nghĩa tiếng Việt cần ráp:</div>
              <p className="sb-vn-text">{currentSentence.vietnamese}</p>
            </div>

            {/* Assembly Drop Zone */}
            <div
              className={`sb-assembly-zone ${
                assembledWords.length === 0
                  ? 'empty'
                  : status === 'correct'
                  ? 'correct'
                  : status === 'incorrect'
                  ? 'incorrect'
                  : ''
              }`}
            >
              {assembledWords.length === 0 ? (
                <span>Bấm các mảnh từ bên dưới để ráp thành câu tiếng Anh hoàn chỉnh...</span>
              ) : (
                assembledWords.map((item, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className="sb-chip assembled"
                    onClick={() => handleRemoveWord(idx)}
                    title="Bấm để gỡ từ này"
                  >
                    {item.text}
                  </button>
                ))
              )}
            </div>

            {/* Scrambled Word Bank */}
            <div className="sb-bank-section">
              <div className="sb-bank-label">
                <span>Các mảnh từ có sẵn (bấm để chọn):</span>
              </div>
              <div className="sb-word-bank">
                {currentSentence.words.map((w, idx) => {
                  const isUsed = usedBankIndices.has(idx);
                  const keyNum = idx < 9 ? idx + 1 : idx === 9 ? 0 : null;
                  return (
                    <button
                      type="button"
                      key={idx}
                      className={`sb-chip bank ${isUsed ? 'used' : ''}`}
                      onClick={() => !isUsed && handlePickWord(w, idx)}
                      disabled={isUsed || status === 'correct'}
                      title={keyNum !== null ? `Phím số ${keyNum}` : undefined}
                    >
                      {keyNum !== null && (
                        <span className="sb-chip-key">{keyNum}</span>
                      )}
                      <span className="sb-chip-text">{w}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sb-actions-row">
              <button
                type="button"
                className="sb-btn-primary"
                onClick={handleCheck}
                disabled={assembledWords.length === 0 || status === 'correct'}
              >
                <Icon name="check" /> Kiểm tra câu
              </button>

              <button
                type="button"
                className="sb-btn-outline"
                onClick={() => setShowAnswer(!showAnswer)}
              >
                <Icon name={showAnswer ? 'eye-off' : 'eye'} />
                {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
              </button>

              <button
                type="button"
                className="sb-btn-outline"
                onClick={() => handleSpeakSentence(currentSentence.answer)}
                title="Nghe phát âm chuẩn của câu này"
              >
                <Icon name="volume" /> Nghe câu này
              </button>

              {assembledWords.length > 0 && status !== 'correct' && (
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={handleClear}
                >
                  <Icon name="refresh" /> Xóa làm lại
                </button>
              )}

              {/* Prev / Next Sentence buttons */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="sb-btn-outline"
                  onClick={() => setCurrentSentenceIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentSentenceIdx === 0}
                >
                  <Icon name="arrow-left" /> Câu trước
                </button>
                <button
                  type="button"
                  className="sb-btn-outline"
                  onClick={() =>
                    setCurrentSentenceIdx((prev) =>
                      Math.min(currentTopic.sentences.length - 1, prev + 1)
                    )
                  }
                  disabled={currentSentenceIdx === currentTopic.sentences.length - 1}
                >
                  Câu sau <Icon name="arrow-right" />
                </button>
              </div>
            </div>

            {/* Feedback alert */}
            {status === 'correct' && (
              <div className="sb-feedback-box success">
                <div className="sb-feedback-text">
                  <strong>Chính xác! Rất tuyệt vời 🎉</strong>
                  <p>{currentSentence.answer}</p>
                </div>
                {currentSentenceIdx < currentTopic.sentences.length - 1 && (
                  <button
                    type="button"
                    className="sb-btn-primary"
                    style={{ background: '#059669', padding: '8px 16px', fontSize: '13.5px' }}
                    onClick={() => setCurrentSentenceIdx((prev) => prev + 1)}
                  >
                    Sang câu tiếp theo <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            )}

            {status === 'incorrect' && (
              <div className="sb-feedback-box sb-error">
                <div className="sb-feedback-text">
                  <strong>Chưa chính xác, bạn hãy thử đổi lại thứ tự các từ nhé!</strong>
                  <p>Hãy chú ý trật tự chủ ngữ, vị ngữ hoặc bấm "Xem đáp án" để tham khảo.</p>
                </div>
              </div>
            )}

            {/* Model Answer Card */}
            {showAnswer && (
              <div className="sb-answer-card">
                <h4>Đáp án chuẩn từ sách:</h4>
                <p>{currentSentence.answer}</p>
                <small style={{ color: '#55726a' }}>
                  Các từ được viết hoa và thêm dấu câu theo chuẩn văn bản.
                </small>
              </div>
            )}

            {/* Shortcut guide footer */}
            <div className="sb-shortcut-guide">
              <span className="sb-guide-label">Phím tắt nhanh:</span>
              <div className="sb-guide-pills">
                <span className="sb-guide-pill"><kbd>1–9</kbd> Chọn từ</span>
                <span className="sb-guide-pill"><kbd>Space</kbd> Kiểm tra câu / Sang câu tiếp</span>
                <span className="sb-guide-pill"><kbd>Enter</kbd> Xem đáp án</span>
                <span className="sb-guide-pill"><kbd>Shift</kbd> Nghe câu này</span>
                <span className="sb-guide-pill"><kbd>Backspace</kbd> Gỡ từ</span>
                <span className="sb-guide-pill"><kbd>←</kbd> <kbd>→</kbd> Chuyển câu</span>
              </div>
            </div>
          </article>

          {/* Sentence Grid Tracker */}
          <section className="sb-sentence-grid-tracker">
            <div className="sb-tracker-title">
              <span>Bảng danh sách {currentTopic.sentences.length} câu trong chủ đề:</span>
              <span style={{ color: '#16765e' }}>
                {topicCompletedCount} / {currentTopic.sentences.length} hoàn thành
              </span>
            </div>
            <div className="sb-dots-grid">
              {currentTopic.sentences.map((s, idx) => {
                const isCompleted = progress[s.id];
                const isActive = idx === currentSentenceIdx;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`sb-dot-btn ${isActive ? 'active' : ''} ${
                      isCompleted ? 'completed' : ''
                    }`}
                    onClick={() => setCurrentSentenceIdx(idx)}
                    title={`Câu ${s.number}: ${s.vietnamese}`}
                  >
                    {isCompleted ? '✓' : s.number}
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    );
  }

  // ==========================================
  // RENDER: TOPIC LIST (HUB VIEW)
  // ==========================================
  return (
    <div id="app">
      <Header collection="sentence-building" level="A1" />

      <main className="sb-container">
        {/* Hero Section */}
        <section className="sb-hero">
          <span className="sb-hero-badge">2.500 MẪU CÂU THÔNG DỤNG · 90 CHỦ ĐỀ</span>
          <h1>Ráp Câu Tiếng Anh (Ghép Câu)</h1>
          <p>
            Rèn luyện phản xạ trật tự từ và ngữ pháp tự nhiên qua 2.500 mẫu câu thực tế chia làm 9 phần và 90 chủ đề. Mỗi chủ đề đều kèm theo file Audio MP3 giọng đọc bản xứ để bạn vừa ghép câu vừa luyện nghe nói!
          </p>

          <div className="sb-stats-row">
            <div className="sb-stat-pill">
              <Icon name="book" />
              <span>
                Tổng số chủ đề: <strong>{stats.totalTopics} chủ đề</strong>
              </span>
            </div>
            <div className="sb-stat-pill">
              <Icon name="sparkles" />
              <span>
                Tổng số câu: <strong>{stats.totalSentences} câu</strong>
              </span>
            </div>
            <div className="sb-stat-pill">
              <Icon name="check-circle" />
              <span>
                Đã hoàn thành: <strong>{stats.completedSentences} câu</strong>
              </span>
            </div>
          </div>
        </section>

        {/* Filter Navigation Bar */}
        <div className="sb-nav-bar">
          <div className="sb-part-tabs">
            <button
              type="button"
              className={`sb-part-tab ${selectedPart === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedPart('ALL')}
            >
              Tất cả ({data.topics.length})
            </button>
            {data.parts.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`sb-part-tab ${String(selectedPart).replace(/^part-/i, '') === String(p.id) ? 'active' : ''}`}
                onClick={() => setSelectedPart(String(p.id))}
              >
                Phần {p.id} ({p.topicRange})
              </button>
            ))}
          </div>

          <div className="sb-search-box">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Tìm theo chủ đề, từ khóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Topic Grid */}
        <div className="sb-topic-grid">
          {filteredTopics.map((t) => {
            const completedCount = getTopicCompletedCount(t);

            return (
              <a
                key={t.id}
                href={`#/sentence-building/topic/${t.id}`}
                className="sb-topic-card"
              >
                <div className="sb-topic-card-top">
                  <span className="sb-topic-badge">Phần {t.partNumber}</span>
                  <span className="sb-topic-card-num">Chủ đề {t.number}</span>
                </div>

                <h3>{t.titleEn}</h3>
                <p className="sb-topic-card-vi">{t.titleVi}</p>

                <div className="sb-topic-card-meta">
                  <span className="sb-audio-indicator">
                    <Icon name="headphones" /> Kèm Audio MP3
                  </span>
                  <span>
                    {completedCount > 0
                      ? `Đã làm ${completedCount}/${t.sentencesCount}`
                      : `${t.sentencesCount} câu`}
                  </span>
                </div>
              </a>
            );
          })}
        </div>

        {filteredTopics.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#688279' }}>
            <p>Không tìm thấy chủ đề nào phù hợp với từ khóa "{searchQuery}".</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
