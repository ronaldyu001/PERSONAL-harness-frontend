const mark = `
  <span class="proto-mark" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><b></b>
  </span>`

export function letterpress() {
  return `
    <section class="concept concept-letterpress" aria-label="Letterpress design direction">
      <nav class="lp-rail" aria-label="Maia">
        <button class="brand-button" data-action="home" aria-label="Home">Maia</button>
        <div class="lp-rail-actions">
          <button data-action="conversation" data-nav-active aria-label="Conversation">C</button>
          <button data-action="history" aria-label="History">H</button>
          <button data-action="investigate" aria-label="Investigate">I</button>
        </div>
        <button data-action="settings" aria-label="Change palette">◐</button>
      </nav>

      <div class="lp-page">
        <header class="lp-masthead">
          <span>Private intelligence for one</span>
          <span>Thursday / Denver</span>
          <span>Local model · Ready</span>
        </header>

        <div class="lp-layout landing-state">
          <section class="lp-editorial">
            <span class="lp-kicker">A blank page with a memory</span>
            <h1>What are you<br /><em>thinking</em> about?</h1>
            <p class="lp-deck">Maia is a private place to reason, write, and wander—without the conversation leaving this machine.</p>
            <div class="lp-prompts" aria-label="Starting prompts">
              <button data-action="prompt" data-prompt="Plan a focused deep-work morning">
                <span>01</span><strong>Plan a focused deep-work morning</strong><i>Planning</i>
              </button>
              <button data-action="prompt" data-prompt="Explain vector databases, simply">
                <span>02</span><strong>Explain vector databases, simply</strong><i>Learning</i>
              </button>
              <button data-action="prompt" data-prompt="Draft a warm interview follow-up">
                <span>03</span><strong>Draft a warm interview follow-up</strong><i>Writing</i>
              </button>
            </div>
          </section>

          <aside class="lp-margin">
            <div class="lp-mark-study">${mark}<span>Maia / 01</span></div>
            <section>
              <header><span>Pending tasks</span><b>Dormant</b></header>
              <p>The task store has not been connected.</p>
            </section>
            <section>
              <header><span>Weather</span><b>Private</b></header>
              <p>No location source. Nothing leaves Maia.</p>
            </section>
          </aside>
        </div>

        <section class="proto-thread thread-state" aria-label="Conversation">
          <header><span>Conversation / now</span><button data-action="new">New page</button></header>
          <div class="thread-copy">
            <p class="thread-user"></p>
            <div><span>Maia</span><p class="thread-assistant"></p></div>
          </div>
        </section>

        <form class="lp-composer proto-composer">
          <label for="lp-message">Begin anywhere</label>
          <textarea id="lp-message" rows="1" placeholder="Write a thought…"></textarea>
          <button type="submit" data-action="send" aria-label="Send message">Send ↗</button>
          <span>Qwen 3 14B · local</span>
        </form>
      </div>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>Earlier pages</span><button data-action="close-panel">Close</button></header>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Local trace</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">Send a thought and Maia will show how the local turn was made.</p>
        <div class="trace-ready"><b>1.8 s</b><span>Qwen 3 14B</span><span>Local only</span><span>1 turn</span></div>
      </aside>
    </section>`
}
