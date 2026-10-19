// Import Data page: lets the user bring CalSim 3 data files into the app.
// Currently a placeholder to confirm navigation works; the real UI follows the Figma prototype.

import './ImportData.css'; // page-specific styles, same pattern as the other pages

// onNavigate comes from App.jsx; call it with a page id (e.g. 'variable-search')
// to send the user to another page, such as after a successful import.
export default function ImportData({ onNavigate }) {
  return (
    <main className="import-data-page" aria-labelledby="import-data-title">
      <header>
        <h1 id="import-data-title">Import Data</h1>
      </header>

      {/* TODO: file picker, preview table, and import button per the Figma prototype */}
      <p>Import Data page coming soon.</p>
    </main>
  );
}