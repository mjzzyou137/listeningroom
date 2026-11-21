import React from 'react';
import Icon from './Icon';

export default function LessonCard({ lesson, collection, isSaved, onToggleSave }) {
  const number = lesson.code ? lesson.code.split('-')[1] : '';
  const col = collection || (lesson.collection === 'natural' ? 'natural' : lesson.collection === 'videos' ? 'videos' : 'levels');

  return (
    <a className="lesson-card" href={`#/lesson/${lesson.id}?collection=${col}`}>
      <div className="card-visual">
        <span className="card-type">
          {lesson.collection === 'natural'
            ? 'Natural conversation'
            : 'Grammar conversation'}
        </span>
        <button
          type="button"
          className={`save-button ${isSaved ? 'saved' : ''}`}
          aria-label="Lưu bài học"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave(lesson.id);
          }}
        >
          <Icon name="heart" />
        </button>
        <div className="sound-graphic">
          <span className="round-play">
            <Icon name="play" />
          </span>
          <div className="mini-wave">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <span className="card-level">
          {lesson.level} · {lesson.levelName}
        </span>
        <b className="card-number">{number}</b>
      </div>
      <div className="card-body">
        <span>BÀI {number}</span>
        <h3>{lesson.title}</h3>
        <p>{lesson.topic}</p>
        <div className="card-footer">
          <strong>Xem bài học</strong>
          <small>○ Chưa học</small>
        </div>
      </div>
    </a>
  );
}
