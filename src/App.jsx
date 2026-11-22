import React, { useState, useEffect, useCallback } from 'react';
import LandingPage from './pages/LandingPage';
import CollectionPage from './pages/CollectionPage';
import LessonDetail from './pages/LessonDetail';
import LevelOverview from './pages/LevelOverview';
import TranslationPage from './pages/TranslationPage';
import SentenceBuildingPage from './pages/SentenceBuildingPage';

function parseHash(hash) {
  if (!hash || hash === '#/' || hash === '#') {
    return { type: 'landing' };
  }

  const [hashPath, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString || '');
  const collectionQuery = params.get('collection') || params.get('from');

  const transLessonMatch = hashPath.match(/^#\/translation\/lesson\/(.+)$/i);
  if (transLessonMatch) {
    return {
      type: 'translation',
      lessonId: transLessonMatch[1],
      collection: 'translation'
    };
  }

  const transLevelMatch = hashPath.match(/^#\/translation\/(A1|A2|B1)$/i);
  if (transLevelMatch) {
    return {
      type: 'translation',
      level: transLevelMatch[1].toUpperCase(),
      collection: 'translation'
    };
  }

  if (hashPath === '#/translation' || hashPath === '#translation') {
    return {
      type: 'translation',
      level: 'ALL',
      collection: 'translation'
    };
  }

  const sbTopicMatch = hashPath.match(/^#\/sentence-building\/topic\/(.+)$/i);
  if (sbTopicMatch) {
    return {
      type: 'sentence-building',
      topicId: sbTopicMatch[1],
      collection: 'sentence-building'
    };
  }

  const sbPartMatch = hashPath.match(/^#\/sentence-building\/(part-\d+)$/i);
  if (sbPartMatch) {
    return {
      type: 'sentence-building',
      part: sbPartMatch[1].toLowerCase(),
      collection: 'sentence-building'
    };
  }

  if (hashPath === '#/sentence-building' || hashPath === '#sentence-building') {
    return {
      type: 'sentence-building',
      part: 'ALL',
      collection: 'sentence-building'
    };
  }

  const lessonColMatch = hashPath.match(
    /^#\/collection\/(levels|natural|videos|grammar)\/(A1|A2|B1|B2|C1)\/lesson\/(.+)$/i
  );
  if (lessonColMatch) {
    return {
      type: 'lesson',
      collection: lessonColMatch[1].toLowerCase(),
      level: lessonColMatch[2].toUpperCase(),
      lessonId: lessonColMatch[3]
    };
  }

  const lessonMatch = hashPath.match(/^#\/lesson\/(.+)$/);
  if (lessonMatch) {
    return {
      type: 'lesson',
      lessonId: lessonMatch[1],
      collection: collectionQuery ? collectionQuery.toLowerCase() : null
    };
  }

  const collectionMatch = hashPath.match(
    /^#\/collection\/(levels|natural|videos|grammar)\/(A1|A2|B1|B2|C1)$/i
  );
  if (collectionMatch) {
    return {
      type: 'collection',
      collection: collectionMatch[1].toLowerCase(),
      level: collectionMatch[2].toUpperCase(),
      filter: 'all'
    };
  }

  const legacyMatch = hashPath.match(/^#\/level\/(A1|A2|B1|B2|C1)$/i);
  if (legacyMatch) {
    return {
      type: 'collection',
      collection: 'levels',
      level: legacyMatch[1].toUpperCase(),
      filter: 'all'
    };
  }

  if (hashPath === '#saved' || hashPath === '#/saved') {
    return {
      type: 'collection',
      collection: 'levels',
      level: 'A1',
      filter: 'saved'
    };
  }

  return { type: 'landing' };
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [lastCollection, setLastCollection] = useState(() => {
    const initial = parseHash(window.location.hash);
    return initial.collection || localStorage.getItem('openear-collection') || 'levels';
  });

  useEffect(() => {
    if (route.collection) {
      setLastCollection(route.collection);
      try {
        localStorage.setItem('openear-collection', route.collection);
      } catch {}
    }
  }, [route.collection]);
  const [saved, setSaved] = useState(() => {
    try {
      const stored = localStorage.getItem('openear-saved');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/data/all-lessons.json?v=20261122_01'),
      fetch('/data/natural-conversations.json?v=20261122_01'),
      fetch('/data/one-minute-videos.json?v=20261122_01')
    ])
      .then(async ([levelsRes, naturalRes, videoRes]) => {
        if (!levelsRes.ok || !naturalRes.ok || !videoRes.ok) {
          throw new Error('Không thể tải dữ liệu bài học');
        }
        const levels = await levelsRes.json();
        const natural = await naturalRes.json();
        const videos = await videoRes.json();

        setData({
          levels: levels.levels,
          naturalLevels: natural.levels,
          videoLevels: videos.levels
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Đã có lỗi xảy ra');
        setLoading(false);
      });
  }, []);

  const toggleSave = useCallback((lessonId) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      try {
        localStorage.setItem('openear-saved', JSON.stringify([...next]));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div id="app">
        <div className="loading">Loading lessons…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="app">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (route.type === 'translation') {
    return (
      <TranslationPage
        lessonId={route.lessonId}
        levelFilter={route.level}
      />
    );
  }

  if (route.type === 'sentence-building') {
    return (
      <SentenceBuildingPage
        topicId={route.topicId}
        partFilter={route.part}
      />
    );
  }

  if (route.type === 'lesson') {
    return (
      <div id="app">
        <LessonDetail
          lessonId={route.lessonId}
          preferredCollection={route.collection || lastCollection}
          data={data}
        />
      </div>
    );
  }

  if (route.type === 'collection') {
    if (route.collection === 'levels') {
      return (
        <div id="app">
          <LevelOverview level={route.level} data={data} savedCount={saved.size} />
        </div>
      );
    }
    return (
      <div id="app">
        <CollectionPage
          collection={route.collection}
          level={route.level}
          data={data}
          saved={saved}
          onToggleSave={toggleSave}
          initialFilter={route.filter || 'all'}
        />
      </div>
    );
  }

  return (
    <div id="app">
      <LandingPage data={data} />
    </div>
  );
}
