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

        <section className="home-category-section">
          <div className="home-category-head">
            <div>
              <span className="eyebrow">Dịch Việt → Anh</span>
              <h2>Luyện Dịch 90 Chủ Đề</h2>
            </div>
            <p>Tự viết bản dịch vào dòng kẻ, kiểm tra đối chiếu từng từ đúng/sai từ A1 đến B1 theo chủ đề.</p>
          </div>
          <div className="home-category-grid">
            <article className="home-category-card">
              <span>Cấp A1 (Bài 1–30)</span>
              <h3>Hiện tại đơn & Tiếp diễn</h3>
              <p>Giới thiệu bản thân, Gia đình tôi, Bữa sáng, Sở thích...</p>
              <div>
                <a href="#/translation/A1">Luyện 30 bài A1</a>
                <a className="sample-link" href="#/translation/lesson/translation-a1-01">
                  Bài 1 mẫu <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Cấp A2 (Bài 31–60)</span>
              <h3>Quá khứ, Tương lai, So sánh</h3>
              <p>Đi siêu thị, Một ngày mưa, Nhà hàng, Kế hoạch...</p>
              <div>
                <a href="#/translation/A2">Luyện 30 bài A2</a>
                <a className="sample-link" href="#/translation/lesson/translation-a2-31">
                  Bài 31 mẫu <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Cấp B1 (Bài 61–90)</span>
              <h3>Hiện tại hoàn thành & Quan điểm</h3>
              <p>Lợi ích đọc sách, Mạng xã hội, Làm việc ở nhà, AI...</p>
              <div>
                <a href="#/translation/B1">Luyện 30 bài B1</a>
                <a className="sample-link" href="#/translation/lesson/translation-b1-61">
                  Bài 61 mẫu <Icon name="arrow" />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section className="home-category-section">
          <div className="home-category-head">
            <div>
              <span className="eyebrow">Ráp Câu & Luyện Nghe</span>
              <h2>Ghép Câu Tiếng Anh (2,500 Câu)</h2>
            </div>
            <p>Ráp các từ xáo trộn thành câu hoàn chỉnh theo 90 chủ đề từ cơ bản đến nâng cao, kèm audio nghe toàn bài với phát âm chuẩn.</p>
          </div>
          <div className="home-category-grid">
            <article className="home-category-card">
              <span>Phần 1 (Chủ đề 1–10)</span>
              <h3>Giao tiếp cơ bản</h3>
              <p>Chào hỏi, Giới thiệu, Cảm ơn & Xin lỗi, Hỏi đường, Gia đình...</p>
              <div>
                <a href="#/sentence-building/part-1">10 chủ đề (300 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-01">
                  Chủ đề 1 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 2 (Chủ đề 11–20)</span>
              <h3>Đời sống & Sinh hoạt</h3>
              <p>Thói quen hàng ngày, Ăn uống, Mua sắm, Nhà cửa, Thời tiết...</p>
              <div>
                <a href="#/sentence-building/part-2">10 chủ đề (300 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-11">
                  Chủ đề 11 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 3 (Chủ đề 21–30)</span>
              <h3>Công việc & Sự nghiệp</h3>
              <p>Phỏng vấn, Đồng nghiệp, Cuộc họp, Báo cáo tiến độ, Đàm phán...</p>
              <div>
                <a href="#/sentence-building/part-3">10 chủ đề (300 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-21">
                  Chủ đề 21 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 4 & 5 (Chủ đề 31–50)</span>
              <h3>Giải trí & Nâng cao</h3>
              <p>Du lịch, Sở thích, Sức khỏe, Tranh luận, Tình huống khẩn cấp...</p>
              <div>
                <a href="#/sentence-building/part-4">20 chủ đề (600 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-31">
                  Chủ đề 31 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 6 (Chủ đề 51–60)</span>
              <h3>Gặp Người Nước Ngoài</h3>
              <p>Bắt chuyện, Small talk, Phục vụ khách, Đi chợ, Thuê nhà...</p>
              <div>
                <a href="#/sentence-building/part-6">10 chủ đề (250 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-51">
                  Chủ đề 51 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 7 (Chủ đề 61–70)</span>
              <h3>Đời Sống Người Trẻ</h3>
              <p>Mạng xã hội, Từ lóng, Hẹn hò, Thời trang, Gym & Fitness...</p>
              <div>
                <a href="#/sentence-building/part-7">10 chủ đề (250 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-61">
                  Chủ đề 61 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 8 (Chủ đề 71–80)</span>
              <h3>Giao Tiếp Nâng Cao</h3>
              <p>Kể chuyện quá khứ, Ước mơ, Đưa lời khuyên, Thuyết phục...</p>
              <div>
                <a href="#/sentence-building/part-8">10 chủ đề (250 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-71">
                  Chủ đề 71 <Icon name="arrow" />
                </a>
              </div>
            </article>
            <article className="home-category-card">
              <span>Phần 9 (Chủ đề 81–90)</span>
              <h3>Học Tập & Thi Cử</h3>
              <p>IELTS Speaking Part 1 & 2, Tự học, Viết CV, Quản lý deadline...</p>
              <div>
                <a href="#/sentence-building/part-9">10 chủ đề (250 câu)</a>
                <a className="sample-link" href="#/sentence-building/topic/topic-81">
                  Chủ đề 81 <Icon name="arrow" />
                </a>
              </div>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
