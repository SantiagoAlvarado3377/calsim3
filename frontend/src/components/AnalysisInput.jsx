import './AnalysisInput.css';

// The full variable (including its DSS path) and run (including its File)
// remain in App's navigation state; this is the destination's visible receipt.
function AnalysisInput({ selection }) {
    if (!selection) return null;
    const { variable, run } = selection;

    return (
        <section className="analysis-input" aria-label="Selected analysis input">
            <h2>Selected for analysis</h2>
            <dl>
                <div><dt>Variable</dt><dd>{variable.identifier}</dd></div>
                <div><dt>Run</dt><dd>{run.name}</dd></div>
                {run.file && <div><dt>Source file</dt><dd>{run.file.name}</dd></div>}
                <div><dt>Units</dt><dd>{variable.units || '—'}</dd></div>
                <div><dt>Component Type</dt><dd>{variable.componentType || '—'}</dd></div>
                <div><dt>Interval</dt><dd>{variable.interval || '—'}</dd></div>
            </dl>
        </section>
    );
}

export default AnalysisInput;
