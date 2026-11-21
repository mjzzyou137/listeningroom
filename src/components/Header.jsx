import React from 'react';

export default function Header({ collection, level, compact = false }) {
  const naturalOrVideoLevel = level === 'A1' ? 'A2' : level;
  const badgeType =
    collection === 'natural'
      ? 'NATURAL'
      : collection === 'videos'
      ? 'VIDEO'
      : collection === 'grammar'
      ? 'GRAMMAR'
      : 'LEVEL';

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
          href={`#/collection/grammar/${level}`}
        >
          Grammar Lessons & Books
        </a>
      </nav>
      <a className="level-pill" href={`#/collection/${collection}/${level}`}>
        {badgeType} {level}
      </a>
    </header>
  );
}
