const { useState, useMemo } = React;

const PROCESS_COLORS = [
  '#00ff9d',
  '#00b4ff',
  '#ffb347',
  '#ff4d6d',
  '#ffe066',
  '#c084fc'
];

const PROCESS_LABELS = ['W', 'X', 'Y', 'Z', 'A', 'B'];

const DEFAULT_PROCESSES = [
  { id: 'W', label: 'W', time: 20, color: PROCESS_COLORS[0] },
  { id: 'X', label: 'X', time: 30, color: PROCESS_COLORS[1] },
  { id: 'Y', label: 'Y', time: 45, color: PROCESS_COLORS[2] },
  { id: 'Z', label: 'Z', time: 50, color: PROCESS_COLORS[3] }
];

const AP_OPTIONS = [
  { key: 'A', text: 'W + X on P1 (50s), Y + Z on P2 (95s)' },
  { key: 'B', text: 'W + Z on P1 (70s), X + Y on P2 (75s)' },
  { key: 'C', text: 'W + Y on P1 (65s), X + Z on P2 (80s)' },
  { key: 'D', text: 'W + X + Y on P1 (95s), Z on P2 (50s)' }
];

const CORRECT_ANSWER = 'B';

function greedyParallelTime(processes, processorCount) {
  const sorted = [...processes].sort((a, b) => b.time - a.time);
  const bins = Array(processorCount).fill(0);

  sorted.forEach(proc => {
    const smallest = Math.min(...bins);
    const index = bins.indexOf(smallest);
    bins[index] += proc.time;
  });

  return Math.max(...bins);
}

function FormulaBox() {
  return (
    <div className="formula-box">
      <div className="card-title">AP PSEUDOCODE — CSN-2 FORMULAS</div>
      <div className="formula-lines">
        <div className="formula-line">
          <span>Sequential Time</span> = sum of ALL process times
        </div>
        <div className="formula-line">
          <span>Parallel Time</span> = longest processor total
        </div>
        <div className="formula-line">
          <span>Speedup</span> = Sequential ÷ Parallel
        </div>
      </div>
    </div>
  );
}

function ProcessPill({ proc, onDragStart, onClick }) {
  return (
    <div
      className="process-pill"
      style={{ borderLeftColor: proc.color }}
      draggable
      onDragStart={event => onDragStart(event, proc.id)}
      onClick={() => onClick(proc.id)}
      title="Drag to assign, or click"
    >
      <span className="pill-label" style={{ color: proc.color }}>
        {proc.label}
      </span>
      <span className="pill-time">{proc.time}s</span>
    </div>
  );
}

function ProcessorLane({
  title,
  ids,
  processes,
  total,
  onDrop,
  onDragStart,
  onPillClick
}) {
  const getProcess = id => processes.find(proc => proc.id === id);

  return (
    <div
      className="processor-lane"
      onDragOver={event => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="processor-lane-header">
        <span className="processor-lane-name">{title}</span>
        <span className="processor-lane-total">{total > 0 ? `${total}s` : '—'}</span>
      </div>

      <div className="processor-lane-pills">
        {ids.map(id => {
          const proc = getProcess(id);
          if (!proc) return null;

          return (
            <ProcessPill
              key={proc.id}
              proc={proc}
              onDragStart={onDragStart}
              onClick={onPillClick}
            />
          );
        })}
      </div>
    </div>
  );
}

function SimulationPanel({ seqTime, parallelTime, speedup, canRun, onRun }) {
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
          <div className={`stat-value ${parallelTime !== null ? 'green' : 'muted'}`}>
            {parallelTime !== null ? parallelTime : '—'}
          </div>
          <div className="stat-unit">seconds</div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Speedup</div>
          <div className={`stat-value ${speedup !== null ? 'amber' : 'muted'}`}>
            {speedup !== null ? speedup : '—'}
          </div>
          <div className="stat-unit">× faster</div>
        </div>
      </div>

      <button className="btn-run" disabled={!canRun} onClick={onRun}>
        RUN SIMULATION
      </button>
    </div>
  );
}

function Timeline({ processes, p1, p2 }) {
  const getProcess = id => processes.find(proc => proc.id === id);

  const p1Processes = p1.map(getProcess).filter(Boolean);
  const p2Processes = p2.map(getProcess).filter(Boolean);

  const seqTotal = processes.reduce((sum, proc) => sum + proc.time, 0);
  const p1Total = p1Processes.reduce((sum, proc) => sum + proc.time, 0);
  const p2Total = p2Processes.reduce((sum, proc) => sum + proc.time, 0);
  const maxTime = Math.max(seqTotal, p1Total, p2Total, 1);

  function Row({ label, items }) {
    return (
      <div className="gantt-row">
        <div className="gantt-row-label">{label}</div>
        <div className="gantt-track">
          {items.map(proc => (
            <div
              key={`${label}-${proc.id}`}
              className="gantt-segment-wrap"
              style={{ width: `${(proc.time / maxTime) * 100}%` }}
            >
              <div className="gantt-segment" style={{ background: proc.color }}>
                <span className="gantt-seg-label">
                  {proc.label} {proc.time}s
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card timeline-section">
      <div className="card-title">TIMELINE</div>

      <div className="timeline-mode-label">SEQUENTIAL</div>
      <Row label="SEQ" items={processes} />

      <hr className="timeline-divider" />

      <div className="timeline-mode-label">PARALLEL</div>
      <Row label="P1" items={p1Processes} />
      <Row label="P2" items={p2Processes} />

      <div className="gantt-axis">
        <span className="gantt-axis-tick">0s</span>
        <span className="gantt-axis-tick">{Math.round(maxTime / 2)}s</span>
        <span className="gantt-axis-tick">{maxTime}s</span>
      </div>
    </div>
  );
}

function APExamMode({ onClose }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = selected === CORRECT_ANSWER;

  function reset() {
    setSelected(null);
    setSubmitted(false);
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div className="card-title">AP EXAM MODE — CSN-2</div>
        <button className="proc-remove" onClick={onClose}>×</button>
      </div>

      <p className="ap-question">
        Processes W (20s), X (30s), Y (45s), and Z (50s) are assigned to two
        processors. Which assignment <strong>minimizes total execution time</strong>?
      </p>

      <div className="ap-options">
        {AP_OPTIONS.map(option => {
          let className = 'ap-option';

          if (!submitted && selected === option.key) {
            className += ' selected';
          }

          if (submitted && option.key === CORRECT_ANSWER) {
            className += ' correct';
          }

          if (
            submitted &&
            option.key === selected &&
            selected !== CORRECT_ANSWER
          ) {
            className += ' wrong';
          }

          return (
            <button
              key={option.key}
              className={className}
              disabled={submitted}
              onClick={() => setSelected(option.key)}
            >
              <span className="ap-opt-key">{option.key}</span>
              <span className="ap-opt-text">{option.text}</span>
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <button
          className="btn-ap-submit"
          disabled={!selected}
          onClick={() => setSubmitted(true)}
        >
          SUBMIT
        </button>
      ) : (
        <>
          <div className={`ap-result ${correct ? 'correct' : 'wrong'}`}>
            <div className="ap-result-headline">
              {correct ? '✅ Correct!' : '❌ Not quite.'}
            </div>
            <div className="ap-result-body">
              Option B gives P1 = 70s and P2 = 75s, so the parallel execution
              time is 75 seconds.
            </div>
          </div>

          <button className="btn-ap-submit" onClick={reset}>
            TRY AGAIN
          </button>
        </>
      )}
    </div>
  );
}

function SpeedupInsight({ processes, seqTime }) {
  const time3 = useMemo(() => greedyParallelTime(processes, 3), [processes]);
  const time4 = useMemo(() => greedyParallelTime(processes, 4), [processes]);

  return (
    <div className="card">
      <div className="card-title">SPEEDUP INSIGHT</div>

      <div className="insight-rows">
        <div className="insight-row">
          <span className="insight-proc-label">3 Processors</span>
          <span className="insight-time">{time3}s</span>
          <span className="insight-speedup">×{(seqTime / time3).toFixed(2)}</span>
        </div>

        <div className="insight-row">
          <span className="insight-proc-label">4 Processors</span>
          <span className="insight-time">{time4}s</span>
          <span className="insight-speedup">×{(seqTime / time4).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [processes, setProcesses] = useState(DEFAULT_PROCESSES);
  const [p1, setP1] = useState([]);
  const [p2, setP2] = useState([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [apMode, setApMode] = useState(false);

  const unassigned = useMemo(
    () => processes.filter(proc => !p1.includes(proc.id) && !p2.includes(proc.id)),
    [processes, p1, p2]
  );

  const seqTime = useMemo(
    () => processes.reduce((sum, proc) => sum + proc.time, 0),
    [processes]
  );

  const p1Time = useMemo(
    () => p1.reduce((sum, id) => {
      const proc = processes.find(item => item.id === id);
      return sum + (proc ? proc.time : 0);
    }, 0),
    [p1, processes]
  );

  const p2Time = useMemo(
    () => p2.reduce((sum, id) => {
      const proc = processes.find(item => item.id === id);
      return sum + (proc ? proc.time : 0);
    }, 0),
    [p2, processes]
  );

  const canRun = p1.length > 0 && p2.length > 0;
  const parallelTime = canRun ? Math.max(p1Time, p2Time) : null;
  const speedup = parallelTime ? (seqTime / parallelTime).toFixed(2) : null;

  function updateTime(id, value) {
    const numeric = Number(value);
    const safeTime = Math.max(1, Math.min(999, numeric || 1));

    setProcesses(current =>
      current.map(proc =>
        proc.id === id ? { ...proc, time: safeTime } : proc
      )
    );
  }

  function removeProcess(id) {
    if (processes.length <= 2) return;

    setProcesses(current => current.filter(proc => proc.id !== id));
    setP1(current => current.filter(item => item !== id));
    setP2(current => current.filter(item => item !== id));
  }

  function addProcess() {
    if (processes.length >= PROCESS_LABELS.length) return;

    const used = new Set(processes.map(proc => proc.label));
    const label = PROCESS_LABELS.find(item => !used.has(item));

    setProcesses(current => [
      ...current,
      {
        id: label,
        label,
        time: 10,
        color: PROCESS_COLORS[current.length % PROCESS_COLORS.length]
      }
    ]);
  }

  function resetProcesses() {
    setProcesses(DEFAULT_PROCESSES);
    setP1([]);
    setP2([]);
    setShowTimeline(false);
    setApMode(false);
  }

  function startDrag(event, id) {
    event.dataTransfer.setData('processId', id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function moveTo(id, destination) {
    setP1(current => current.filter(item => item !== id));
    setP2(current => current.filter(item => item !== id));

    if (destination === 'p1') {
      setP1(current => [...current, id]);
    }

    if (destination === 'p2') {
      setP2(current => [...current, id]);
    }
  }

  function dropOn(destination) {
    return event => {
      event.preventDefault();
      const id = event.dataTransfer.getData('processId');
      if (id) moveTo(id, destination);
    };
  }

  function cycleAssignment(id) {
    if (p1.includes(id)) {
      moveTo(id, 'p2');
    } else if (p2.includes(id)) {
      moveTo(id, 'unassigned');
    } else {
      moveTo(id, 'p1');
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <div className="app-title">PARALLEL PROCESSING SIMULATOR</div>
          <div className="app-subtitle">
            AP CSP — Computing Systems and Networks — CSN-2
          </div>
        </div>
        <div className="mr-ship-badge">MR. SHIP | AP CSP</div>
      </div>

      <FormulaBox />

      <div style={{ marginBottom: '1rem' }}>
        <button
          className={`btn-ap-toggle${apMode ? ' active' : ''}`}
          onClick={() => setApMode(current => !current)}
        >
          📝 AP EXAM MODE
        </button>
      </div>

      {apMode && <APExamMode onClose={() => setApMode(false)} />}

      <div className="main-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-title">PROCESS BUILDER</div>

            <div className="process-list">
              {processes.map(proc => (
                <div
                  key={proc.id}
                  className="process-editor"
                  style={{ borderLeftColor: proc.color }}
                >
                  <span className="proc-label" style={{ color: proc.color }}>
                    {proc.label}
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={proc.time}
                    onChange={event => updateTime(proc.id, event.target.value)}
                  />

                  <span className="proc-unit">s</span>

                  {processes.length > 2 && (
                    <button
                      className="proc-remove"
                      onClick={() => removeProcess(proc.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="proc-builder-actions">
              {processes.length < PROCESS_LABELS.length && (
                <button className="btn-add-proc" onClick={addProcess}>
                  + ADD PROCESS
                </button>
              )}

              <button className="btn-reset-proc" onClick={resetProcesses}>
                RESET TO DEFAULT
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">PROCESSOR ASSIGNMENT — drag pills to assign</div>

            <div className="unassigned-pool-label">UNASSIGNED</div>
            <div
              className="unassigned-pool"
              onDragOver={event => event.preventDefault()}
              onDrop={dropOn('unassigned')}
            >
              {unassigned.length === 0 && (
                <span style={{ opacity: 0.6 }}>all assigned</span>
              )}

              {unassigned.map(proc => (
                <ProcessPill
                  key={proc.id}
                  proc={proc}
                  onDragStart={startDrag}
                  onClick={cycleAssignment}
                />
              ))}
            </div>

            <div className="processor-lanes" style={{ marginTop: '0.75rem' }}>
              <ProcessorLane
                title="PROCESSOR 1"
                ids={p1}
                processes={processes}
                total={p1Time}
                onDrop={dropOn('p1')}
                onDragStart={startDrag}
                onPillClick={cycleAssignment}
              />

              <ProcessorLane
                title="PROCESSOR 2"
                ids={p2}
                processes={processes}
                total={p2Time}
                onDrop={dropOn('p2')}
                onDragStart={startDrag}
                onPillClick={cycleAssignment}
              />
            </div>
          </div>

          <SimulationPanel
            seqTime={seqTime}
            parallelTime={parallelTime}
            speedup={speedup}
            canRun={canRun}
            onRun={() => setShowTimeline(true)}
          />

          {showTimeline && (
            <Timeline processes={processes} p1={p1} p2={p2} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SpeedupInsight processes={processes} seqTime={seqTime} />

          <div className="card">
            <div className="card-title">ASSIGNMENT SUMMARY</div>

            <div>
              <div>P1: {p1.length ? p1.join(' + ') : '—'} ({p1Time}s)</div>
              <div>P2: {p2.length ? p2.join(' + ') : '—'} ({p2Time}s)</div>

              {parallelTime !== null && (
                <div style={{ marginTop: '0.75rem' }}>
                  Parallel time = <strong>{parallelTime}s</strong>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">HOW TO USE</div>
            <div style={{ lineHeight: 1.7 }}>
              <div>1. Edit process times.</div>
              <div>2. Drag or click processes to assign them.</div>
              <div>3. Compare processor totals.</div>
              <div>4. Run the simulation to show the timeline.</div>
              <div>5. Use AP Exam Mode for practice.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find #root element.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
