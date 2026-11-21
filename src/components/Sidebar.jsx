import React from 'react';
import Icon from './Icon';

export default function Sidebar({
  collection,
  currentLevel,
  levels,
  savedCount,
  onSelectSaved
}) {
  const total = levels.reduce((sum, lvl) => sum + (lvl.lessons ? lvl.lessons.length : 0), 0);

  const sideLabel =
    collection === 'natural'
      ? 'Natural Conversations'
      : collection === 'videos'
      ? 'One Minute English Videos'
      : collection === 'grammar'
      ? 'Grammar Lessons & Books'
      : 'Choose your level';

  return (
    <aside className="sidebar">
      <span className="side-label">{sideLabel}</span>
      <nav className="side-nav">
        {levels.map((lvl, index) => {
          const title = `${lvl.levelName} (${lvl.level})`;
          const isActive = currentLevel === lvl.level;
          return (
            <a
              key={lvl.level}
              href={`#/collection/${collection}/${lvl.level}`}
              className={isActive ? 'active' : ''}
            >
              <Icon name={index ? 'wave' : 'grid'} />
              <span>
                <strong>{title}</strong>
              </span>
            </a>
          );
        })}
        <a
          href="#saved"
          onClick={(e) => {
            if (onSelectSaved) {
              e.preventDefault();
              onSelectSaved();
            }
          }}
        >
          <Icon name="heart" />
          <span>Bài đã lưu</span>
          <b>{savedCount}</b>
        </a>
      </nav>
      <div className="progress-box">
        <span className="side-label">Tiến độ của bạn</span>
        <strong>
          0 <small>/ {total} bài</small>
        </strong>
        <i>
          <em />
        </i>
        <p>Mỗi bài học là một bước tiến.</p>
        <small>Lưu trên trình duyệt này</small>
      </div>
      <div className="source-box">
        <span>Nguồn bài học</span>
        <strong>ELLLO.org</strong>
        <p>Bản thử độc lập, không phải website chính thức của ELLLO.</p>
      </div>
    </aside>
  );
}
