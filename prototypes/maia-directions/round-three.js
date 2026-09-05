function emblem({ interactive = false } = {}) {
  const interactiveAttribute = interactive ? ' data-logo-interactive' : ''
  return `<span class="m3-emblem m3-emblem-original"${interactiveAttribute} aria-hidden="true"><svg viewBox="0 0 32 32"><g class="m3-logo-fields" data-logo-fields><circle cx="16" cy="9.6" r="7"></circle><circle cx="22.4" cy="16" r="7"></circle><circle cx="16" cy="22.4" r="7"></circle><circle cx="9.6" cy="16" r="7"></circle></g><g data-logo-core><circle class="m3-logo-core" cx="16" cy="16" r="2.6"></circle></g></svg></span>`
}

function dustCloud() {
  return '<div class="m3-dust-cloud"><canvas class="m3-particle-sphere" data-particle-sphere aria-hidden="true"></canvas></div>'
}

const salonRoom = {
  eyebrow: 'Maia has the day in hand',
  title: 'Let’s make room<br />for what <em>matters.</em>',
  intro: 'I’ve kept your day nearby. Bring me the loose ends and I’ll help arrange the next gentle step.',
  artLabel: 'A quiet field of light',
  prompts: [
    ['Shape my day', 'Help me shape the rest of today without overfilling it'],
    ['Draft a note', 'Help me write a warm note to someone'],
    ['Think beside me', 'I need to think through something slowly'],
  ],
  placeholder: 'What can I take off your mind?',
}

const variants = {
  salon: {
    ...salonRoom,
    kind: 'salon',
    label: 'Salon',
    date: 'Thursday · September 4',
    time: '2:14',
    weather: '72°',
    condition: 'Golden, with a quieter evening',
  },
  atelier: {
    ...salonRoom,
    kind: 'atelier',
    label: 'Print Room',
    date: 'Thursday · September 4',
    time: '2:14',
    weather: '68°',
    condition: 'Clear now, rain after supper',
  },
  dayoffice: {
    ...salonRoom,
    kind: 'dayoffice',
    label: 'Day Office',
    date: 'Thursday · September 4',
    time: '2:14',
    weather: '70°',
    condition: 'Soft cloud, windows-open weather',
  },
}

const themeOptions = [
  { value: 'salon', label: 'Salon', tone: 'Elegant' },
  { value: 'atelier', label: 'Print Room', tone: 'Moody' },
  { value: 'dayoffice', label: 'Day Office', tone: 'Tailored' },
]

function appearanceSettings(v) {
  const settingsId = `m3-settings-${v.kind}`
  const titleId = `${settingsId}-title`

  return `
    <section class="m3-settings" id="${settingsId}" popover="auto" role="dialog" aria-modal="false" aria-labelledby="${titleId}">
      <header>
        <h2 id="${titleId}">Appearance</h2>
        <button type="button" data-action="close-settings" popovertarget="${settingsId}" popovertargetaction="hide">Done</button>
      </header>

      <fieldset>
        <legend>Theme</legend>
        <div class="m3-theme-options">
          ${themeOptions.map((theme) => `
            <label class="m3-theme-option" data-theme="${theme.value}">
              <input class="m3-visually-hidden" type="radio" name="maia-theme" value="${theme.value}" data-theme-choice${theme.value === v.kind ? ' checked' : ''} />
              <span class="m3-theme-swatch" aria-hidden="true"></span>
              <span><strong>${theme.label}</strong><small>${theme.tone}</small></span>
            </label>`).join('')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Mode</legend>
        <div class="m3-mode-options">
          <label><input class="m3-visually-hidden" type="radio" name="maia-mode" value="dark" data-mode-choice checked /><span>Dark</span></label>
          <label><input class="m3-visually-hidden" type="radio" name="maia-mode" value="light" data-mode-choice /><span>Light</span></label>
        </div>
      </fieldset>
    </section>`
}

function taskRail(v) {
  const settingsId = `m3-settings-${v.kind}`
  return `
    <aside class="m3-day">
      <div class="m3-brand-shell">
        <button type="button" class="m3-brand" data-action="settings" popovertarget="${settingsId}" aria-haspopup="dialog" aria-expanded="false" aria-label="Open Maia appearance settings" title="Appearance settings">${emblem({ interactive: true })}</button>
        <strong class="m3-wordmark">Maia</strong>
        ${appearanceSettings(v)}
      </div>
      <div class="m3-clock"><strong>${v.time}</strong><span>${v.date}</span></div>

      <section class="m3-agenda">
        <header><h2>Today</h2><small>In Maia’s care</small></header>
        <ol>
          <li><time>10:30</time><span>Review the week ahead</span><i></i></li>
          <li><time>2:00</time><span>Call with Maren</span><i></i></li>
          <li><time>Evening</time><span>Groceries and dinner</span><i></i></li>
        </ol>
        <button data-action="prompt" data-prompt="Help me make room in today’s schedule">Make a little room <b>↗</b></button>
      </section>

      <section class="m3-weather">
        <header><h2>Outside</h2><small>Denver</small></header>
        <div><strong>${v.weather}</strong><span>${v.condition}</span></div>
        <i aria-hidden="true"></i>
      </section>

      <nav aria-label="Primary">
        <button data-action="conversation"><span>✦</span> Conversation</button>
        <button data-action="history"><span>◴</span> History</button>
        <button data-action="investigate"><span>◎</span> How Maia worked</button>
      </nav>
    </aside>`
}

function floatingChat(v) {
  return `
    <form class="m3-chat proto-composer" aria-label="Conversation with Maia">
      <div class="m3-chat-head" data-drag-handle>
        <span>${emblem()}<b>Maia</b><small>Your friendly secretary</small></span>
        <span class="m3-drag-label" aria-label="Drag this conversation">Move&nbsp; ⠿</span>
      </div>
      <div class="m3-chat-entry">
        <textarea rows="1" aria-label="Message Maia" placeholder="${v.placeholder}" data-landing-placeholder="${v.placeholder}"></textarea>
        <button type="submit" data-action="send" aria-label="Send to Maia">↗</button>
      </div>
      <footer><span>Private · stays here</span><span>Ready when you are</span></footer>
      <span class="m3-resize-handle m3-resize-n" data-resize-edge="n" aria-hidden="true"></span>
      <span class="m3-resize-handle m3-resize-e" data-resize-edge="e" aria-hidden="true"></span>
      <span class="m3-resize-handle m3-resize-s" data-resize-edge="s" aria-hidden="true"></span>
      <span class="m3-resize-handle m3-resize-w" data-resize-edge="w" aria-hidden="true"></span>
      <span class="m3-resize-handle m3-resize-ne" data-resize-edge="ne" aria-hidden="true"></span>
      <button type="button" class="m3-resize-handle m3-resize-se" data-resize-edge="se" aria-label="Resize message box"></button>
      <span class="m3-resize-handle m3-resize-sw" data-resize-edge="sw" aria-hidden="true"></span>
      <span class="m3-resize-handle m3-resize-nw" data-resize-edge="nw" aria-hidden="true"></span>
    </form>`
}

function render(kind) {
  const v = variants[kind]
  return `
    <section class="concept concept-narrow concept-${kind}" aria-label="${v.label} design direction">
      ${taskRail(v)}

      <main class="m3-main">
        <header>
          <span><span class="m3-room-label">Maia’s room</span><span class="m3-thread-label">With Maia</span></span>
          <div><button class="m3-new-thread" data-action="new">New conversation</button></div>
        </header>
        <section class="m3-room landing-state" aria-label="Maia’s room" aria-hidden="false">
          <div class="m3-copy">
            <p>${v.eyebrow}</p>
            <h1>${v.title}</h1>
            <div class="m3-intro"><span></span><p>${v.intro}</p></div>
          </div>
          <div class="m3-art" aria-hidden="true">
            <span class="m3-art-caption">${v.artLabel}</span>
            ${dustCloud()}
          </div>
          <div class="m3-prompts">
            ${v.prompts.map(([label, prompt], index) => `<button data-action="prompt" data-prompt="${prompt}"><i>0${index + 1}</i><span>${label}</span><b>↗</b></button>`).join('')}
          </div>
        </section>
        <section class="m3-conversation thread-state" aria-label="Conversation with Maia" aria-hidden="true" inert>
          <div class="m3-thread-shell">
            <header><span>Today</span></header>
            <ol class="m3-thread-list" data-thread-list></ol>
          </div>
        </section>
      </main>

      <p class="m3-live-announcer" data-live-announcer aria-live="polite" aria-atomic="true"></p>
      ${floatingChat(v)}

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>Things we’ve held onto</span><button data-action="close-panel">Close</button></header>
        <button data-action="prompt" data-prompt="Continue planning the week">The week ahead <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the note for Maren">A note for Maren <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner at home <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="How Maia worked">
        <header><span>How Maia helped</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">After a reply, Maia can quietly show what stayed local and what she considered.</p>
        <div class="trace-ready"><b>Kept on this device</b><span data-trace-turns>1 conversation turn</span><span>No outside tools used</span><span>Answered in 1.8 seconds</span></div>
      </aside>
    </section>`
}

export const salon = () => render('salon')
export const atelier = () => render('atelier')
export const dayOffice = () => render('dayoffice')
