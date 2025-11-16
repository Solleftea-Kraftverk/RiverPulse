// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;
// Definierar den tidigaste tillåtna datan: 2025-11-08 i millisekunder
const MIN_TIMESTAMP = Date.parse('2025-11-08T00:00:00'); 

// Utility-funktion för att hämta CSS-variabler
function getCssVariable(name) {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim() || {
        '--primary-color': '#00b4d8', 
        '--secondary-color': '#ff7f50', 
        '--text-color-light': '#f0f0f0', 
        '--text-color-dark': '#a9a9b3', 
        '--font-stack': 'Roboto Mono, monospace',
        '--card-bg': '#1f2038'
    }[name] || ''; 
}

// NY FUNKTION: Uppdaterar den dedikerade HTML-widgeten
function updateValueWidget(latestTimestamp, latestLevel, latestFlow) {
    const timeEl = document.getElementById('latest-update-time');
    const levelEl = document.getElementById('latest-level');
    const flowEl = document.getElementById('latest-flow');

    if (timeEl) {
        // Formatera tiden till en mer läsbar sträng
        const date = new Date(latestTimestamp);
        timeEl.textContent = `Senast: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    if (levelEl) {
        levelEl.textContent = latestLevel !== null ? latestLevel.toFixed(2) : '--';
    }
    if (flowEl) {
        flowEl.textContent = latestFlow !== null ? latestFlow.toFixed(2) : '--';
    }
}


// Async function to fetch data from backend (med robust felhantering)
async function fetchData() {
    try {
        const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
        
        if (!response.ok) {
            throw new Error(`HTTP-fel! Status: ${response.status}. Kan bero på nätverksblockering.`);
        }

        const data = await response.json();
        
        riverData = data
            .map(item => {
                const dateStr = item.latest_update.replace(/^Senast uppdaterat\s*/, '');
                item.timestamp = Date.parse(dateStr); 
                return item;
            })
            .filter(item => !isNaN(item.timestamp) && item.timestamp >= MIN_TIMESTAMP);

        riverData.sort((a, b) => a.timestamp - b.timestamp);

        applyFilter('day'); 
        setupFilterListeners();

    } catch (error) {
        console.error("Fel vid datahämtning eller bearbetning:", error.message);
        alert("Kunde inte ladda data. Kontrollera konsolen för mer information.");
        // Vid fel, uppdatera widgeten med ett felmeddelande
        updateValueWidget('Kunde ej ladda data', '--', '--'); 
    }
}

// Funktion för att sätta upp händelselyssnare för radio-knapparna
function setupFilterListeners() {
    const filters = document.querySelectorAll('input[name="time-filter"]');
    if (filters.length > 0) {
        filters.forEach(filter => {
            filter.addEventListener('change', (event) => {
                applyFilter(event.target.value);
            });
        });
    }
}

// Funktion för att filtrera data och uppdatera diagrammet
function applyFilter(filter) {
    if (riverData.length === 0) {
        if (chartInstance) chartInstance.update();
        return;
    }

    let startTime = 0;
    const now = Date.now();
    
    switch (filter) {
        case 'day':
            startTime = now - (24 * 60 * 60 * 1000); 
            break;
        case 'week':
            startTime = now - (7 * 24 * 60 * 60 * 1000); 
            break;
        case 'month':
            startTime = now - (30 * 24 * 60 * 60 * 1000); 
            break;
        case 'year':
            startTime = now - (365 * 24 * 60 * 60 * 1000); 
            break;
        default:
            startTime = MIN_TIMESTAMP; 
    }
    
    const finalStartTime = Math.max(startTime, MIN_TIMESTAMP);

    const filteredData = riverData.filter(item => item.timestamp >= finalStartTime);

    const timestamps = filteredData.map(item => item.timestamp);
    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);
    
    const latestTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
    const latestWaterLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
    const latestFlow = flowValues.length > 0 ? flowValues[flowValues.length - 1] : null;

    // NY KOD: Uppdatera HTML-widgeten istället för att rita på canvas
    updateValueWidget(latestTimestamp, latestWaterLevel, latestFlow);
    
    let pointRadius = 2; 
    let tension = 0.4;   

    if (filter === 'week' || filter === 'month' || filter === 'year') {
        pointRadius = 0; 
        tension = 0.8;   
    }

    if (chartInstance) {
        // ENKELARE ANROP: tar bort onödiga plugin-parametrar
        updateChart(timestamps, waterLevels, flowValues, filter, pointRadius, tension);
    } else {
        // ENKELARE ANROP
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter || 'day', pointRadius, tension);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
// ENKELARE ANROP: tar bort latestWaterLevel och latestFlow
function updateChart(timestamps, waterLevels, flowValues, filter, pointRadius, tension) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    // Inga fler uppdateringar av pluginet behövs
    
    chartInstance.data.datasets[0].pointRadius = (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : pointRadius;
    chartInstance.data.datasets[1].pointRadius = (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : pointRadius;
    chartInstance.data.datasets[0].tension = tension;
    chartInstance.data.datasets[1].tension = tension;


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
// ENKELARE ANROP: tar bort onödiga plugin-parametrar
function createChart(timestamps, waterLevels, flowValues, initialFilter, pointRadius, tension) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    let initialUnit = 'hour';
    if (initialFilter === 'week' || initialFilter === 'month') {
        initialUnit = 'day';
    } else if (initialFilter === 'year') {
        initialUnit = 'month';
    }

    const primaryColor = getCssVariable('--primary-color');
    const secondaryColor = getCssVariable('--secondary-color');
    const textColorLight = getCssVariable('--text-color-light');
    const textColorDark = getCssVariable('--text-color-dark');
    const gridColor = 'rgba(255, 255, 255, 0.1)'; 
    const cardBg = getCssVariable('--card-bg');

    return new Chart(ctx, {
        type: 'line', 
        data: {
            labels: timestamps, 
            datasets: [{
                label: 'Nivå (m)', 
                data: waterLevels,
                borderColor: primaryColor, 
                backgroundColor: 'rgba(0, 180, 216, 0.05)', 
                fill: 'origin', 
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : pointRadius, 
                pointBackgroundColor: primaryColor,
                pointHoverRadius: 7,
                borderWidth: 1.5, 
                yAxisID: 'water-level',
                tension: tension 
            },
            {
                label: 'Flöde (m³/s)', 
                data: flowValues,
                borderColor: secondaryColor, 
                backgroundColor: 'rgba(255, 127, 80, 0.05)',
                fill: false, 
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : pointRadius, 
                pointBackgroundColor: secondaryColor,
                pointHoverRadius: 7,
                borderWidth: 1.5, 
                yAxisID: 'flow-rate',
                tension: tension 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                // VIKTIGT: Pluginet för att rita ut värden är nu borttaget!
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: cardBg,
                    titleColor: textColorLight,
                    bodyColor: textColorLight,
                    borderColor: primaryColor,
                    borderWidth: 1
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: textColorLight,
                        usePointStyle: true,
                        boxWidth: 10
                    }
                }
            },
            scales: {
                // X-AXEL (Tidpunkt)
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
                        color: textColorLight
                    },
                    ticks: {
                        color: textColorDark, 
                        maxRotation: 45, 
                        minRotation: 0,
                    },
                    grid: {
                         color: gridColor, 
                         drawBorder: false
                    }
                },
                // Y-AXEL 1 (Nivå)
                'water-level': { 
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Nivå (m)', 
                        color: primaryColor
                    },
                    ticks: {
                        color: primaryColor
                    },
                    grid: {
                         color: gridColor, 
                         drawBorder: false
                    }
                },
                
                // Y-AXEL 2 (Flöde)
                'flow-rate': { 
                    type: 'linear',
                    position: 'right', 
                    title: {
                        display: true,
                        text: 'Flöde (m³/s)', 
                        color: secondaryColor
                    },
                    ticks: {
                        color: secondaryColor
                    },
                    grid: { 
                        drawOnChartArea: false, 
                        drawBorder: false
                    } 
                }
            }
        },
        plugins: [] // Listan är tom, inget eget plugin används
    });
}

// Starta hämtning av data
fetchData();