import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';

export default function CollectionPage({
  collection,
  level,
  data,
  saved,
  onToggleSave,
  initialFilter = 'all'
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(initialFilter); // 'all' | 'conversations' | 'saved'

  useEffect(() => {
    setFilterType(initialFilter);
  }, [initialFilter, collection, level]);

  const activeLevels =
    collection === 'natural'
      ? data.naturalLevels
      : collection === 'videos'
      ? data.videoLevels
      : collection === 'grammar'
      ? data.levels.filter((lvl) => lvl.level !== 'C1')
      : data.levels;

  const currentLevel = activeLevels.find((lvl) => lvl.level === level) || activeLevels[0];
  const safeLevel = currentLevel?.level || level;

  useEffect(() => {
    if (currentLevel) {
      document.title = `${currentLevel.level} ${currentLevel.levelName} · Listeningroom`;
    }
  }, [currentLevel]);

  const heroLinesMap = {
    A1: ['Small lessons.', 'A confident beginning.'],
    A2: ['Build your range.', 'Speak with more ease.'],
    B1: ['Real conversations.', 'Stronger expression.'],
    B2: ['Go beyond basics.', 'Think in English.'],
    C1: ['Nuance and depth.', 'English at full range.']
  };

  const heroLines =
    collection === 'natural'
      ? ['Real voices.', 'Real English.']
      : collection === 'videos'
      ? ['One minute.', 'A world of English.']
      : heroLinesMap[safeLevel] || ['Small lessons.', 'A confident beginning.'];

  const contentLabel =
    collection === 'natural' ? 'Script + Vocabulary' : 'Script + Grammar';

  const allLessons = currentLevel?.lessons || [];

  const filteredLessons = allLessons.filter((lesson) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${lesson.code} ${lesson.title} ${lesson.topic} ${(lesson.speakers || []).join(' ')}`
        .toLowerCase()
        .includes(query);

    if (!matchesSearch) return false;

    if (filterType === 'saved') {
      return saved.has(lesson.id);
    }
    return true;
  });

  const savedCount = allLessons.filter((l) => saved.has(l.id)).length;

  const breadcrumbPrefix =
    collection === 'natural'
      ? 'Natural Conversations'
      : collection === 'grammar'
      ? 'Grammar Lessons & Books'
      : collection === 'videos'
      ? 'One Minute English Videos'
      : 'Choose Your Level';

  const headingPrefix =
    collection === 'natural'
      ? 'Natural Conversations'
      : collection === 'grammar'
      ? 'Grammar Lessons & Books'
      : 'Thư viện';

  return (
    <>
      <Header collection={collection} level={safeLevel} />
      <div className="app-shell">
        <Sidebar
          collection={collection}
          currentLevel={safeLevel}
          levels={activeLevels}
          savedCount={saved.size}
          onSelectSaved={() => setFilterType('saved')}
        />
        <main className="library-main">
          <div className="breadcrumbs">
            {breadcrumbPrefix} <span>/</span> {currentLevel?.levelName} ({safeLevel})
          </div>

          <section
            className={`library-hero ${collection === 'natural' ? 'natural-hero' : ''}`}
          >
            <div className="library-copy">
              <span className="eyebrow">
                {collection === 'natural'
                  ? 'Authentic listening from around the world'
                  : 'Your English journey continues here'}
              </span>
              <h1>
                {heroLines[0]}
                <br />
                {heroLines[1]}
              </h1>
              <p>
                Luyện nghe tiếng Anh {safeLevel} qua hội thoại tự nhiên,
                <br />
                với người nói và chủ đề đa dạng từ ELLLO.
              </p>
              <a className="primary-button" href="#lessons">
                Khám phá bài học
              </a>
              <div className="hero-stats">
                <span>
                  <Icon name="headphones" /> {allLessons.length} bài hội thoại
                </span>
                <span>▤ &nbsp;{contentLabel}</span>
              </div>
            </div>

            <div className="level-art" aria-hidden="true">
              <div className="speech hello">Listen.</div>
              <div className="a1-card">
                <b>{safeLevel}</b>
                <span>
                  {collection === 'natural'
                    ? 'NATURAL'
                    : currentLevel?.levelName?.toUpperCase()}
                </span>
              </div>
              <div className="speech nice">Learn naturally.</div>
              <div className="hero-wave">
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

          <div className="source-note">
            <strong>Học cùng nội dung gốc ELLLO</strong>
            <span>Chọn một bài để nghe audio và đọc nội dung học tập.</span>
          </div>

          <section className="catalog" id="lessons">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Explore & practice</span>
                <h2>
                  {headingPrefix} · {currentLevel?.levelName} ({safeLevel})
                </h2>
              </div>
              <span className="lesson-total">{filteredLessons.length} bài học</span>
            </div>

            <div className="catalog-tools">
              <div className="filter-tabs">
                <button
                  type="button"
                  className={filterType === 'all' ? 'active' : ''}
                  onClick={() => setFilterType('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={filterType === 'conversations' ? 'active' : ''}
                  onClick={() => setFilterType('conversations')}
                >
                  Hội thoại · {allLessons.length}
                </button>
                <button
                  type="button"
                  className={filterType === 'saved' ? 'active' : ''}
                  onClick={() => setFilterType('saved')}
                >
                  Đã lưu · {savedCount}
                </button>
              </div>

              <div className="search-box">
                <Icon name="search" />
                <input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên hoặc số bài..."
                  aria-label="Tìm bài học"
                />
              </div>
            </div>

            <div className="lesson-grid">
              {filteredLessons.length > 0 ? (
                filteredLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    collection={collection}
                    isSaved={saved.has(lesson.id)}
                    onToggleSave={onToggleSave}
                  />
                ))
              ) : (
                <div className="empty-state">
                  {filterType === 'saved'
                    ? 'Chưa có bài học nào được lưu ở cấp độ này.'
                    : 'Không tìm thấy bài học phù hợp.'}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
