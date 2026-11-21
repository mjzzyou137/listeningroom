import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Icon from '../components/Icon';

export default function LessonDetail({ lessonId, preferredCollection = 'levels', data }) {
  const [activeTab, setActiveTab] = useState('script');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);

  const audioRef = useRef(null);
  const transcriptRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Find lesson across all collections
  const allCollections = [
    ...(data.levels || []),
    ...(data.naturalLevels || []),
    ...(data.videoLevels || [])
  ];
  const allLessons = allCollections.flatMap((lvl) => lvl.lessons || []);
  const lesson = allLessons.find((item) => item.id === lessonId);

  useEffect(() => {
    if (lesson) {
      document.title = `${lesson.title} · ${lesson.level || ''} Listeningroom`;
      setActiveTab('script');
      setActiveIndex(-1);
      setIsPlaying(false);
      setHasStarted(false);
      autoScrollRef.current = autoScroll;
    }
  }, [lessonId, lesson, autoScroll]);

  if (!lesson) {
    return (
      <>
        <Header collection="levels" level="A1" />
        <main className="not-found">
          <span>404</span>
          <h1>Không tìm thấy bài học</h1>
          <a className="primary-button" href="#/">
            Về thư viện
          </a>
        </main>
        <Footer />
      </>
    );
  }

  const isNatural = (data.naturalLevels || []).some((lvl) =>
    (lvl.lessons || []).some((l) => l.id === lesson.id)
  );
  const isVideo = (data.videoLevels || []).some((lvl) =>
    (lvl.lessons || []).some((l) => l.id === lesson.id)
  );

  const collectionType = isNatural
    ? 'natural'
    : isVideo
    ? 'videos'
    : preferredCollection === 'grammar'
    ? 'grammar'
    : 'levels';

  const activeLevelList =
    collectionType === 'natural'
      ? data.naturalLevels
      : collectionType === 'videos'
      ? data.videoLevels
      : collectionType === 'grammar'
      ? data.levels.filter((lvl) => lvl.level !== 'C1')
      : data.levels;

  const currentLevelGroup =
    activeLevelList.find((lvl) => lvl.level === lesson.level) || activeLevelList[0];
  const siblings = currentLevelGroup?.lessons || [lesson];
  const currentIndex = siblings.findIndex((item) => item.id === lesson.id);
  const nextLesson = siblings[(currentIndex + 1) % siblings.length];

  const resolvedAudioSrc =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    lesson.originalAudioUrl
      ? lesson.originalAudioUrl
      : (lesson.audioUrl || lesson.originalAudioUrl);

  const allowedTabs =
    collectionType === 'natural' ? ['script', 'vocabulary', 'grammar'] : ['script', 'grammar'];
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : 'script';

  // Audio & Transcript synchronization effect
  useEffect(() => {
    if (currentTab !== 'script' || !transcriptRef.current || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const container = transcriptRef.current;
    const lines = [...container.querySelectorAll('p')].filter((line) =>
      line.textContent.trim()
    );

    if (!lines.length) return;

    const weights = lines.map((line) =>
      Math.max(
        1,
        (line.textContent.replace(/^[^:]{1,24}:\s*/, '').match(/[\p{L}\d']+/gu) || [])
          .length + 0.7
      )
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const hasPreciseTimings =
      Array.isArray(lesson.scriptTimings) && lesson.scriptTimings.length > 0;
    const preciseTimings = hasPreciseTimings ? lesson.scriptTimings : null;

    let localActiveIndex = -1;

    const clearHighlight = () => {
      lines.forEach((line) => line.classList.remove('script-active'));
    };

    const sync = () => {
      let nextIdx;
      if (preciseTimings) {
        nextIdx = preciseTimings.findLastIndex((time) => time <= audio.currentTime + 0.05);
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= lines.length) nextIdx = lines.length - 1;
      } else {
        if (!audio.duration || !Number.isFinite(audio.duration)) return;
        const target = (audio.currentTime / audio.duration) * totalWeight;
        let running = 0;
        const index = weights.findIndex((weight) => {
          running += weight;
          return target <= running;
        });
        nextIdx = index < 0 ? lines.length - 1 : index;
      }

      if (nextIdx === localActiveIndex) return;

      clearHighlight();
      localActiveIndex = nextIdx;
      setActiveIndex(nextIdx);

      const activeLine = lines[nextIdx];
      if (activeLine) {
        activeLine.classList.add('script-active');
        if (autoScrollRef.current && !audio.paused) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    const seekToLine = (index) => {
      const seek = () => {
        if (!audio.duration || !Number.isFinite(audio.duration)) return;
        let targetTime;
        if (preciseTimings) {
          if (index < preciseTimings.length) {
            targetTime = preciseTimings[index];
          } else {
            targetTime = preciseTimings[preciseTimings.length - 1];
          }
        } else {
          const weightBefore = weights
            .slice(0, index)
            .reduce((sum, weight) => sum + weight, 0);
          targetTime = (weightBefore / totalWeight) * audio.duration;
        }

        audio.currentTime = Math.min(audio.duration - 0.05, targetTime);
        localActiveIndex = -1;
        autoScrollRef.current = true;
        sync();
        audio.play().catch(() => {});
      };

      if (audio.readyState >= 1) {
        seek();
      } else {
        audio.addEventListener('loadedmetadata', seek, { once: true });
      }
    };

    const handlePlay = () => {
      autoScrollRef.current = autoScroll;
      setIsPlaying(true);
      setHasStarted(true);
      sync();
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      clearHighlight();
      setActiveIndex(-1);
    };

    const handleTimeUpdate = () => {
      sync();
    };

    const handleSeeked = () => {
      localActiveIndex = -1;
      sync();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeked', handleSeeked);

    lines.forEach((line, index) => {
      line.classList.add('script-seekable');
      line.setAttribute('title', 'Phát audio từ đoạn này');
      line.setAttribute('tabindex', '0');
      const clickHandler = () => seekToLine(index);
      const keyHandler = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          seekToLine(index);
        }
      };
      line.addEventListener('click', clickHandler);
      line.addEventListener('keydown', keyHandler);

      line._cleanup = () => {
        line.removeEventListener('click', clickHandler);
        line.removeEventListener('keydown', keyHandler);
      };
    });

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeked', handleSeeked);
      lines.forEach((line) => {
        line.classList.remove('script-active', 'script-seekable');
        if (line._cleanup) line._cleanup();
      });
    };
  }, [lesson, currentTab]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  };

  const number = lesson.code ? lesson.code.split('-')[1] : '';

  const renderContentPanel = () => {
    if (currentTab === 'script') {
      return (
        <article
          ref={transcriptRef}
          className="reading-panel transcript-content"
        >
          <div className="panel-heading">
            <div>
              <span>Conversation transcript</span>
              <small>{lesson.code}</small>
            </div>
            <label className="autoscroll-checkbox">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => {
                  setAutoScroll(e.target.checked);
                  autoScrollRef.current = e.target.checked;
                }}
              />
              <span>Tự động cuộn</span>
            </label>
          </div>
          <div dangerouslySetInnerHTML={{ __html: lesson.transcriptHtml || '' }} />
        </article>
      );
    }

    if (currentTab === 'vocabulary') {
      return (
        <article className="reading-panel grammar-content">
          <div className="panel-heading">
            <span>Vocabulary</span>
            <small>{lesson.code}</small>
          </div>
          {lesson.vocabularyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: lesson.vocabularyHtml }} />
          ) : (
            <p>ELLLO không cung cấp vocabulary riêng cho bài này.</p>
          )}
        </article>
      );
    }

    // grammar tab
    return (
      <article className="reading-panel grammar-content">
        <div className="panel-heading">
          <span>Grammar</span>
          <small>{lesson.code}</small>
        </div>
        {lesson.grammarHtml ? (
          <div dangerouslySetInnerHTML={{ __html: lesson.grammarHtml }} />
        ) : (
          <p>ELLLO không cung cấp grammar riêng cho bài này.</p>
        )}
      </article>
    );
  };

  return (
    <>
      <Header collection={collectionType} level={lesson.level} compact />
      <main className="detail-page">
        <div className="detail-topbar">
          <a href={`#/collection/${collectionType}/${lesson.level}`}>
            <Icon name="back" />{' '}
            {collectionType === 'natural'
              ? 'Natural Conversations'
              : collectionType === 'grammar'
              ? 'Grammar Lessons & Books'
              : 'Thư viện'}{' '}
            {lesson.level}
          </a>
          <span>
            {lesson.code} ·{' '}
            {collectionType === 'natural'
              ? 'Natural'
              : collectionType === 'grammar'
              ? 'Grammar'
              : 'Level'}{' '}
            conversation
          </span>
        </div>

        <section
          className={`lesson-hero ${collectionType === 'natural' ? 'natural-hero' : ''}`}
        >
          <div className="lesson-heading">
            <span className="eyebrow">{lesson.topic}</span>
            <h1>{lesson.title}</h1>
            <p>{lesson.description}</p>
            <div className="speaker-row">
              {(lesson.speakers || []).map((speaker) => (
                <span key={speaker}>
                  <b>{speaker.charAt(0)}</b>
                  {speaker}
                </span>
              ))}
            </div>
          </div>
          <div className="lesson-art">
            <span>{number}</span>
            <div className="large-wave">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>

        {lesson.videoUrl && (
          <section className="video-player">
            <iframe
              src={lesson.videoUrl}
              title={lesson.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
            <span>Nguồn video: ELLLO</span>
          </section>
        )}

        <section className="player-card">
          <div className="player-label">
            <Icon name="headphones" />
            <div>
              <span>Đang nghe</span>
              <strong>{lesson.title}</strong>
            </div>
          </div>
          {resolvedAudioSrc ? (
            <audio
              ref={audioRef}
              id="lesson-audio"
              controls
              preload="metadata"
              src={resolvedAudioSrc}
              onError={(e) => {
                if (lesson.originalAudioUrl && e.currentTarget.src !== lesson.originalAudioUrl) {
                  e.currentTarget.src = lesson.originalAudioUrl;
                  e.currentTarget.load();
                }
              }}
            />
          ) : (
            <span>Audio nguồn không còn khả dụng</span>
          )}
          {lesson.youtubeUrl && (
            <a
              className="youtube-link"
              href={lesson.youtubeUrl}
              target="_blank"
              rel="noreferrer"
            >
              YouTube <Icon name="external" />
            </a>
          )}
        </section>

        <section className="lesson-content">
          <div className="tabs" role="tablist">
            <button
              type="button"
              className={currentTab === 'script' ? 'active' : ''}
              onClick={() => setActiveTab('script')}
            >
              Script
            </button>
            {collectionType === 'natural' && (
              <button
                type="button"
                className={currentTab === 'vocabulary' ? 'active' : ''}
                onClick={() => setActiveTab('vocabulary')}
              >
                Vocabulary
              </button>
            )}
            <button
              type="button"
              className={currentTab === 'grammar' ? 'active' : ''}
              onClick={() => setActiveTab('grammar')}
            >
              Grammar
            </button>
          </div>

          {renderContentPanel()}

          {nextLesson && (
            <aside className="next-lesson">
              <span>Tiếp theo</span>
              <div>
                <small>{nextLesson.code}</small>
                <strong>{nextLesson.title}</strong>
              </div>
              <a href={`#/lesson/${nextLesson.id}?collection=${collectionType}`}>
                <Icon name="arrow" />
              </a>
            </aside>
          )}
        </section>
      </main>

      {/* Floating play/pause sync control button */}
      <button
        type="button"
        className={`audio-sync-control ${isPlaying || hasStarted ? 'visible' : ''}`}
        aria-label={isPlaying ? 'Pause audio' : 'Resume audio'}
        onClick={togglePlayAudio}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} />
        <span>{isPlaying ? 'Pause' : 'Play'}</span>
      </button>

      <Footer />
    </>
  );
}
