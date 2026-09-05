const mark = `
  <span class="proto-mark" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><b></b>
  </span>`

export function fieldNotes() {
  return `
    <section class="concept concept-field-notes" aria-label="Field Notes design direction">
      <nav class="f-tabs" aria-label="Maia">
        <button class="brand-button" data-action="home">${mark}<span>Maia</span></button>
        <button data-action="conversation" data-nav-active><b>Chat</b><span>New thought</span></button>
        <button data-action="history"><b>Pages</b><span>3 recent</span></button>
        <button data-action="investigate"><b>Trace</b><span>Local activity</span></button>
        <button data-action="settings"><b>View</b><span>Change paper</span></button>
      </nav>

      <div class="f-board">
        <header class="f-board-head">
          <div><span>Field notebook no. 04</span><strong>Private workspace</strong></div>
          <span>Local model online</span>
        </header>

        <div class="f-layout landing-state">
          <section class="f-main-note">
            <span class="f-tape" aria-hidden="true"></span>
            <span class="f-date">SEP<br /><b>04</b></span>
            <p class="f-overline">For thoughts still taking shape</p>
            <h1>A place for<br /><em>unfinished</em> ideas.</h1>
            <p>Collect a thought, pull it apart, and put it back together. Maia keeps the work here.</p>
            <div class="f-prompt-grid">
              <button data-action="prompt" data-prompt="Plan a focused deep-work morning"><span>Plan</span>Shape a quiet morning</button>
              <button data-action="prompt" data-prompt="Explain vector databases, simply"><span>Learn</span>Unpack a hard concept</button>
              <button data-action="prompt" data-prompt="Draft a warm interview follow-up"><span>Write</span>Find the right words</button>
              <button data-action="prompt" data-prompt="What can I cook with miso and rice?"><span>Make</span>Use what is already here</button>
            </div>
          </section>

          <aside class="f-margin-notes">
            <section class="f-note f-note-task">
              <span class="f-pin" aria-hidden="true"></span>
              <header><b>Things to do</b><span>Not connected</span></header>
              <label><i></i><span>Tasks will live here</span></label>
              <label><i></i><span>when a source is added</span></label>
            </section>
            <section class="f-note f-note-weather">
              <header><b>Outside</b><span>No location</span></header>
              <div class="f-sun" aria-hidden="true"></div>
              <p>Maia does not make outside calls.</p>
            </section>
            <section class="f-note f-note-recent">
              <header><b>Last page</b><span>Yesterday</span></header>
              <button data-action="prompt" data-prompt="Continue the autumn reading list">Autumn reading list →</button>
            </section>
          </aside>
        </div>

        <section class="proto-thread thread-state f-thread" aria-label="Conversation">
          <span class="f-tape" aria-hidden="true"></span>
          <header><span>Working page</span><button data-action="new">Turn the page</button></header>
          <div class="thread-copy">
            <p class="thread-user"></p>
            <div><span>Maia wrote</span><p class="thread-assistant"></p></div>
          </div>
        </section>

        <form class="f-composer proto-composer">
          <span aria-hidden="true">✣</span>
          <textarea rows="1" aria-label="Message Maia" placeholder="Add a thought to the page…"></textarea>
          <button type="submit" data-action="send">Place on page</button>
          <small>Qwen 3 14B · local</small>
        </form>
      </div>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>Pages</span><button data-action="close-panel">Done</button></header>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the autumn reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Trace notes</span><button data-action="close-panel">Done</button></header>
        <p class="trace-empty">The trace margin is empty until Maia answers.</p>
        <div class="trace-ready"><b>Answer note</b><span>1.8 seconds</span><span>Qwen 3 14B</span><span>Stayed local</span></div>
      </aside>
    </section>`
}
