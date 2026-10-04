// NAME: upcomingSong
// AUTHOR: Fl3xm3ist3r (https://github.com/fl3xm3ist3r)
// DESCRIPTION: Displays the upcoming song near the current song based on the queue.

(function upcomingSong() {
  const INSTANCE_KEY = Symbol.for("spicetify.upcomingSong");
  const STYLE_ID = "upcomingSongStyles";
  const COMPONENT_ID = "upcomingSongDiv";
  const PLAYER_BAR_SELECTOR = ".main-nowPlayingBar-left";
  const SPICETIFY_RETRY_INTERVAL_MS = 1000;
  const QUEUE_SETTLE_DELAY_MS = 100;

  if (window[INSTANCE_KEY]) {
    return;
  }

  window[INSTANCE_KEY] = true;

  let playerBar;
  let component;
  let lastTrackKey = null;
  let imageRequestId = 0;
  let renderTimeout;

  function waitForSpicetify() {
    const spicetify = window.Spicetify;

    if (!spicetify?.Player?.addEventListener || !spicetify.Player.next) {
      setTimeout(waitForSpicetify, SPICETIFY_RETRY_INTERVAL_MS);
      return;
    }

    initialize(spicetify);
  }

  function initialize(spicetify) {
    addStyles();
    component = createComponent();

    spicetify.Player.addEventListener("songchange", scheduleUpcomingSongRender);
    subscribeToQueueChanges();
    document.addEventListener("fullscreenchange", renderUpcomingSong);

    const observer = new MutationObserver(() => {
      if (!component.button.isConnected || component.button.parentElement !== playerBar) {
        ensureMounted();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    ensureMounted();
    scheduleUpcomingSongRender();
  }

  function subscribeToQueueChanges() {
    // Spicetify has no stable public queue-change event, so keep this private API usage isolated.
    const queueEvents = window.Spicetify.Platform?.PlayerAPI?._queue?._events;

    if (typeof queueEvents?.addListener !== "function") {
      setTimeout(subscribeToQueueChanges, SPICETIFY_RETRY_INTERVAL_MS);
      return;
    }

    queueEvents.addListener("queue_update", scheduleUpcomingSongRender);
  }

  function scheduleUpcomingSongRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderUpcomingSong, QUEUE_SETTLE_DELAY_MS);
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .main-nowPlayingBar-left.upcoming-song-visible {
        display: flex;
        align-items: center;
        min-width: 0;
      }

      .main-nowPlayingBar-left.upcoming-song-visible > .main-nowPlayingWidget-nowPlaying {
        flex: 0 1 auto;
        max-width: 65%;
        min-width: 0;
      }

      .upcoming-song {
        display: flex;
        flex: 1 1 0;
        align-items: center;
        gap: 8px;
        min-width: 0;
        margin-top: 25px;
        padding: 0 0 0 16px;
        overflow: hidden;
        border: 0;
        color: inherit;
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .upcoming-song[hidden] {
        display: none !important;
      }

      .upcoming-song:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      .upcoming-song__cover {
        position: relative;
        display: grid;
        flex: 0 0 40px;
        width: 40px;
        height: 40px;
        place-items: center;
        overflow: hidden;
        background: var(--background-elevated-base, rgba(255, 255, 255, 0.08));
      }

      .upcoming-song__cover img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .upcoming-song__cover img[hidden],
      .upcoming-song__fallback[hidden] {
        display: none;
      }

      .upcoming-song__fallback {
        display: grid;
        place-items: center;
        color: var(--text-subdued, currentColor);
      }

      .upcoming-song__fallback svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
      }

      .upcoming-song__info {
        flex: 1 1 auto;
        min-width: 0;
      }

      .upcoming-song__title,
      .upcoming-song__artist {
        display: block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .upcoming-song__title {
        font-size: 0.75rem;
        font-weight: 700;
      }

      .upcoming-song__artist {
        margin-top: 2px;
        color: var(--text-subdued, currentColor);
        font-size: 0.6875rem;
      }
    `;

    document.head.appendChild(style);
  }

  function createComponent() {
    const button = document.createElement("button");
    button.id = COMPONENT_ID;
    button.className = "upcoming-song";
    button.type = "button";
    button.hidden = true;

    const cover = document.createElement("span");
    cover.className = "upcoming-song__cover";
    cover.setAttribute("aria-hidden", "true");

    const image = document.createElement("img");
    image.alt = "";
    image.hidden = true;

    const fallback = document.createElement("span");
    fallback.className = "upcoming-song__fallback";
    fallback.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13h-2V5.4l-8 1.3V18a4 4 0 1 1-2-3.46V18a2 2 0 1 0 2 2V8.73l8-1.34V16a4 4 0 1 1-2-3.46V6.4l-8 1.33V18H9z"></path></svg>`;

    cover.append(image, fallback);

    const info = document.createElement("span");
    info.className = "upcoming-song__info";

    const title = document.createElement("span");
    title.className = "upcoming-song__title";

    const artist = document.createElement("span");
    artist.className = "upcoming-song__artist";

    info.append(title, artist);
    button.append(cover, info);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.Spicetify.Player.next();
    });

    return { button, title, artist, image, fallback };
  }

  function ensureMounted() {
    const currentPlayerBar = document.querySelector(PLAYER_BAR_SELECTOR);

    if (playerBar && playerBar !== currentPlayerBar) {
      playerBar.classList.remove("upcoming-song-visible");
    }

    playerBar = currentPlayerBar;

    if (!playerBar) {
      return;
    }

    if (component.button.parentElement !== playerBar) {
      playerBar.appendChild(component.button);
    }

    playerBar.classList.toggle("upcoming-song-visible", !component.button.hidden);
  }

  function getNextTrack() {
    const queue = window.Spicetify?.Queue;
    const nextTracks = queue?.nextTracks;

    if (!Array.isArray(nextTracks)) {
      return null;
    }

    const currentTrackUid = queue.track?.contextTrack?.uid;

    return (
      nextTracks.find((entry) => {
        const contextTrack = entry?.contextTrack;
        const metadata = contextTrack?.metadata;
        const isRemoved = entry?.removed?.length > 0 || entry?.removed === true;

        return !isRemoved && Boolean(contextTrack?.uid && metadata?.title) && contextTrack.uid !== currentTrackUid;
      }) ?? null
    );
  }

  function getArtists(metadata) {
    const artists = [];

    if (metadata.artist_name) {
      artists.push(metadata.artist_name);
    }

    for (let index = 1; metadata[`artist_name:${index}`]; index += 1) {
      artists.push(metadata[`artist_name:${index}`]);
    }

    if (artists.length === 0 && Array.isArray(metadata.artists)) {
      artists.push(...metadata.artists.map((artist) => artist.name).filter(Boolean));
    }

    return artists.join(", ");
  }

  function resolveImageUrl(imageValue) {
    if (typeof imageValue !== "string" || !imageValue.trim()) {
      return null;
    }

    const image = imageValue.trim();

    if (image.startsWith("spotify:image:")) {
      const imageId = image.slice("spotify:image:".length);
      return imageId ? `https://i.scdn.co/image/${encodeURIComponent(imageId)}` : null;
    }

    try {
      const url = new URL(image);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function renderUpcomingSong() {
    renderUpcomingTrack(getNextTrack());
  }

  function renderUpcomingTrack(track) {
    const visible = Boolean(track) && !document.fullscreenElement;

    component.button.hidden = !visible;
    playerBar?.classList.toggle("upcoming-song-visible", visible);

    if (!track) {
      lastTrackKey = null;
      imageRequestId += 1;
      return;
    }

    const contextTrack = track.contextTrack;
    const metadata = contextTrack.metadata;
    const titleText = metadata.title;
    const artistText = getArtists(metadata);
    const imageUrl = resolveImageUrl(metadata.image_url ?? metadata.image_uri);
    const trackKey = JSON.stringify([contextTrack.uid ?? contextTrack.uri, titleText, artistText, imageUrl]);

    if (trackKey === lastTrackKey) {
      return;
    }

    lastTrackKey = trackKey;
    component.title.textContent = titleText;
    component.artist.textContent = artistText;
    component.button.setAttribute("aria-label", `Play next: ${titleText}${artistText ? ` by ${artistText}` : ""}`);

    const image = document.createElement("img");
    image.alt = "";
    image.hidden = true;
    component.image.replaceWith(image);
    component.image = image;
    const requestId = ++imageRequestId;

    component.fallback.hidden = false;

    if (!imageUrl) {
      return;
    }

    image.onload = () => {
      if (requestId === imageRequestId && image.naturalWidth > 0) {
        image.hidden = false;
        component.fallback.hidden = true;
      }
    };

    image.src = imageUrl;
  }

  waitForSpicetify();
})();
