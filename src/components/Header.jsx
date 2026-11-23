import React from 'react';

export default function Header({ collection, level, compact = false }) {
  const badgeType =
    collection === 'natural'
      ? 'NATURAL'
      : collection === 'videos'
      ? 'VIDEO'
      : collection === 'grammar'
      ? 'GRAMMAR'
      : collection === 'translation'
      ? 'LUYỆN DỊCH'
      : collection === 'sentence-building'
      ? 'GHÉP CÂU'
      : 'LEVEL';

  const currentLevel = level || 'A1';
  const naturalOrVideoLevel = currentLevel === 'A1' ? 'A2' : currentLevel;
  const pillHref =
    collection === 'translation'
      ? '#/translation'
      : collection === 'sentence-building'
      ? '#/sentence-building'
      : `#/collection/${collection}/${currentLevel}`;

  return (
    <header className={`site-header ${compact ? 'compact' : ''}`}>
      <a className="brand" href="#/" aria-label="Listeningroom home">
        <span className="brand-mark">e</span>
        <span>
          listening<span>room</span>
        </span>
      </a>
      <nav>
        <a
          className={collection === 'levels' ? 'active' : ''}
          href={`#/collection/levels/${level}`}
        >
          Choose Your Level
        </a>
        <a
          className={collection === 'natural' ? 'active' : ''}
          href={`#/collection/natural/${naturalOrVideoLevel}`}
        >
          Natural Conversations
        </a>
        <a
          className={collection === 'videos' ? 'active' : ''}
          href={`#/collection/videos/${naturalOrVideoLevel}`}
        >
          One Minute English
        </a>
        <a
          className={collection === 'grammar' ? 'active' : ''}
          href={`#/collection/grammar/${currentLevel}`}
        >
          Grammar Lessons & Books
        </a>
        <a
          className={collection === 'translation' ? 'active' : ''}
          href="#/translation"
        >
          Luyện dịch
        </a>
        <a
          className={collection === 'sentence-building' ? 'active' : ''}
          href="#/sentence-building"
        >
          Ghép câu
        </a>
      </nav>
      <a className="level-pill" href={pillHref}>
        {badgeType} {collection === 'translation' ? '400 BÀI' : collection === 'sentence-building' ? '2500 CÂU' : currentLevel}
      </a>
    </header>
  );
}
