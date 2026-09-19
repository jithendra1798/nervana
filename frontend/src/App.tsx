import { NavLink, Route, Routes } from "react-router-dom";
import { Icon } from "./components/Icon";
import { ErrorBox } from "./components/States";
import { api, USE_MOCKS } from "./lib/api";
import { useAsOf } from "./lib/asOf";
import { fmtHour } from "./lib/format";
import { useApi } from "./lib/hooks";
import { resetMockState } from "./lib/mock";
import { useTheme } from "./lib/theme";
import { HelpRequests } from "./pages/HelpRequests";
import { Inbox } from "./pages/Inbox";
import { Integration } from "./pages/Integration";
import { MapView } from "./pages/MapView";
import { PatientApp, PatientPicker } from "./pages/PatientApp";
import { PatientDetail } from "./pages/PatientDetail";

function TopBar() {
  const { hours, asOf, setAsOf } = useAsOf();
  const { resolved, cycle } = useTheme();
  const open = useApi(() => api.escalations("open"), [], 4000);
  const openCount = open.data?.escalations.length ?? 0;

  return (
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="brand-mark">N</span>Nervana</NavLink>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>Inbox</NavLink>
        <NavLink to="/map">Map</NavLink>
        <NavLink to="/help-requests">
          Help requests{openCount > 0 && <span className="count-pill" aria-label={`${openCount} open`}>{openCount}</span>}
        </NavLink>
        <NavLink to="/me">Client view</NavLink>
        <NavLink to="/integration">Inside the EHR</NavLink>
      </nav>
      <div className="topbar-right">
        {hours.length > 0 && asOf && (
          <label className="field">
            <Icon name="clock" size={14} />
            <span className="sr-only">Replay time</span>
            <select value={hours.find((h) => new Date(h).getTime() === new Date(asOf).getTime()) ?? asOf} onChange={(e) => setAsOf(e.target.value)}>
              {hours.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </label>
        )}
        {USE_MOCKS && (
          <>
            <span className="sample-tag" title="Reading contracts/fixtures instead of the API">Sample data</span>
            <button className="btn ghost" title="Clear demo actions, help requests and replies" onClick={() => { resetMockState(); location.reload(); }}>
              <Icon name="reset" /> Reset
            </button>
          </>
        )}
        <button className="btn ghost" onClick={cycle} aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}>
          <Icon name={resolved === "dark" ? "sun" : "moon"} />
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const { error } = useAsOf();
  return (
    <>
      <TopBar />
      {error ? (
        <div className="page"><ErrorBox error={error} /></div>
      ) : (
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/help-requests" element={<HelpRequests />} />
          <Route path="/me" element={<PatientPicker />} />
          <Route path="/me/:id" element={<PatientApp />} />
          <Route path="/integration" element={<Integration />} />
        </Routes>
      )}
    </>
  );
}
