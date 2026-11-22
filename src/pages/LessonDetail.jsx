import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const videoRef = useRef(null);
  const transcriptRef = useRef(null);
  const autoScrollRef = useRef(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

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
      ? data.levels
      : data.levels;

  const currentLevelGroup =
    activeLevelList.find((lvl) => lvl.level === lesson.level) || activeLevelList[0];
  const siblings = currentLevelGroup?.lessons || [lesson];
  const currentIndex = siblings.findIndex((item) => item.id === lesson.id);
  const nextLesson = siblings[(currentIndex + 1) % siblings.length];

  const CLOUDFLARE_R2_BASE = 'https://pub-5c009e46a0b34c0f831960b4fa794044.r2.dev';
  const getMediaUrl = (mediaPath) => {
    if (!mediaPath) return '';
    if (mediaPath.startsWith('http')) return mediaPath;
    return `${CLOUDFLARE_R2_BASE}${mediaPath.startsWith('/') ? mediaPath : '/' + mediaPath}`;
  };

  const resolvedAudioSrc =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? getMediaUrl(lesson.audioUrl)
      : (lesson.audioUrl || getMediaUrl(lesson.audioUrl));

  const resolvedVideoSrc =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? getMediaUrl(lesson.videoUrl)
      : (lesson.videoUrl || getMediaUrl(lesson.videoUrl));

  const resolvedSubtitleSrc =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? getMediaUrl(lesson.subtitleUrl)
      : (lesson.subtitleUrl || getMediaUrl(lesson.subtitleUrl));

  const allowedTabs =
    collectionType === 'natural' || collectionType === 'videos'
      ? ['script', 'vocabulary', 'grammar']
      : ['script', 'grammar'];
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : 'script';

  const formattedTranscriptHtml = useMemo(() => {
    if (!lesson?.transcriptHtml) return '';
    return lesson.transcriptHtml.replace(
      /<strong>\s*([^<]+?)\s*<\/strong>\s*:\s*/gi,
      '<strong>$1:</strong> '
    );
  }, [lesson?.transcriptHtml]);

  const isDirectVideo = useMemo(() => {
    if (!lesson?.videoUrl) return false;
    const url = lesson.videoUrl.toLowerCase();
    return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || url.startsWith('/videos/');
  }, [lesson?.videoUrl]);

  const toggleSubtitles = () => {
    const nextState = !subtitlesEnabled;
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = nextState ? 'showing' : 'hidden';
      }
    }
    setSubtitlesEnabled(nextState);
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = subtitlesEnabled ? 'showing' : 'hidden';
      }
    }
  };

  const handleVideoPlay = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  };

  const embedVideoUrl = useMemo(() => {
    if (isDirectVideo) return null;
    const rawUrl = lesson?.videoUrl || lesson?.youtubeUrl;
    if (!rawUrl) return null;

    if (rawUrl.includes('player.vimeo.com') || rawUrl.includes('youtube.com/embed')) {
      return rawUrl;
    }

    const vimeoMatch = rawUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0&badge=0&autopause=0`;
    }

    const ytMatch = rawUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    return rawUrl;
  }, [isDirectVideo, lesson?.videoUrl, lesson?.youtubeUrl]);

  // Audio/Video & Transcript synchronization effect
  useEffect(() => {
    if (currentTab !== 'script' || !transcriptRef.current || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const video = videoRef.current;
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

    const sync = (customMedia) => {
      const media = customMedia || (video && !video.paused ? video : audio);
      if (!media) return;

      let nextIdx;
      if (preciseTimings) {
        nextIdx = preciseTimings.findLastIndex((time) => time <= media.currentTime + 0.05);
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= lines.length) nextIdx = lines.length - 1;
      } else {
        if (!media.duration || !Number.isFinite(media.duration)) return;
        const target = (media.currentTime / media.duration) * totalWeight;
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
        if (autoScrollRef.current && !media.paused) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    const seekToLine = (index) => {
      const isVideoActive = video && (isDirectVideo || !video.paused);
      const targetMedia = isVideoActive ? video : audio;

      const seek = () => {
        if (!targetMedia.duration || !Number.isFinite(targetMedia.duration)) return;
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
          targetTime = (weightBefore / totalWeight) * targetMedia.duration;
        }

        targetMedia.currentTime = Math.min(targetMedia.duration - 0.05, targetTime);
        localActiveIndex = -1;
        autoScrollRef.current = true;
        sync(targetMedia);
        targetMedia.play().catch(() => {});
      };

      if (targetMedia.readyState >= 1) {
        seek();
      } else {
        targetMedia.addEventListener('loadedmetadata', seek, { once: true });
      }
    };

    const handleAudioPlay = () => {
      if (video && !video.paused) {
        video.pause();
      }
      autoScrollRef.current = autoScroll;
      setIsPlaying(true);
      setHasStarted(true);
      sync(audio);
    };

    const handleVideoPlaySync = () => {
      if (audio && !audio.paused) {
        audio.pause();
      }
      autoScrollRef.current = autoScroll;
      sync(video);
    };

    const handleAudioPause = () => {
      setIsPlaying(false);
    };

    const handleMediaEnded = () => {
      setIsPlaying(false);
      clearHighlight();
      setActiveIndex(-1);
    };

    const handleAudioTimeUpdate = () => sync(audio);
    const handleVideoTimeUpdate = () => sync(video);
    const handleAudioSeeked = () => {
      localActiveIndex = -1;
      sync(audio);
    };
    const handleVideoSeeked = () => {
      localActiveIndex = -1;
      sync(video);
    };

    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleMediaEnded);
    audio.addEventListener('timeupdate', handleAudioTimeUpdate);
    audio.addEventListener('seeked', handleAudioSeeked);

    if (video) {
      video.addEventListener('play', handleVideoPlaySync);
      video.addEventListener('ended', handleMediaEnded);
      video.addEventListener('timeupdate', handleVideoTimeUpdate);
      video.addEventListener('seeked', handleVideoSeeked);
    }

    lines.forEach((line, index) => {
      line.classList.add('script-seekable');
      line.setAttribute('title', isDirectVideo ? 'Phát từ đoạn này' : 'Phát audio từ đoạn này');
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
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleMediaEnded);
      audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
      audio.removeEventListener('seeked', handleAudioSeeked);
      if (video) {
        video.removeEventListener('play', handleVideoPlaySync);
        video.removeEventListener('ended', handleMediaEnded);
        video.removeEventListener('timeupdate', handleVideoTimeUpdate);
        video.removeEventListener('seeked', handleVideoSeeked);
      }
      lines.forEach((line) => {
        line.classList.remove('script-active', 'script-seekable');
        if (line._cleanup) line._cleanup();
      });
    };
  }, [lesson, currentTab, isDirectVideo]);

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
          <div dangerouslySetInnerHTML={{ __html: formattedTranscriptHtml }} />
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
              : collectionType === 'videos'
              ? 'One Minute English Videos'
              : collectionType === 'grammar'
              ? 'Grammar Lessons & Books'
              : 'Thư viện'}{' '}
            {lesson.level}
          </a>
          <span>
            {lesson.code} ·{' '}
            {collectionType === 'natural'
              ? 'Natural'
              : collectionType === 'videos'
              ? 'Video'
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

        {isDirectVideo ? (
          <section className="video-player">
            <div className="video-player-header">
              <div className="video-player-title">
                <Icon name="play" /> Video bài học
              </div>
              {lesson.subtitleUrl && (
                <button
                  type="button"
                  className={`video-sub-btn ${subtitlesEnabled ? 'active' : ''}`}
                  onClick={toggleSubtitles}
                  title={subtitlesEnabled ? 'Tắt phụ đề (CC)' : 'Bật phụ đề (CC)'}
                >
                  <Icon name="cc" />
                  <span>Phụ đề {subtitlesEnabled ? 'BẬT' : 'TẮT'}</span>
                </button>
              )}
            </div>
            <div className="video-wrapper">
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                src={resolvedVideoSrc}
                onPlay={handleVideoPlay}
                onLoadedMetadata={handleVideoLoadedMetadata}
              >
                {resolvedSubtitleSrc && (
                  <track
                    kind="subtitles"
                    src={resolvedSubtitleSrc}
                    srcLang="en"
                    label="English"
                    default
                  />
                )}
                Trình duyệt của bạn không hỗ trợ phát video HTML5.
              </video>
            </div>
          </section>
        ) : embedVideoUrl ? (
          <section className="video-player">
            <iframe
              src={embedVideoUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </section>
        ) : null}

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
                const fallback = getAudioUrl(lesson.audioUrl);
                if (fallback && e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
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
            {(collectionType === 'natural' || collectionType === 'videos') && (
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
