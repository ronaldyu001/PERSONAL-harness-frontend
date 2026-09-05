const mark = `<span class="proto-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span>`

export function studio() {
  return `
    <section class="concept concept-studio" aria-label="Studio design direction">
      <header class="s-header">
        <button class="brand-button" data-action="home">Maia</button>
        <nav aria-label="Primary">
          <button data-action="conversation" data-nav-active><span>✦</span> Talk</button>
          <button data-action="history"><span>◴</span> Pages</button>
          <button data-action="investigate"><span>◎</span> Trace</button>
        </nav>
        <button data-action="settings">Change light</button>
      </header>

      <div class="s-workspace landing-state">
        <aside class="s-day">
          <p>Today / Sep 04</p>
          <section class="s-task-board">
            <header><h2>Tasks</h2><small>Not connected</small></header>
            <div aria-hidden="true"><i></i><span>Morning</span><b></b></div>
            <div aria-hidden="true"><i></i><span>Afternoon</span><b></b></div>
            <div aria-hidden="true"><i></i><span>Evening</span><b></b></div>
            <p>This space grows into a real daily plan when a source is added.</p>
          </section>
          <section class="s-weather-board">
            <header><h2>Weather</h2><small>No location</small></header>
            <div class="s-weather-orbit" aria-hidden="true"><i></i><span></span></div>
            <p>Outside context, only when invited.</p>
          </section>
        </aside>

        <main class="s-canvas">
          <span class="s-canvas-label">Open canvas / private</span>
          <div class="s-mark-wrap" aria-hidden="true">${mark}</div>
          <h1>Bring the<br /><em>unfinished</em> part.</h1>
          <p>Maia can help you shape the rest.</p>
          <div class="s-prompts">
            <button data-action="prompt" data-prompt="Help me turn these scattered notes into a plan">Shape scattered notes</button>
            <button data-action="prompt" data-prompt="Help me plan the rest of my week">Plan without pressure</button>
            <button data-action="prompt" data-prompt="Draft a warm interview follow-up">Find the right tone</button>
            <button data-action="prompt" data-prompt="What can I cook with miso and rice?">Make dinner from what’s here</button>
          </div>
        </main>
      </div>

      <section class="proto-thread thread-state s-thread" aria-label="Conversation">
        <header><span>Open canvas</span><button data-action="new">Fresh canvas</button></header>
        <div class="thread-copy"><p class="thread-user"></p><div><span>Maia</span><p class="thread-assistant"></p></div></div>
      </section>

      <form class="s-composer proto-composer">
        <span aria-hidden="true">✦</span>
        <textarea rows="1" aria-label="Message Maia" placeholder="What’s taking shape?"></textarea>
        <small>Qwen 3 14B · local</small>
        <button type="submit" data-action="send">Continue ↗</button>
      </form>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>Pages</span><button data-action="close-panel">Close</button></header>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>Today</small></button>
        <button data-action="prompt" data-prompt="Continue the autumn reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Trace</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">No trace yet. Send a thought to see the local path.</p>
        <div class="trace-ready"><b>1.8 seconds</b><span>Qwen 3 14B</span><span>Local only</span><span>1 turn</span></div>
      </aside>
    </section>`
}
