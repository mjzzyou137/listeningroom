const app = document.querySelector("#app");
const state = { data: null, collection: "levels", level: "A1", search: "", activeTab: "script", saved: new Set(JSON.parse(localStorage.getItem("openear-saved") || "[]")) };
const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[c]);

function icon(name) {
  const paths = {
    arrow:'<path d="m9 18 6-6-6-6"/>', back:'<path d="m15 18-6-6 6-6"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    play:'<path d="m8 5 11 7-11 7V5Z"/>', headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19h1a1 1 0 0 0 1-1v-4h-3v5h1ZM6 19H5a1 1 0 0 1-1-1v-4h3v5H6Z"/>',
    external:'<path d="M15 4h5v5M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>', pause:'<path d="M8 5v14M16 5v14"/>',
    grid:'<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    wave:'<path d="M4 12h2m2-4v8m3-11v14m3-9v4m3-7v10m3-5h1"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function siteHeader(compact = false) {
  return `<header class="site-header ${compact ? "compact" : ""}"><a class="brand" href="#/" aria-label="Listeningroom home"><span class="brand-mark">e</span><span>listening<span>room</span></span></a><nav><a class="${state.collection === "levels" ? "active" : ""}" href="#/collection/levels/${state.level}">Choose Your Level</a><a class="${state.collection === "natural" ? "active" : ""}" href="#/collection/natural/${state.level === "A1" ? "A2" : state.level}">Natural Conversations</a><a class="${state.collection === "videos" ? "active" : ""}" href="#/collection/videos/${state.level === "A1" ? "A2" : state.level}">One Minute English</a><a class="${state.collection === "grammar" ? "active" : ""}" href="#/collection/grammar/${state.level}">Grammar Lessons & Books</a></nav><a class="level-pill" href="#/collection/${state.collection}/${state.level}">${state.collection === "natural" ? "NATURAL" : state.collection === "videos" ? "VIDEO" : state.collection === "grammar" ? "GRAMMAR" : "LEVEL"} ${state.level}</a></header>`;
}

function activeLevels() { return state.collection === "natural" ? state.data.naturalLevels : state.collection === "videos" ? state.data.videoLevels : state.collection === "grammar" ? state.data.levels.filter((level) => level.level !== "C1") : state.data.levels; }

function sidebar(current) {
  const levels = activeLevels(), total = levels.reduce((sum, level) => sum + level.lessons.length, 0);
  const rows = levels.map((level, index) => {
    const title = `${level.levelName} (${level.level})`;
    return `<a href="#/collection/${state.collection}/${level.level}" class="${state.level === level.level ? "active" : ""}">${icon(index ? "wave" : "grid")}<span><strong>${title}</strong></span></a>`;
  }).join("");
  return `<aside class="sidebar"><span class="side-label">${state.collection === "natural" ? "Natural Conversations" : state.collection === "videos" ? "One Minute English Videos" : state.collection === "grammar" ? "Grammar Lessons & Books" : "Choose your level"}</span><nav class="side-nav">${rows}<a href="#saved">${icon("heart")}<span>Bài đã lưu</span><b>${state.saved.size}</b></a></nav><div class="progress-box"><span class="side-label">Tiến độ của bạn</span><strong>0 <small>/ ${total} bài</small></strong><i><em></em></i><p>Mỗi bài học là một bước tiến.</p><small>Lưu trên trình duyệt này</small></div><div class="source-box"><span>Nguồn bài học</span><strong>ELLLO.org</strong><p>Bản thử độc lập, không phải website chính thức của ELLLO.</p></div></aside>`;
}

function renderHome() {
  state.activeTab = "script";
  const levels = activeLevels();
  const current = levels.find((level) => level.level === state.level) || levels[0];
  state.level = current.level;
  document.title = `${current.level} ${current.levelName} · Listeningroom`;
  const lessons = current.lessons.filter((lesson) => `${lesson.code} ${lesson.title} ${lesson.topic} ${lesson.speakers.join(" ")}`.toLowerCase().includes(state.search.toLowerCase()));
  const heroLines = state.collection === "natural" ? ["Real voices.", "Real English."] : state.collection === "videos" ? ["One minute.", "A world of English."] : { A1:["Small lessons.","A confident beginning."], A2:["Build your range.","Speak with more ease."], B1:["Real conversations.","Stronger expression."], B2:["Go beyond basics.","Think in English."], C1:["Nuance and depth.","English at full range."] }[current.level];
  const contentLabel = state.collection === "natural" ? "Script + Vocabulary" : "Script + Grammar";
  app.innerHTML = `${siteHeader()}<div class="app-shell">${sidebar(current)}<main class="library-main"><div class="breadcrumbs">${state.collection === "natural" ? "Natural Conversations" : "Choose Your Level"} <span>/</span> ${current.levelName} (${current.level})</div><section class="library-hero ${state.collection === "natural" ? "natural-hero" : ""}"><div class="library-copy"><span class="eyebrow">${state.collection === "natural" ? "Authentic listening from around the world" : "Your English journey continues here"}</span><h1>${heroLines[0]}<br/>${heroLines[1]}</h1><p>Luyện nghe tiếng Anh ${current.level} qua hội thoại tự nhiên,<br/>với người nói và chủ đề đa dạng từ ELLLO.</p><a class="primary-button" href="#lessons">Khám phá bài học</a><div class="hero-stats"><span>${icon("headphones")} ${current.lessons.length} bài hội thoại</span><span>▤ &nbsp;${contentLabel}</span></div></div><div class="level-art" aria-hidden="true"><div class="speech hello">Listen.</div><div class="a1-card"><b>${current.level}</b><span>${state.collection === "natural" ? "NATURAL" : current.levelName.toUpperCase()}</span></div><div class="speech nice">Learn naturally.</div><div class="hero-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></section><div class="source-note"><strong>Học cùng nội dung gốc ELLLO</strong><span>Chọn một bài để nghe audio và đọc nội dung học tập.</span></div><section class="catalog" id="lessons"><div class="section-heading"><div><span class="eyebrow">Explore & practice</span><h2>${state.collection === "natural" ? "Natural Conversations" : "Thư viện"} · ${current.levelName} (${current.level})</h2></div><span class="lesson-total">${lessons.length} bài học</span></div><div class="catalog-tools"><div class="filter-tabs"><button class="active">Tất cả</button><button>Hội thoại · ${current.lessons.length}</button><button>Đã lưu · ${state.saved.size}</button></div><div class="search-box">${icon("search")}<input id="search" value="${escapeHtml(state.search)}" placeholder="Tìm tên hoặc số bài..." aria-label="Tìm bài học" /></div></div><div class="lesson-grid">${lessons.map(lessonCard).join("") || '<div class="empty-state">Không tìm thấy bài học phù hợp.</div>'}</div></section></main></div>${footer()}`;
  if (state.collection === "grammar") {
    const breadcrumbs = document.querySelector(".breadcrumbs");
    const heading = document.querySelector(".catalog h2");
    if (breadcrumbs) breadcrumbs.innerHTML = `Grammar Lessons &amp; Books <span>/</span> ${current.levelName} (${current.level})`;
    if (heading) heading.textContent = `Grammar Lessons & Books · ${current.levelName} (${current.level})`;
  }
  const search = document.querySelector("#search");
  search?.addEventListener("input", (event) => { state.search = event.target.value; renderHome(); document.querySelector("#search")?.focus(); });
  document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const id = button.dataset.save; state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id); localStorage.setItem("openear-saved", JSON.stringify([...state.saved])); renderHome(); }));
}

function lessonCard(lesson) {
  const number = lesson.code.split("-")[1];
  return `<a class="lesson-card" href="#/lesson/${lesson.id}"><div class="card-visual"><span class="card-type">${lesson.collection === "natural" ? "Natural conversation" : "Grammar conversation"}</span><button class="save-button ${state.saved.has(lesson.id) ? "saved" : ""}" data-save="${lesson.id}" aria-label="Lưu bài học">${icon("heart")}</button><div class="sound-graphic"><span class="round-play">${icon("play")}</span><div class="mini-wave"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><span class="card-level">${lesson.level} · ${escapeHtml(lesson.levelName)}</span><b class="card-number">${number}</b></div><div class="card-body"><span>BÀI ${number}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.topic)}</p><div class="card-footer"><strong>Xem bài học</strong><small>○ Chưa học</small></div></div></a>`;
}

function initAudioSync(lesson) {
  const audio = document.querySelector("#lesson-audio");
  const transcript = document.querySelector(".transcript-content");
  if (!audio || !transcript) return;
  const lines = [...transcript.querySelectorAll("p")].filter((line) => line.textContent.trim());
  if (!lines.length) return;
  const weights = lines.map((line) => Math.max(1, (line.textContent.replace(/^[^:]{1,24}:\s*/, "").match(/[\p{L}\d']+/gu) || []).length + 0.7));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const preciseTimings = Array.isArray(lesson.scriptTimings) && lesson.scriptTimings.length === lines.length ? lesson.scriptTimings : null;
  let activeIndex = -1;
  let autoScroll = true;
  app.insertAdjacentHTML("beforeend", `<button class="audio-sync-control" type="button" aria-label="Pause audio">${icon("pause")}<span>Pause</span></button>`);
  const control = document.querySelector(".audio-sync-control");

  const setControl = () => {
    const playing = !audio.paused && !audio.ended;
    control.classList.toggle("visible", playing || audio.currentTime > 0);
    control.innerHTML = `${icon(playing ? "pause" : "play")}<span>${playing ? "Pause" : "Play"}</span>`;
    control.setAttribute("aria-label", playing ? "Pause audio" : "Resume audio");
  };
  const clearHighlight = () => lines.forEach((line) => line.classList.remove("script-active"));
  const seekToLine = (index) => {
    const seek = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      const weightBefore = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
      const targetTime = preciseTimings ? preciseTimings[index] : (weightBefore / totalWeight) * audio.duration;
      audio.currentTime = Math.min(audio.duration - 0.05, targetTime);
      activeIndex = -1;
      autoScroll = true;
      sync();
      audio.play().catch(() => {});
    };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener("loadedmetadata", seek, { once: true });
  };
  const sync = () => {
    let nextIndex;
    if (preciseTimings) {
      nextIndex = preciseTimings.findLastIndex((time) => time <= audio.currentTime + 0.04);
      if (nextIndex < 0) nextIndex = 0;
    } else {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      const target = (audio.currentTime / audio.duration) * totalWeight;
      let running = 0;
      const index = weights.findIndex((weight) => { running += weight; return target <= running; });
      nextIndex = index < 0 ? lines.length - 1 : index;
    }
    if (nextIndex === activeIndex) return;
    clearHighlight();
    activeIndex = nextIndex;
    const activeLine = lines[activeIndex];
    activeLine.classList.add("script-active");
    if (autoScroll && !audio.paused) activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  audio.addEventListener("play", () => { autoScroll = true; setControl(); sync(); });
  audio.addEventListener("pause", setControl);
  audio.addEventListener("ended", () => { setControl(); clearHighlight(); });
  audio.addEventListener("timeupdate", sync);
  audio.addEventListener("seeked", () => { activeIndex = -1; sync(); });
  control.addEventListener("click", () => { audio.paused ? audio.play() : audio.pause(); });
  lines.forEach((line, index) => {
    line.classList.add("script-seekable");
    line.setAttribute("title", "Phát audio từ đoạn này");
    line.setAttribute("tabindex", "0");
    line.addEventListener("click", () => seekToLine(index));
    line.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); seekToLine(index); }
    });
  });
  setControl();
}

function renderDetail(id) {
  const allCollections = [...state.data.levels, ...state.data.naturalLevels, ...state.data.videoLevels];
  const lesson = allCollections.flatMap((level) => level.lessons).find((item) => item.id === id);
  if (!lesson) return renderNotFound();
  state.collection = lesson.collection === "natural" ? "natural" : lesson.collection === "videos" ? "videos" : state.collection === "grammar" ? "grammar" : "levels";
  state.level = lesson.level || state.level;
  document.title = `${lesson.title} · ${state.level} Listeningroom`;
  const collection = activeLevels().find((level) => level.level === state.level).lessons;
  const lessonIndex = collection.indexOf(lesson), next = collection[(lessonIndex + 1) % collection.length];
  const secondaryKey = state.collection === "natural" && state.activeTab !== "grammar" ? "vocabulary" : "grammar";
  const secondaryLabel = secondaryKey === "vocabulary" ? "Vocabulary" : "Grammar";
  const secondaryHtml = secondaryKey === "vocabulary" ? lesson.vocabularyHtml : lesson.grammarHtml;
  const allowedTabs = state.collection === "natural" ? ["script", "vocabulary", "grammar"] : ["script", "grammar"];
  if (!allowedTabs.includes(state.activeTab)) state.activeTab = "script";
  app.innerHTML = `${siteHeader(true)}<main class="detail-page"><div class="detail-topbar"><a href="#/collection/${state.collection}/${state.level}">${icon("back")} ${state.collection === "natural" ? "Natural Conversations" : "Thư viện"} ${state.level}</a><span>${lesson.code} · ${state.collection === "natural" ? "Natural" : "Grammar"} conversation</span></div><section class="lesson-hero ${state.collection === "natural" ? "natural-hero" : ""}"><div class="lesson-heading"><span class="eyebrow">${escapeHtml(lesson.topic)}</span><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.description)}</p><div class="speaker-row">${lesson.speakers.map((speaker) => `<span><b>${escapeHtml(speaker.charAt(0))}</b>${escapeHtml(speaker)}</span>`).join("")}</div></div><div class="lesson-art"><span>${lesson.code.split("-")[1]}</span><div class="large-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></section><section class="player-card"><div class="player-label">${icon("headphones")}<div><span>Đang nghe</span><strong>${escapeHtml(lesson.title)}</strong></div></div>${lesson.audioUrl ? `<audio id="lesson-audio" controls preload="metadata" src="${lesson.audioUrl}"></audio>` : '<span>Audio nguồn không còn khả dụng</span>'}${lesson.youtubeUrl ? `<a class="youtube-link" href="${lesson.youtubeUrl}" target="_blank" rel="noreferrer">YouTube ${icon("external")}</a>` : ""}</section><section class="lesson-content"><div class="tabs" role="tablist"><button class="${state.activeTab === "script" ? "active" : ""}" data-tab="script">Script</button><button class="${state.activeTab === secondaryKey ? "active" : ""}" data-tab="${secondaryKey}">${secondaryLabel}</button></div><article class="reading-panel ${state.activeTab === "script" ? "transcript-content" : "grammar-content"}"><div class="panel-heading"><span>${state.activeTab === "script" ? "Conversation transcript" : secondaryLabel}</span><small>${lesson.code}</small></div>${state.activeTab === "script" ? lesson.transcriptHtml : (secondaryHtml || `<p>ELLLO không cung cấp ${secondaryLabel.toLowerCase()} riêng cho bài này.</p>`)}</article><aside class="next-lesson"><span>Tiếp theo</span><div><small>${next.code}</small><strong>${escapeHtml(next.title)}</strong></div><a href="#/lesson/${next.id}">${icon("arrow")}</a></aside></section></main>${footer()}`;
  if (lesson.videoUrl) {
    document.querySelector(".lesson-hero")?.insertAdjacentHTML("afterend", `<section class="video-player"><iframe src="${lesson.videoUrl}" title="${escapeHtml(lesson.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><span>Nguồn video: ELLLO</span></section>`);
  }
  if (state.collection === "natural") {
    const tabs = document.querySelector(".lesson-content .tabs");
    if (tabs) tabs.innerHTML = `<button class="${state.activeTab === "script" ? "active" : ""}" data-tab="script">Script</button><button class="${state.activeTab === "vocabulary" ? "active" : ""}" data-tab="vocabulary">Vocabulary</button><button class="${state.activeTab === "grammar" ? "active" : ""}" data-tab="grammar">Grammar</button>`;
  }
  if (state.activeTab === "script") initAudioSync(lesson);
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { state.activeTab = button.dataset.tab; renderDetail(id); document.querySelector(".lesson-content")?.scrollIntoView({ block: "start" }); }));
}

function footer() { return `<footer><div class="brand"><span class="brand-mark">e</span><span>listening<span>room</span></span></div><p>Nội dung học tập từ ELLLO. Bản thử phục vụ học tập và luôn ghi công nguồn gốc.</p></footer>`; }
function renderNotFound() { app.innerHTML = `${siteHeader()}<main class="not-found"><span>404</span><h1>Không tìm thấy bài học</h1><a class="primary-button" href="#/">Về thư viện</a></main>${footer()}`; }

function renderLanding() {
  document.title = "Listeningroom · ELLLO learning library";
  const featuredIds = { natural: { A2: "natural-a2-1451", B1: "natural-b1-1432", B2: "natural-b2-1487", C1: "natural-c1-1493" }, videos: { B2: "video-b2-004" } };
  const section = (title, subtitle, collection, levels, samples) => {
    const source = collection === "natural" ? state.data.naturalLevels : collection === "videos" ? state.data.videoLevels : state.data.levels;
    const cards = levels.map((level) => {
      const group = source.find((item) => item.level === level);
      const featuredId = featuredIds[collection]?.[level];
      const sample = featuredId ? group?.lessons.find((lesson) => lesson.id === featuredId) : group?.lessons.find((lesson) => lesson.title.toLowerCase().includes(samples[level].toLowerCase()));
      return `<article class="home-category-card ${collection}"><span>${group?.levelName || level}</span><h3>${collection === "natural" ? "Conversations" : collection === "videos" ? "Video Lessons" : collection === "grammar" ? "Grammar Lessons" : "Level"} (${level})</h3><p>${escapeHtml(samples[level])} (${level})</p><div><a href="#/collection/${collection}/${level}">Xem ${group?.lessons.length || 0} bài</a>${sample ? `<a class="sample-link" href="#/lesson/${sample.id}">Bài mẫu ${icon("arrow")}</a>` : ""}</div></article>`;
    }).join("");
    return `<section class="home-collection"><div class="home-section-head"><div><span class="eyebrow">${subtitle}</span><h2>${title}</h2></div></div><div class="home-category-grid">${cards}</div></section>`;
  };
  app.innerHTML = `${siteHeader()}<main class="landing"><section class="landing-hero"><span class="eyebrow">English listening, beautifully organized</span><h1>Nghe tiếng Anh thật.<br/>Tiến bộ từng ngày.</h1><p>Thư viện học tập được sắp xếp theo đúng các nhóm nội dung của ELLLO.</p><a class="primary-button" href="#/collection/levels/A1">Bắt đầu với A1</a></section>${section("Choose Your Level", "Learn by CEFR level", "levels", ["A1","A2","B1","B2","C1"], {A1:"Beginner",A2:"High-Beginner",B1:"Intermediate",B2:"High-Intermediate",C1:"Advanced"})}${section("Natural Conversations", "Authentic conversations", "natural", ["A2","B1","B2","C1"], {A2:"Likes and Favorites",B1:"Going to Mars",B2:"Hard Work vs Talent",C1:"Throwing Things Out"})}${section("One Minute English Videos", "Short video lessons", "videos", ["A2","B1","B2","C1"], {A2:"What do you do on weekends",B1:"How is trash recycled",B2:"Key to happiness",C1:"Racism and Sexism"})}${section("Grammar Lessons & Books", "Grammar practice by level", "grammar", ["A1","A2","B1","B2"], {A1:"25 Grammar Lessons",A2:"25 Grammar Lessons",B1:"25 Grammar Lessons",B2:"25 Grammar Lessons"})}</main>${footer()}`;
}

function route() {
  const lessonMatch = location.hash.match(/^#\/lesson\/(.+)$/);
  const collectionMatch = location.hash.match(/^#\/collection\/(levels|natural|videos|grammar)\/(A1|A2|B1|B2|C1)$/i);
  const legacyMatch = location.hash.match(/^#\/level\/(A1|A2|B1|B2|C1)$/i);
  if (lessonMatch) renderDetail(lessonMatch[1]);
  else if (!location.hash || location.hash === "#/" || location.hash === "#") renderLanding();
  else {
    if (collectionMatch) { state.collection = collectionMatch[1].toLowerCase(); state.level = collectionMatch[2].toUpperCase(); state.search = ""; }
    else if (legacyMatch) { state.collection = "levels"; state.level = legacyMatch[1].toUpperCase(); state.search = ""; }
    renderHome();
  }
  window.scrollTo({ top: 0 });
}
Promise.all([fetch("/data/all-lessons.json?v=2"), fetch("/data/natural-conversations.json?v=5"), fetch("/data/one-minute-videos.json?v=3")]).then(async ([levelsResponse, naturalResponse, videoResponse]) => {
  if (!levelsResponse.ok || !naturalResponse.ok || !videoResponse.ok) throw new Error("Không thể tải dữ liệu bài học");
  const levels = await levelsResponse.json(), natural = await naturalResponse.json(), videos = await videoResponse.json();
  state.data = { levels: levels.levels, naturalLevels: natural.levels, videoLevels: videos.levels };
  window.addEventListener("hashchange", route); route();
}).catch((error) => { app.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; });
