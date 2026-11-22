import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Icon from '../components/Icon';

export default function LandingPage({ data }) {
  useEffect(() => {
    document.title = 'Listeningroom · ELLLO learning library';
  }, []);

  const featuredIds = {
    natural: {
      A2: 'natural-a2-1451',
      B1: 'natural-b1-1432',
      B2: 'natural-b2-1487',
      C1: 'natural-c1-1493'
    },
    videos: {
      B2: 'video-b2-004'
    }
  };

  const renderSection = (title, subtitle, collection, levels, samples) => {
    const source =
      collection === 'natural'
        ? data.naturalLevels
        : collection === 'videos'
        ? data.videoLevels
        : data.levels;

    return (
      <section className="home-collection" key={collection}>
        <div className="home-section-head">
          <div>
            <span className="eyebrow">{subtitle}</span>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="home-category-grid">
          {levels.map((lvl) => {
            const group = source.find((item) => item.level === lvl);
            const featuredId = featuredIds[collection]?.[lvl];
            const sample = featuredId
              ? group?.lessons.find((lesson) => lesson.id === featuredId)
              : group?.lessons.find((lesson) =>
                  lesson.title.toLowerCase().includes((samples[lvl] || '').toLowerCase())
                );

            const cardTitle =
              collection === 'natural'
                ? 'Conversations'
                : collection === 'videos'
                ? 'Video Lessons'
                : collection === 'grammar'
                ? 'Grammar Lessons'
                : 'Level';

            return (
              <article key={lvl} className={`home-category-card ${collection}`}>
                <span>{group?.levelName || lvl}</span>
                <h3>
                  {cardTitle} ({lvl})
                </h3>
                <p>
                  {samples[lvl]} ({lvl})
                </p>
                <div>
                  <a href={`#/collection/${collection}/${lvl}`}>
                    Xem {group?.lessons?.length || 0} bài
                  </a>
                  {sample && (
                    <a className="sample-link" href={`#/lesson/${sample.id}?collection=${collection}`}>
                      Bài mẫu <Icon name="arrow" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <>
      <Header collection="levels" level="A1" />
      <main className="landing">
        <section className="landing-hero">
          <span className="eyebrow">English listening, beautifully organized</span>
          <h1>
            Nghe tiếng Anh thật.
            <br />
            Tiến bộ từng ngày.
          </h1>
          <p>Thư viện học tập được sắp xếp theo đúng các nhóm nội dung của ELLLO.</p>
          <a className="primary-button" href="#/collection/levels/A1">
            Bắt đầu với A1
          </a>
        </section>

        {renderSection(
          'Choose Your Level',
          'Learn by CEFR level',
          'levels',
          ['A1', 'A2', 'B1', 'B2', 'C1'],
          {
            A1: 'Beginner',
            A2: 'High-Beginner',
            B1: 'Intermediate',
            B2: 'High-Intermediate',
            C1: 'Advanced'
          }
        )}

        {renderSection(
          'Natural Conversations',
          'Authentic conversations',
          'natural',
          ['A2', 'B1', 'B2', 'C1'],
          {
            A2: 'Likes and Favorites',
            B1: 'Going to Mars',
            B2: 'Hard Work vs Talent',
            C1: 'Throwing Things Out'
          }
        )}

        {renderSection(
          'One Minute English Videos',
          'Short video lessons',
          'videos',
          ['A2', 'B1', 'B2', 'C1'],
          {
            A2: 'What do you do on weekends',
            B1: 'How is trash recycled',
            B2: 'Key to happiness',
            C1: 'Racism and Sexism'
          }
        )}

        {renderSection(
          'Grammar Lessons & Books',
          'Grammar practice by level',
          'grammar',
          ['A1', 'A2', 'B1', 'B2', 'C1'],
          {
            A1: '25 Grammar Lessons',
            A2: '25 Grammar Lessons',
            B1: '25 Grammar Lessons',
            B2: '25 Grammar Lessons',
            C1: 'Advanced Grammar Lessons'
          }
        )}
      </main>
      <Footer />
    </>
  );
}
