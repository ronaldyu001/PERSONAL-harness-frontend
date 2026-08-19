import type { JSX } from 'react'

/* Dormant readouts: an instrument with no signal on that input.

   The readout structure is drawn precisely and the reading sits at rest.
   Nothing here is invented data, because there is no data - which is exactly
   why nothing needs disclaiming. */

function RestRow({ width }: { width: string }) {
  return <span className="rest-row" style={{ width }} aria-hidden="true" />
}

export function TasksPanelBody(): JSX.Element {
  return (
    <div className="readout">
      <div className="readout__rows">
        <RestRow width="62%" />
        <RestRow width="78%" />
        <RestRow width="45%" />
      </div>
    </div>
  )
}

export function WeatherPanelBody(): JSX.Element {
  return (
    <div className="readout">
      <div className="readout__dial">
        <span className="readout__value">&#8212;</span>
        <span className="readout__unit" aria-hidden="true">
          &#176;
        </span>
      </div>
      <div className="readout__rows readout__rows--tight">
        <RestRow width="54%" />
      </div>
    </div>
  )
}
