// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;

// Async funktion för att hämta data från backend
async function fetchData() {
    try {
        const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
        
        if (!response.ok) {
            throw new Error(`HTTP-fel! Status: ${response.status}`);
        }

        // Lagra all data
        const data = await response.json();
        
        // Konvertera latest_update strängen till ett Date-objekt för enklare filtrering.
        // Formatet antas vara "Senast uppdaterat YYYY-MM-DD HH:MM:SS"
        riverData = data.map(item => {
            const dateStr = item.latest_update.replace(/^Senast uppdaterat\s*/, '');
            // Parse med Date.parse för att få millisekunder
            item.timestamp = Date.parse(dateStr); 
            return item;
        }).filter(item => !isNaN(item.timestamp)); // Filtrera bort ogiltiga datum

        // Sortera datan i stigande ordning efter tid
        riverData.sort((a, b) => a.timestamp - b.timestamp);

        // Skapa diagrammet initialt med standardfiltret (day)
        applyFilter('day'); 

        // Lyssna på filterändringar
        setupFilterListeners();

    } catch (error) {
        console.error("Kunde inte hämta eller bearbeta data:", error);
        alert("Kunde inte ladda data. Kontrollera konsolen för mer information.");
    }
}

// Funktion för att sätta upp händelselyssnare för radio-knapparna
function setupFilterListeners() {
    const filters = document.querySelectorAll('input[name="time-filter"]');
    filters.forEach(filter => {
        filter.addEventListener('change', (event) => {
            applyFilter(event.target.value);
        });
    });
}

// Funktion för att filtrera data och uppdatera diagrammet
function applyFilter(filter) {
    if (riverData.length === 0) return;

    let startTime = 0;
    const now = Date.now();
    
    // Beräkna starttiden baserat på valt filter
    switch (filter) {
        case 'day':
            startTime = now - (24 * 60 * 60 * 1000); // Senaste 24 timmarna
            break;
        case 'week':
            startTime = now - (7 * 24 * 60 * 60 * 1000); // Senaste 7 dagarna
            break;
        case 'month':
            startTime = now - (30 * 24 * 60 * 60 * 1000); // Senaste 30 dagarna
            break;
        case 'year':
            startTime = now - (365 * 24 * 60 * 60 * 1000); // Senaste 365 dagarna
            break;
        default:
            // Visa all data som standard om inget filter är valt
            startTime = 0; 
    }

    // Filtrera datan
    const filteredData = riverData.filter(item => item.timestamp >= startTime);

    // Förbered data för diagrammet
    const timestamps = filteredData.map(item => item.timestamp);
    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);

    // Uppdatera eller skapa diagrammet
    if (chartInstance) {
        updateChart(timestamps, waterLevels, flowValues, filter);
    } else {
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
function updateChart(timestamps, waterLevels, flowValues, filter) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    // Anpassa X-axelns visning baserat på filter (för bättre läsbarhet)
    let unit = 'hour';
    if (filter === 'week') {
        unit = 'day';
    } else if (filter === 'month') {
        unit = 'day';
    } else if (filter === 'year') {
        unit = 'month';
    }
    
    chartInstance.options.scales.x.time.unit = unit;
    
    chartInstance.update();
}


// Funktion för att skapa diagrammet med dubbla Y-axlar
function createChart(timestamps, waterLevels, flowValues, initialFilter) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    // Initiala enheten för X-axeln
    let initialUnit = 'hour';
    if (initialFilter === 'week' || initialFilter === 'month') {
        initialUnit = 'day';
    } else if (initialFilter === 'year') {
        initialUnit = 'month';
    }

    return new Chart(ctx, {
        type: 'line', 
        data: {
            // Nu används timestamps (ms) som labels
            labels: timestamps, 
            datasets: [{
                // Dataset 1: Vattennivå
                label: 'Water Level (m)',
                data: waterLevels,
                borderColor: '#4A90E2', // Blåare
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
                yAxisID: 'water-level' 
            },
            {
                // Dataset 2: Flöde
                label: 'Flow (m³/s)',
                data: flowValues,
                borderColor: '#50E3C2', // Grönare
                backgroundColor: 'rgba(80, 227, 194, 0.1)',
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
                yAxisID: 'flow-rate' 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Låter behållarhöjden (60vh) styra
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                // X-AXEL - Använder 'time' typ för hantering av datum/tid
                x: {
                    type: 'time',
                    time: {
                        unit: initialUnit, // Ställ in initial enhet
                        displayFormats: {
                            'hour': 'MMM dd, HH:mm',
                            'day': 'MMM dd',
                            'month': 'MMM yyyy'
                        },
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
                    },
                    title: {
                        display: true,
                        text: 'Tidpunkt'
                    },
                    ticks: {
                        maxRotation: 45, 
                        minRotation: 0,
                    }
                },
                // Y-AXEL 1 (Vattennivå)
                'water-level': { 
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Water Level (m)',
                        color: '#4A90E2'
                    },
                    ticks: {
                        color: '#4A90E2'
                    },
                    grid: {
                         color: 'rgba(0, 0, 0, 0.05)' // Lättare rutnät
                    }
                },
                
                // Y-AXEL 2 (Flöde)
                'flow-rate': { 
                    type: 'linear',
                    position: 'right', 
                    title: {
                        display: true,
                        text: 'Flow (m³/s)',
                        color: '#50E3C2'
                    },
                    ticks: {
                        color: '#50E3C2'
                    },
                    grid: { 
                        drawOnChartArea: false // Stänger av rutnätet i diagramområdet
                    } 
                }
            }
        }
    });
}

// Starta hämtning av data
fetchData();