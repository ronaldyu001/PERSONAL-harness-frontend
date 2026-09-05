const mark = `<span class="proto-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span>`

export function readingRoom() {
  return `
    <section class="concept concept-reading-room" aria-label="Reading Room design direction">
      <nav class="r-nav" aria-label="Primary">
        <button class="brand-button" data-action="home">${mark}<strong>Maia</strong></button>
        <button data-action="conversation" data-nav-active><span>✦</span><b>Conversation</b></button>
        <button data-action="history"><span>◴</span><b>History</b></button>
        <button data-action="investigate"><span>◎</span><b>Investigate</b></button>
        <button data-action="settings"><span>◐</span><b>Appearance</b></button>
      </nav>

      <div class="r-page">
        <header class="r-masthead">
          <span>Maia’s room</span>
          <span>Private by design · Local by default</span>
        </header>

        <div class="r-spread landing-state">
          <section class="r-opening">
            <p>Thursday afternoon</p>
            <h1>Make yourself<br />at <em>home.</em></h1>
            <blockquote>“A place to think is also a place to leave things unfinished.”</blockquote>
            <div class="r-prompts">
              <button data-action="prompt" data-prompt="Help me plan the rest of my week"><i>01</i><span>Plan the week without overfilling it</span></button>
              <button data-action="prompt" data-prompt="Help me make sense of a difficult decision"><i>02</i><span>Think through a decision slowly</span></button>
              <button data-action="prompt" data-prompt="Draft a warm interview follow-up"><i>03</i><span>Write something warm and clear</span></button>
            </div>
          </section>

          <aside class="r-daybook">
            <header><span>The daybook</span><b>04 / 09</b></header>
            <section>
              <div><h2>Tasks</h2><small>Awaiting a source</small></div>
              <div class="r-task-space" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
              <p>Enough room for priorities, timing, and what can wait.</p>
            </section>
            <section>
              <div><h2>Weather</h2><small>No location source</small></div>
              <div class="r-sky" aria-hidden="true"><i></i><span></span><b></b></div>
              <p>Designed for the rhythm of a day, when connected.</p>
            </section>
          </aside>
        </div>

        <section class="proto-thread thread-state r-thread" aria-label="Conversation">
          <header><span>Current page</span><button data-action="new">Close the page</button></header>
          <div class="thread-copy"><p class="thread-user"></p><div><span>Maia</span><p class="thread-assistant"></p></div></div>
        </section>

        <form class="r-composer proto-composer">
          <span aria-hidden="true">01</span>
          <textarea rows="1" aria-label="Message Maia" placeholder="Write what you’re thinking…"></textarea>
          <button type="submit" data-action="send">Ask Maia ↗</button>
          <small>Private conversation · Qwen 3 14B</small>
        </form>
      </div>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>Previous pages</span><button data-action="close-panel">Close</button></header>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the autumn reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Page notes</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">The margin will show how Maia composed the next answer.</p>
        <div class="trace-ready"><b>1.8 seconds</b><span>Qwen 3 14B</span><span>Stayed local</span><span>1 turn</span></div>
      </aside>
    </section>`
}
