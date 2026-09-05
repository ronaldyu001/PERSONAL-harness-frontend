const mark = `<span class="proto-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span>`

export function hearth() {
  return `
    <section class="concept concept-hearth" aria-label="Hearth design direction">
      <header class="h-header">
        <button class="brand-button" data-action="home">Maia</button>
        <nav aria-label="Primary">
          <button data-action="conversation" data-nav-active><span>✦</span> Conversation</button>
          <button data-action="history"><span>◴</span> History</button>
          <button data-action="investigate"><span>◎</span> Investigate</button>
        </nav>
        <button data-action="settings">Evening / morning</button>
      </header>

      <div class="h-page landing-state">
        <main class="h-thought">
          <div class="h-glow" aria-hidden="true">${mark}</div>
          <p class="h-eyebrow">Your private place to work things through</p>
          <h1>What would feel<br /><em>lighter</em> by tonight?</h1>
          <p class="h-intro">Bring Maia a plan, a question, or a half-formed thought. It stays here, with you.</p>
          <div class="h-starters">
            <span>Begin with</span>
            <button data-action="prompt" data-prompt="Help me plan the rest of my week">the week ahead</button>
            <button data-action="prompt" data-prompt="Help me make sense of a difficult decision">a decision</button>
            <button data-action="prompt" data-prompt="Draft a warm interview follow-up">something to say</button>
            <button data-action="prompt" data-prompt="What can I cook with miso and rice?">what’s for dinner</button>
          </div>
        </main>

        <aside class="h-today" aria-label="Today">
          <header><span>Today</span><b>Thursday, Sep 04</b></header>
          <section class="h-tasks">
            <div><span>Tasks</span><small>Source not connected</small></div>
            <ol aria-hidden="true">
              <li><i></i><span></span><time>morning</time></li>
              <li><i></i><span></span><time>afternoon</time></li>
              <li><i></i><span></span><time>evening</time></li>
            </ol>
            <p>A task source would have room for your whole day—not a footer summary.</p>
          </section>
          <section class="h-weather">
            <div><span>Weather</span><small>No location shared</small></div>
            <div class="h-weather-art" aria-hidden="true"><i></i><span></span></div>
            <p>Local by default. Add a location only when you want this view.</p>
          </section>
        </aside>
      </div>

      <section class="proto-thread thread-state h-thread" aria-label="Conversation">
        <header><span>Conversation / private</span><button data-action="new">New thought</button></header>
        <div class="thread-copy"><p class="thread-user"></p><div><span>Maia</span><p class="thread-assistant"></p></div></div>
      </section>

      <form class="h-composer proto-composer">
        <label for="h-message">Tell Maia what’s on your mind</label>
        <textarea id="h-message" rows="1" placeholder="Begin anywhere…"></textarea>
        <span>Qwen 3 14B · on this machine</span>
        <button type="submit" data-action="send">Send <b>↗</b></button>
      </form>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>History</span><button data-action="close-panel">Close</button></header>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the autumn reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Investigate</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">Send a thought to see how Maia handled it locally.</p>
        <div class="trace-ready"><b>1.8 seconds</b><span>Qwen 3 14B</span><span>Local route</span><span>1 turn</span></div>
      </aside>
    </section>`
}
