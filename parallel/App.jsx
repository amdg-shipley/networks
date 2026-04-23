const { useState, useMemo, useCallback, useRef } = React;

// ── Constants ──────────────────────────────────────────────────────────────

const PROCESS_COLORS = ['#00ff9d', '#00b4ff', '#ffb347', '#ff4d6d', '#ffe066', '#c084fc'];
const PROCESS_LABELS = ['W', 'X', 'Y', 'Z', 'A', 'B'];

const DEFAULT_PROCESSES = [
  { id: 'W', label: 'W', time: 20, color: PROCESS_COLORS[0] },
  { id: 'X', label: 'X', time: 30, color: PROCESS_COLORS[1] },
  { id: 'Y', label: 'Y', time: 45, color: PROCESS_COLORS[2] },
  { id: 'Z', label: 'Z', time: 50, color: PROCESS_COLORS[3] },
];

const AP_OPTIONS = [
  { key: 'A', text: 'W + X on P1 (50s), Y + Z on P2 (95s)', p1: ['W','X'], p2: ['Y','Z'] },
  { key: 'B', text: 'W + Z on P1 (70s), X + Y on P2 (75s)', p1: ['W','Z'], p2: ['X','Y'] },
  { key: 'C', text: 'W + Y on P1 (65s), X + Z on P2 (80s)', p1: ['W','Y'], p2: ['X','Z'] },
  { key: 'D', text: 'W + X + Y on P1 (95s), Z on P2 (50s)', p1: ['W','X','Y'], p2: ['Z'] },
];
const CORRECT_ANSWER = 'B';

// ── Helpers ────────────────────────────────────────────────────────────────

function greedyParallelTime(processes, nProc) {
  const sorted = [...processes].sort((a, b) => b.time - a.time);
  const bins = Array.from({ length: nProc }, () => 0);
  for (const p of sorted) {
    const minIdx = bins.indexOf(Math.min(...bins));
    bins[minIdx] += p.time;
  }
  return Math.max(...bins);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FormulaBox() {
  return (
    <div className="formula-box">
      <div className="card-title">AP PSEUDOCODE — CSN-2 FORMULAS</div>
      <div className="formula-lines">
        <div className="formula-line"><span>Sequential Time</span> = sum of ALL process times</div>
        <div className="formula-line"><span>Parallel Time&nbsp;&nbsp;</span> = longest processor total</div>
        <div className="formula-line"><span>Speedup&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> = Sequential ÷ Parallel</div>
      </div>
    </div>
  );
}

function ProcessPill({ proc, onDragStart, onDragEnd, isDragging, onClick }) {
  return (
    <div
      className={`process-pill${isDragging ? ' dragging' : ''}`}
      style={{ borderLeftColor: proc.color }}
      draggable
      onDragStart={e => onDragStart(e, proc.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick && onClick(proc.id)}
      title="Drag to assign, or click"
    >
      <span className="pill-label" style={{ color: proc.color }}>{proc.label}</span>
      <span className="pill-time">{proc.time}s</span>
    </div>
  );
}

function ProcessorLane({ name, procIds, processes, total, onDrop, onDragOver, onDragLeave, isDragOver, onPillClick }) {
  const byId = id => processes.find(p => p.id === id);
  return (
    <div
      className={`processor-lane${isDragOver ? ' drag-over' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="processor-lane-header">
        <span className="processor-lane-name">{name}</span>
        <span className="processor-lane-total" style={{ color: total > 0 ? '#e8eaf6' : '#3a3f5c' }}>
          {total > 0 ? `${total}s` : '—'}
        </span>
      </div>
      <div className="processor-lane-pills">
        {procIds.map(id => {
          const p = byId(id);
          return p ? (
            <ProcessPill
              key={id}
              proc={p}
              onDragStart={(e, pid) => {
                e.dataTransfer.setData('processId', pid);
                e.dataTransfer.setData('fromLane', name);
              }}
              onDragEnd={() => {}}
              isDragging={false}
              onClick={onPillClick}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

function SimulationPanel({ seqTime, p1Time, p2Time, parallelTime, speedup, canRun, onRun, animating }) {
  const parallelReady = parallelTime !== null;
  return (
    <div className="card">
      <div className="card-title">SIMULATION RESULTS</div>
      <div className="sim-stats">
        <div className="stat-box">
          <div className="stat-label">Sequential</div>
          <div className="stat-value blue">{seqTime}</div>
          <div className="stat-unit">seconds</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Parallel</div>
          <div className={`stat-value ${parallelReady ? 'green' : 'muted'}`}>
            {parallelReady ? parallelTime : '—'}
          </div>
          <div className="stat-unit">seconds</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Speedup</div>
          <div className={`stat-value ${parallelReady ? 'amber' : 'muted'}`}>
            {parallelReady ? speedup : '—'}
          </div>
          <div className="stat-unit">× faster</div>
        </div>
      </div>
      <button
        className="btn-run"
        disabled={!canRun || animating}
        onClick={onRun}
      >
        {animating ? 'RUNNING…' : 'RUN SIMULATION'}
      </button>
    </div>
  );
}

function GanttRow({ label, segments, totalTime, globalMax, animKey, startDelayMs }) {
  if (!segments.length) return null;
  let cumDelay = startDelayMs;
  return (
    <div className="gantt-row">
      <div className="gantt-row-label">{label}</div>
      <div className="gantt-track">
        {segments.map((seg, i) => {
          const widthPct = (seg.time / globalMax) * 100;
          const durMs    = seg.time * 150;
          const delayMs  = cumDelay;
          cumDelay += durMs;
          return (
            <div
              key={`${animKey}-${seg.id}-${i}`}
              className="gantt-segment-wrap"
              style={{ width: `${widthPct}%` }}
            >
              <div
                className="gantt-segment"
                style={{
                  background: seg.color,
                  animationDuration: `${durMs}ms`,
                  animationDelay: `${delayMs}ms`,
                }}
              >
                <span className="gantt-seg-label">{seg.label} {seg.time}s</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ processes, p1Ids, p2Ids, animKey }) {
  const byId = id => processes.find(p => p.id === id);
  const seqSegs  = processes.map(p => ({ ...p }));
  const p1Segs   = p1Ids.map(id => byId(id)).filter(Boolean);
  const p2Segs   = p2Ids.map(id => byId(id)).filter(Boolean);
  const seqTotal = seqSegs.reduce((s, p) => s + p.time, 0);
  const p1Total  = p1Segs.reduce((s, p) => s + p.time, 0);
  const p2Total  = p2Segs.reduce((s, p) => s + p.time, 0);
  const globalMax = Math.max(seqTotal, p1Total, p2Total);

  // Sequential finishes before parallel starts (after last seq segment)
  const seqTotalMs = seqTotal * 150;

  return (
    <div className="card timeline-section">
      <div className="card-title">ANIMATED TIMELINE</div>

      <div className="timeline-mode-label">SEQUENTIAL (all on one processor)</div>
      <GanttRow
        label="SEQ"
        segments={seqSegs}
        totalTime={seqTotal}
        globalMax={globalMax}
        animKey={animKey}
        startDelayMs={0}
      />

      <hr className="timeline-divider" />

      <div className="timeline-mode-label">PARALLEL (two processors)</div>
      <GanttRow
        label="P1"
        segments={p1Segs}
        totalTime={p1Total}
        globalMax={globalMax}
        animKey={animKey}
        startDelayMs={seqTotalMs + 400}
      />
      <GanttRow
        label="P2"
        segments={p2Segs}
        totalTime={p2Total}
        globalMax={globalMax}
        animKey={animKey}
        startDelayMs={seqTotalMs + 400}
      />

      <div className="gantt-axis">
        <span className="gantt-axis-tick">0s</span>
        <span className="gantt-axis-tick">{Math.round(globalMax / 2)}s</span>
        <span className="gantt-axis-tick">{globalMax}s</span>
      </div>
    </div>
  );
}

function APExamMode({ isDefault, onClose }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selected) return;
    setSubmitted(true);
  }

  function handleReset() {
    setSelected(null);
    setSubmitted(false);
  }

  const isCorrect = selected === CORRECT_ANSWER;

  return (
    <div className="card" style={{ borderColor: '#ffb34766' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div className="card-title" style={{ color: '#ffb347', margin: 0 }}>AP EXAM MODE — CSN-2</div>
        <button className="proc-remove" onClick={onClose} title="Exit AP Exam Mode" style={{ fontSize: '1rem' }}>✕</button>
      </div>

      {!isDefault && (
        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '3px solid #ffb347', background: '#ffb34710', fontSize: '0.75rem', color: '#ffb347', borderRadius: '0 4px 4px 0' }}>
          AP Exam Mode uses the default W/X/Y/Z scenario. Reset processes to use it.
        </div>
      )}

      <p className="ap-question">
        Processes W (20s), X (30s), Y (45s), and Z (50s) are assigned to two processors.
        Which assignment <strong>minimizes total execution time</strong>?
      </p>

      <div className="ap-options">
        {AP_OPTIONS.map(opt => {
          let cls = 'ap-option';
          if (submitted) {
            if (opt.key === CORRECT_ANSWER) cls += ' correct';
            else if (opt.key === selected)  cls += ' wrong';
          } else if (opt.key === selected) {
            cls += ' selected';
          }
          return (
            <button
              key={opt.key}
              className={cls}
              onClick={() => !submitted && setSelected(opt.key)}
              disabled={submitted}
            >
              <span className="ap-opt-key">{opt.key}</span>
              <span className="ap-opt-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn-ap-submit" onClick={handleSubmit} disabled={!selected || submitted}>
          SUBMIT
        </button>
        {submitted && (
          <button className="btn-ap-submit" onClick={handleReset}>
            TRY AGAIN
          </button>
        )}
      </div>

      {submitted && (
        <div className={`ap-result ${isCorrect ? 'correct' : 'wrong'}`}>
          <div className="ap-result-headline">{isCorrect ? '✅ Correct!' : '❌ Not quite.'}</div>
          <div className="ap-result-body">
            {isCorrect
              ? 'Option B gives the most balanced split: P1 = 70s, P2 = 75s. Parallel time = max(70, 75) = 75s, which is the minimum possible.'
              : `The correct answer is B. P1 = W+Z = 70s, P2 = X+Y = 75s. Parallel time = max(70, 75) = 75s — smaller than option ${selected}'s result.`}
          </div>
          <div className="ap-result-ek">CSN-2.A.6 — Parallel time = longest processor total, not the sum of all times.</div>
        </div>
      )}
    </div>
  );
}

function SpeedupInsight({ processes, seqTime }) {
  const time3 = useMemo(() => greedyParallelTime(processes, 3), [processes]);
  const time4 = useMemo(() => greedyParallelTime(processes, 4), [processes]);
  const bottleneck = useMemo(() => Math.max(...processes.map(p => p.time)), [processes]);
  const bottleneckProc = useMemo(() => processes.find(p => p.time === bottleneck), [processes, bottleneck]);

  const rows = [
    { label: '3 Processors', time: time3, speedup: (seqTime / time3).toFixed(2) },
    { label: '4 Processors', time: time4, speedup: (seqTime / time4).toFixed(2) },
  ];

  return (
    <div className="card">
      <div className="card-title">SPEEDUP INSIGHT — AMDAHL'S LAW (CSN-2.B.5)</div>
      <div className="insight-rows">
        {rows.map(r => (
          <div className="insight-row" key={r.label}>
            <span className="insight-proc-label">{r.label}</span>
            <span className="insight-time">{r.time}s</span>
            <span className="insight-speedup">×{r.speedup}</span>
          </div>
        ))}
      </div>
      {time3 === time4 && (
        <div className="insight-bottleneck">
          Adding more than 3 processors won't help —&nbsp;
          <strong>{bottleneckProc?.label} ({bottleneck}s)</strong> is the bottleneck.
          No matter how many processors you add, execution can't be faster than the longest single process.
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

function App() {
  const [processes, setProcesses] = useState(DEFAULT_PROCESSES);
  const [p1, setP1] = useState([]);
  const [p2, setP2] = useState([]);
  const [dragId, setDragId]         = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [animKey, setAnimKey]       = useState(0);
  const [animating, setAnimating]   = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [apMode, setApMode]         = useState(false);

  // ── Derived ──────────────────────────────────────────────
  const unassigned = useMemo(
    () => processes.filter(p => !p1.includes(p.id) && !p2.includes(p.id)),
    [processes, p1, p2]
  );

  const byId = useCallback(id => processes.find(p => p.id === id), [processes]);

  const seqTime = useMemo(() => processes.reduce((s, p) => s + p.time, 0), [processes]);
  const p1Time  = useMemo(() => p1.reduce((s, id) => { const p = byId(id); return s + (p?.time || 0); }, 0), [p1, byId]);
  const p2Time  = useMemo(() => p2.reduce((s, id) => { const p = byId(id); return s + (p?.time || 0); }, 0), [p2, byId]);
  const canRun  = p1.length > 0 && p2.length > 0;
  const parallelTime = canRun ? Math.max(p1Time, p2Time) : null;
  const speedup      = parallelTime ? (seqTime / parallelTime).toFixed(2) : null;

  const isDefault = useMemo(() =>
    processes.length === DEFAULT_PROCESSES.length &&
    DEFAULT_PROCESSES.every((dp, i) => processes[i]?.id === dp.id && processes[i]?.time === dp.time),
    [processes]
  );

  // ── Process builder actions ───────────────────────────────
  function updateTime(id, val) {
    const t = Math.max(1, Math.min(999, Number(val) || 1));
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, time: t } : p));
  }

  function removeProcess(id) {
    if (processes.length <= 2) return;
    setProcesses(prev => prev.filter(p => p.id !== id));
    setP1(prev => prev.filter(x => x !== id));
    setP2(prev => prev.filter(x => x !== id));
  }

  function addProcess() {
    if (processes.length >= 6) return;
    const usedLabels = new Set(processes.map(p => p.label));
    const label = PROCESS_LABELS.find(l => !usedLabels.has(l)) || `P${processes.length}`;
    const color = PROCESS_COLORS[processes.length % PROCESS_COLORS.length];
    setProcesses(prev => [...prev, { id: label, label, time: 10, color }]);
  }

  function resetProcesses() {
    setProcesses(DEFAULT_PROCESSES);
    setP1([]); setP2([]);
    setShowTimeline(false);
    setApMode(false);
  }

  // ── Drag & drop ───────────────────────────────────────────
  function handleDragStart(e, id) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() { setDragId(null); setDragOverZone(null); }

  function moveToZone(id, zone) {
    setP1(prev => prev.filter(x => x !== id));
    setP2(prev => prev.filter(x => x !== id));
    if (zone === 'p1') setP1(prev => [...prev, id]);
    if (zone === 'p2') setP2(prev => [...prev, id]);
    // 'unassigned' → already removed above
  }

  function makeDrop(zone) {
    return (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('processId') || dragId;
      if (id) moveToZone(id, zone);
      setDragOverZone(null);
    };
  }

  function makeDragOver(zone) {
    return (e) => { e.preventDefault(); setDragOverZone(zone); };
  }

  // Click-to-cycle assignment (unassigned → p1 → p2 → unassigned)
  function handlePillClick(id) {
    if (p1.includes(id)) {
      setP1(prev => prev.filter(x => x !== id));
      setP2(prev => [...prev, id]);
    } else if (p2.includes(id)) {
      setP2(prev => prev.filter(x => x !== id));
    } else {
      setP1(prev => [...prev, id]);
    }
  }

  // ── Run simulation ────────────────────────────────────────
  function runSimulation() {
    setShowTimeline(false);
    setAnimating(true);
    setTimeout(() => {
      setAnimKey(k => k + 1);
      setShowTimeline(true);
      const totalMs = (seqTime + Math.max(p1Time, p2Time)) * 150 + 800;
      setTimeout(() => setAnimating(false), totalMs);
    }, 100);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="app-title">PARALLEL PROCESSING SIMULATOR</div>
          <div className="app-subtitle">AP CSP — Unit 3: Networks &amp; the Internet — CSN-2</div>
        </div>
        <div className="mr-ship-badge">MR. SHIP | AP CSP</div>
      </div>

      {/* Formulas — always visible */}
      <FormulaBox />

      {/* AP Exam Mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className={`btn-ap-toggle${apMode ? ' active' : ''}`}
          onClick={() => setApMode(v => !v)}
        >
          📝 AP EXAM MODE
        </button>
        {!isDefault && (
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            (reset to default for exam question)
          </span>
        )}
      </div>

      {/* AP Exam Mode panel */}
      {apMode && <APExamMode isDefault={isDefault} onClose={() => setApMode(false)} />}

      <div className="main-grid">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Process builder */}
          <div className="card">
            <div className="card-title">PROCESS BUILDER</div>
            <div className="process-list">
              {processes.map(proc => (
                <div
                  key={proc.id}
                  className="process-editor"
                  style={{ borderLeftColor: proc.color }}
                >
                  <span className="proc-label" style={{ color: proc.color }}>{proc.label}</span>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={proc.time}
                    onChange={e => updateTime(proc.id, e.target.value)}
                  />
                  <span className="proc-unit">s</span>
                  {processes.length > 2 && (
                    <button className="proc-remove" onClick={() => removeProcess(proc.id)} title="Remove">×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="proc-builder-actions">
              {processes.length < 6 && (
                <button className="btn-add-proc" onClick={addProcess}>+ ADD PROCESS</button>
              )}
              <button className="btn-reset-proc" onClick={resetProcesses}>RESET TO DEFAULT</button>
            </div>
          </div>

          {/* Processor assignment */}
          <div className="card">
            <div className="card-title">PROCESSOR ASSIGNMENT — drag pills to assign</div>

            <div className="unassigned-pool-label">UNASSIGNED</div>
            <div
              className={`unassigned-pool${dragOverZone === 'unassigned' ? ' drag-over' : ''}`}
              onDrop={makeDrop('unassigned')}
              onDragOver={makeDragOver('unassigned')}
              onDragLeave={() => setDragOverZone(null)}
            >
              {unassigned.length === 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  all assigned
                </span>
              )}
              {unassigned.map(proc => (
                <ProcessPill
                  key={proc.id}
                  proc={proc}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={dragId === proc.id}
                  onClick={handlePillClick}
                />
              ))}
            </div>

            <div className="processor-lanes" style={{ marginTop: '0.75rem' }}>
              <ProcessorLane
                name="PROCESSOR 1"
                procIds={p1}
                processes={processes}
                total={p1Time}
                isDragOver={dragOverZone === 'p1'}
                onDrop={makeDrop('p1')}
                onDragOver={makeDragOver('p1')}
                onDragLeave={() => setDragOverZone(null)}
                onPillClick={handlePillClick}
              />
              <ProcessorLane
                name="PROCESSOR 2"
                procIds={p2}
                processes={processes}
                total={p2Time}
                isDragOver={dragOverZone === 'p2'}
                onDrop={makeDrop('p2')}
                onDragOver={makeDragOver('p2')}
                onDragLeave={() => setDragOverZone(null)}
                onPillClick={handlePillClick}
              />
            </div>
          </div>

          {/* Simulation panel */}
          <SimulationPanel
            seqTime={seqTime}
            p1Time={p1Time}
            p2Time={p2Time}
            parallelTime={parallelTime}
            speedup={speedup}
            canRun={canRun}
            onRun={runSimulation}
            animating={animating}
          />

          {/* Timeline */}
          {showTimeline && (
            <Timeline
              key={animKey}
              processes={processes}
              p1Ids={p1}
              p2Ids={p2}
              animKey={animKey}
            />
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SpeedupInsight processes={processes} seqTime={seqTime} />

          {/* Live assignment summary */}
          <div className="card">
            <div className="card-title">ASSIGNMENT SUMMARY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { label: 'P1 total', time: p1Time, ids: p1 },
                { label: 'P2 total', time: p2Time, ids: p2 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.5rem', background: 'var(--surface2)', borderRadius: '4px', border: '1px solid var(--gray)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted)' }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text)' }}>
                    {row.ids.length ? row.ids.join('+') + ' = ' : ''}{row.time > 0 ? `${row.time}s` : '—'}
                  </span>
                </div>
              ))}
              {parallelTime !== null && (
                <div style={{ marginTop: '0.25rem', padding: '0.35rem 0.5rem', background: '#00ff9d08', border: '1px solid #00ff9d44', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--green)' }}>Parallel time</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--green)' }}>max = {parallelTime}s</span>
                </div>
              )}
            </div>
          </div>

          {/* Tip card */}
          <div className="card" style={{ borderColor: '#3a3f5c' }}>
            <div className="card-title">HOW TO USE</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>1. Edit process times in the builder.</div>
              <div>2. Drag pills (or click to cycle) to assign processes to P1 and P2.</div>
              <div>3. Watch speedup update live.</div>
              <div>4. Click <strong style={{ color: 'var(--green)' }}>RUN SIMULATION</strong> to see the animated Gantt chart.</div>
              <div>5. Try <strong style={{ color: 'var(--amber)' }}>AP EXAM MODE</strong> to test yourself.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
