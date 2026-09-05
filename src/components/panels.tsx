import type { JSX } from 'react'

/* Dormant readouts: an instrument with no signal on that input.

   The structure is drawn precisely and the reading is simply absent. Varied
   row widths were a skeleton-loader idiom, which reads as "still fetching"
   rather than "nothing connected"; a ruled ledger and a graduated scale read
   as at rest. Nothing here is invented data, because there is no data. */

export function TasksPanelBody(): JSX.Element {
  return (
    <div className="readout readout--tasks">
      <div className="readout__task-list" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <span className="readout__task" key={item}>
            <i />
            <b />
          </span>
        ))}
      </div>
    </div>
  )
}

const TICKS = 13

export function WeatherPanelBody(): JSX.Element {
  return (
    <div className="readout readout--weather">
      <div className="readout__weather-orbit" aria-hidden="true">
        <span className="readout__weather-sun" />
        <span className="readout__weather-ring" />
        <span className="readout__weather-horizon" />
      </div>
      <div className="readout__scale" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className={`readout__tick${i % 4 === 0 ? ' readout__tick--major' : ''}`} />
        ))}
      </div>
    </div>
  )
}
