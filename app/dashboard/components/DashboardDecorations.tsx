export default function DashboardDecorations() {
  return (
    <div className="mm-dashboard-decorations" aria-hidden="true">
      <svg className="mm-dashboard-route" viewBox="0 0 150 560" fill="none">
        <path className="mm-dashboard-route__line" d="M77 0V92C77 126 41 135 41 171C41 209 108 208 108 250C108 288 52 291 52 335C52 375 91 382 91 423V560" />
        <circle cx="77" cy="74" r="4" />
        <circle cx="41" cy="171" r="4" />
        <circle cx="108" cy="250" r="4" />
        <circle cx="91" cy="423" r="4" />
        <text x="91" y="61">CAMPUS</text>
        <text x="53" y="160">ROOM</text>
        <text x="78" y="242">MEMORY</text>
      </svg>
      <div className="mm-dashboard-fragments">
        <span className="mm-dashboard-fragment mm-dashboard-fragment--room" />
        <span className="mm-dashboard-fragment mm-dashboard-fragment--date">16 JUL</span>
        <span className="mm-dashboard-fragment mm-dashboard-fragment--note"><i /><i /><i /></span>
      </div>
    </div>
  );
}
