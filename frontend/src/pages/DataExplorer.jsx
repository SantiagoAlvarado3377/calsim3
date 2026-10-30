import PageHeader from '../components/PageHeader.jsx';

// displays the Data Explorer page title
function DataExplorer() {
  return (
    <main className="data-explorer" aria-labelledby="data-explorer-title">
      <PageHeader id="data-explorer-title" title="Data Explorer" />
    </main>
  );
}

export default DataExplorer;
