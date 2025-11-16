// ... (All kod från "Global variabel för att lagra all hämtad data" ner till 'function setupFilterListeners') ...

// Funktion för att sätta upp händelselyssnare för radio-knapparna
function setupFilterListeners() {
    // Säkerställ att vi bara sätter upp lyssnare en gång
    if (window.listenersSetup) return; 

    const filters = document.querySelectorAll('input[name="time-filter"]');
    if (filters.length > 0) {
        filters.forEach(filter => {
            filter.addEventListener('change', (event) => {
                applyFilter(event.target.value);
            });
        });
    }
    window.listenersSetup = true;
}

// ... (All kod från 'function applyFilter' ner till 'function createChart') ...
// ...

// Starta initial laddning
fetchData();

// NY FIX: Sätt upp filterlyssnare efter att DOM är helt laddad, OAVSETT fetchData() lyckas.
document.addEventListener('DOMContentLoaded', setupFilterListeners);