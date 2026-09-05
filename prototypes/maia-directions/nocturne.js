const mark = `
  <span class="proto-mark" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><b></b>
  </span>`

export function nocturne() {
  return `
    <section class="concept concept-nocturne" aria-label="Nocturne design direction">
      <header class="n-header">
        <button class="brand-button" data-action="home">Maia</button>
        <nav aria-label="Primary">
          <button data-action="conversation" data-nav-active>Conversation</button>
          <button data-action="history">Archive</button>
          <button data-action="investigate">Trace</button>
        </nav>
        <button data-action="settings" aria-label="Change palette">Light / dark</button>
      </header>

      <div class="n-scene landing-state">
        <span class="n-caption n-caption-one">A private intelligence</span>
        <span class="n-caption n-caption-two">Running locally / 01</span>
        <div class="n-orbit" aria-hidden="true">
          <span></span><span></span><span></span>
          ${mark}
        </div>
        <div class="n-title">
          <span>The room is ready.</span>
          <h1>Ask what<br />you <em>really</em><br />want to know.</h1>
        </div>
        <div class="n-prompts" aria-label="Starting prompts">
          <button data-action="prompt" data-prompt="Help me make sense of a difficult decision">A difficult decision</button>
          <button data-action="prompt" data-prompt="Turn these scattered notes into a clear plan">Scattered notes → plan</button>
          <button data-action="prompt" data-prompt="Teach me something surprising about memory">Something surprising</button>
          <button data-action="prompt" data-prompt="Draft a warm interview follow-up">A message worth sending</button>
        </div>
      </div>

      <section class="proto-thread thread-state n-thread" aria-label="Conversation">
        <header><span>Now speaking privately</span><button data-action="new">Clear the room</button></header>
        <div class="thread-copy">
          <p class="thread-user"></p>
          <div><span>Maia / local</span><p class="thread-assistant"></p></div>
        </div>
      </section>

      <form class="n-composer proto-composer">
        <span class="n-listening" aria-hidden="true"></span>
        <textarea rows="1" aria-label="Message Maia" placeholder="Ask Maia anything"></textarea>
        <button type="submit" data-action="send" aria-label="Send message">↗</button>
        <div><span>Qwen 3 14B</span><span>Nothing leaves this room</span></div>
      </form>

      <footer class="n-footer">
        <span>01 / Tasks — awaiting a source</span>
        <span>02 / Weather — no location shared</span>
        <span>System ready</span>
      </footer>

      <aside class="proto-drawer proto-history" aria-label="Conversation history">
        <header><span>The archive</span><button data-action="close-panel">Close</button></header>
        <p>Fragments from this machine</p>
        <button data-action="prompt" data-prompt="Continue the launch notes">Launch notes <small>00:42</small></button>
        <button data-action="prompt" data-prompt="Continue the reading list">Autumn reading list <small>Yesterday</small></button>
        <button data-action="prompt" data-prompt="Continue the dinner plan">Dinner for six <small>Monday</small></button>
      </aside>
      <aside class="proto-drawer proto-inspector" aria-label="Local trace">
        <header><span>Behind the answer</span><button data-action="close-panel">Close</button></header>
        <p class="trace-empty">No signal yet. Send a thought to watch the local trace appear.</p>
        <div class="trace-ready"><b>1.8 s</b><span>Model / Qwen 3 14B</span><span>Route / local</span><span>Turns / 1</span></div>
      </aside>
    </section>`
}
