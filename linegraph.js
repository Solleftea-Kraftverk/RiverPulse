// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;
// Definierar den tidigaste tillåtna datan: 2025-01-01 i millisekunder
const MIN_TIMESTAMP = Date.parse('2025-01-01T00:00:00'); 

// Async funktion för att hämta data från backend
async function fetchData() {
    try {
        const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
        
        if (!response.ok) {
            throw new Error(`HTTP-fel! Status: ${response.status}`);
        }

        const data = await response.json();
        
        riverData = data
            .map(item => {
                const dateStr = item.latest_update.replace(/^Senast uppdaterat\s*/, '');
                // Använd Date.parse för att få millisekunder
                item.timestamp = Date.parse(dateStr); 
                return item;
            })
            // 1. Filtrera bort ogiltiga datum OCH 2. Data FÖRE 2025
            .filter(item => !isNaN(item.timestamp) && item.timestamp >= MIN_TIMESTAMP);

        // Sortera datan i stigande ordning efter tid
        riverData.sort((a, b) => a.timestamp - b.timestamp);

        // Skapa diagrammet initialt med standardfiltret (day)
        applyFilter('day'); 

        // Lyssna på filterändringar
        setupFilterListeners();

    } catch (error) {
        console.error("Kunde inte hämta eller bearbeta data:", error);
        // Använd alert, men byt till en diskretare UI-metod i en produktionsmiljö.
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
            startTime = now - (365 * 24 * 60 * 60 * 1000); // Senaste 365 dagarna (året)
            break;
        default:
            startTime = MIN_TIMESTAMP; 
    }
    
    // Säkerställ att starttiden inte är före MIN_TIMESTAMP
    const finalStartTime = Math.max(startTime, MIN_TIMESTAMP);

    // Filtrera datan
    const filteredData = riverData.filter(item => item.timestamp >= finalStartTime);

    // Förbered data för diagrammet
    const timestamps = filteredData.map(item => item.timestamp);
    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);
    
    // Extrahera det senaste värdet för att rita ut som text
    const latestWaterLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
    const latestFlow = flowValues.length > 0 ? flowValues[flowValues.length - 1] : null;

    // Uppdatera eller skapa diagrammet
    if (chartInstance) {
        updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow);
    } else {
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
function updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    // Anpassa X-axelns visning baserat på filter
    let unit = 'hour';
    if (filter === 'week') {
        unit = 'day';
    } else if (filter === 'month') {
        unit = 'day';
    } else if (filter === 'year') {
        unit = 'month';
    }
    
    chartInstance.options.scales.x.time.unit = unit;
    
    // Uppdatera plugins för att rita ut senaste värdet
    chartInstance.options.plugins.customLabels.latestWaterLevel = latestWaterLevel;
    chartInstance.options.plugins.customLabels.latestFlow = latestFlow;
    
    chartInstance.update();
}


// Funktion för att skapa diagrammet med dubbla Y-axlar
function createChart(timestamps, waterLevels, flowValues, initialFilter, latestWaterLevel, latestFlow) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    // Initiala enheten för X-axeln
    let initialUnit = 'hour';
    if (initialFilter === 'week' || initialFilter === 'month') {
        initialUnit = 'day';
    } else if (initialFilter === 'year') {
        initialUnit = 'month';
    }

    // Chart.js-plugin för att rita ut det senaste värdet som text
    const latestValueLabelPlugin = {
        id: 'customLabels',
        latestWaterLevel: latestWaterLevel,
        latestFlow: latestFlow,

        afterDraw: (chart) => {
            const { ctx, chartArea: { right }, scales: { 'water-level': y1, 'flow-rate': y2 } } = chart;
            ctx.save();
            ctx.font = '700 10px var(--font-stack)';
            ctx.textAlign = 'right';

            // Ritar ut Nivå-värdet (vänster axel)
            if (latestWaterLevel !== null && y1.ticks.length > 0) {
                const latestY = y1.getPixelForValue(latestWaterLevel);
                ctx.fillStyle = chart.data.datasets[0].borderColor;
                ctx.fillText(
                    latestWaterLevel.toFixed(2), 
                    right - 10, 
                    latestY - 5 // Placera lite ovanför punkten
                );
            }

            // Ritar ut Flöde-värdet (höger axel)
            if (latestFlow !== null && y2.ticks.length > 0) {
                const latestY = y2.getPixelForValue(latestFlow);
                ctx.fillStyle = chart.data.datasets[1].borderColor;
                ctx.fillText(
                    latestFlow.toFixed(2), 
                    right - 10, 
                    latestY + 15 // Placera lite under punkten
                );
            }

            ctx.restore();
        }
    };

    return new Chart(ctx, {
        type: 'line', 
        data: {
            labels: timestamps, 
            datasets: [{
                label: 'Nivå (m)',
                data: waterLevels,
                borderColor: 'var(--primary-color)',
                backgroundColor: 'rgba(0, 188, 212, 0.1)',
                fill: false,
                pointRadius: 3,
                pointHoverRadius: 5,
                borderWidth: 2,
                yAxisID: 'water-level' 
            },
            {
                label: 'Flöde (m³/s)',
                data: flowValues,
                borderColor: 'var(--secondary-color)',
                backgroundColor: 'rgba(233, 30, 99, 0.1)',
                fill: false,
                pointRadius: 3,
                pointHoverRadius: 5,
                borderWidth: 2,
                yAxisID: 'flow-rate' 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                customLabels: latestValueLabelPlugin, // Lägg till den anpassade pluginen här
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    // Förbättrad mörk stil för tooltips
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'var(--text-color)',
                    bodyColor: 'var(--text-color)',
                    borderColor: 'var(--primary-color)',
                    borderWidth: 1
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: 'var(--text-color)'
                    }
                }
            },
            scales: {
                // X-AXEL
                x: {
                    type: 'time',
                    time: {
                        unit: initialUnit, 
                        displayFormats: {
                            'hour': 'HH:mm',
                            'day': 'MMM dd',
                            'month': 'MMM yyyy'
                        },
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
                    },
                    title: {
                        display: true,
                        text: 'Tidpunkt',
                        color: 'var(--text-color)'
                    },
                    ticks: {
                        color: '#999',
                        maxRotation: 45, 
                        minRotation: 0,
                    },
                    grid: {
                         color: 'rgba(255, 255, 255, 0.08)' // Lätt, mörkt rutnät
                    }
                },
                // Y-AXEL 1 (Nivå)
                'water-level': { 
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Nivå (m)',
                        color: 'var(--primary-color)'
                    },
                    ticks: {
                        color: 'var(--primary-color)'
                    },
                    grid: {
                         color: 'rgba(255, 255, 255, 0.08)' 
                    }
                },
                
                // Y-AXEL 2 (Flöde)
                'flow-rate': { 
                    type: 'linear',
                    position: 'right', 
                    title: {
                        display: true,
                        text: 'Flöde (m³/s)',
                        color: 'var(--secondary-color)'
                    },
                    ticks: {
                        color: 'var(--secondary-color)'
                    },
                    grid: { 
                        drawOnChartArea: false,
                        color: 'rgba(255, 255, 255, 0.08)' 
                    } 
                }
            }
        },
        plugins: [latestValueLabelPlugin] // Registrera pluginen
    });
}

// Starta hämtning av data
fetchData();