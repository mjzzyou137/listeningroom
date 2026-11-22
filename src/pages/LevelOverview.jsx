import React, { useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import Icon from '../components/Icon';

export default function LevelOverview({ level, data, savedCount }) {
  const levels = data.levels || [];
  const current = levels.find((item) => item.level === level) || levels[0];
  const safeLevel = current?.level || 'A1';

  useEffect(() => {
    document.title = `${safeLevel} ${current?.levelName || ''} · Choose Your Level`;
  }, [safeLevel, current?.levelName]);

  const natural = data.naturalLevels?.find((item) => item.level === safeLevel);
  const videos = data.videoLevels?.find((item) => item.level === safeLevel);
  const grammar = data.levels?.find((item) => item.level === safeLevel);
  const sections = [
    {
      key: 'natural',
      title: 'Natural Conversations',
      description: 'Hội thoại tự nhiên với Script, Vocabulary và Grammar phân tích từ bài nói.',
      group: natural,
      icon: 'wave'
    },
    {
      key: 'videos',
      title: 'One Minute English Videos',
      description: 'Video ngắn kèm audio, Script, Vocabulary và Grammar được tạo từ Script.',
      group: videos,
      icon: 'play'
    },
    {
      key: 'grammar',
      title: 'Grammar Conversations',
      description: 'Hội thoại luyện ngữ pháp với Script và phần Grammar nguyên bản từ ELLLO.',
      group: grammar,
      icon: 'grid'
    }
  ];

  return (
    <>
      <Header collection="levels" level={safeLevel} />
      <div className="app-shell">
        <Sidebar
          collection="levels"
          currentLevel={safeLevel}
          levels={levels}
          savedCount={savedCount}
        />
        <main className="library-main level-overview">
          <div className="breadcrumbs">
            Choose Your Level <span>/</span> {current?.levelName} ({safeLevel})
          </div>
          <section className="level-overview-hero">
            <div>
              <span className="eyebrow">Choose a learning format</span>
              <h1>{current?.levelName} <em>{safeLevel}</em></h1>
              <p>Chọn một section để xem toàn bộ bài học tương ứng.</p>
            </div>
            <div className="overview-level-mark">{safeLevel}</div>
          </section>
          <section className="level-section-picker">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Three ways to practice</span>
                <h2>Nội dung dành cho {safeLevel}</h2>
              </div>
            </div>
            <div className="level-section-grid">
              {sections.map((section) => {
                const count = section.group?.lessons?.length || 0;
                const content = (
                  <>
                    <span className={`section-icon ${section.key}`}><Icon name={section.icon} /></span>
                    <span className="section-kicker">{safeLevel} · {current?.levelName}</span>
                    <h3>{section.title}</h3>
                    <p>{section.description}</p>
                    <span className="section-action">
                      {count ? `Xem ${count} bài học` : 'Chưa có bài ở level này'}
                      {count > 0 && <Icon name="arrow" />}
                    </span>
                  </>
                );
                return count > 0 ? (
                  <a key={section.key} className={`level-section-card ${section.key}`} href={`#/collection/${section.key}/${safeLevel}`}>
                    {content}
                  </a>
                ) : (
                  <article key={section.key} className={`level-section-card ${section.key} disabled`}>
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
