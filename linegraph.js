// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;
// Definierar den tidigaste tillåtna datan: 2025-11-08 i millisekunder
const MIN_TIMESTAMP = Date.parse('2025-11-08T00:00:00'); 

// Utility-funktion för att hämta CSS-variabler (Behövs ej längre, men behålls som best practice)
function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

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
                item.timestamp = Date.parse(dateStr); 
                return item;
            })
            .filter(item => !isNaN(item.timestamp) && item.timestamp >= MIN_TIMESTAMP);

        riverData.sort((a, b) => a.timestamp - b.timestamp);

        applyFilter('day'); 
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

// FIX: Ny funktion för att uppdatera de separata värde-korten
function updateLatestValuesWidget(latestWaterLevel, latestFlow) {
    const levelElement = document.getElementById('latest-level-value');
    const flowElement = document.getElementById('latest-flow-value');

    levelElement.textContent = latestWaterLevel !== null ? latestWaterLevel.toFixed(2) : '--';
    flowElement.textContent = latestFlow !== null ? latestFlow.toFixed(2) : '--';
}


// Funktion för att filtrera data och uppdatera diagrammet
function applyFilter(filter) {
    if (riverData.length === 0) {
        updateLatestValuesWidget(null, null); // Uppdatera widget även vid tomt data
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
    
    const latestWaterLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
    const latestFlow = flowValues.length > 0 ? flowValues[flowValues.length - 1] : null;

    // VIKTIGT: Uppdaterar den nya widgeten
    updateLatestValuesWidget(latestWaterLevel, latestFlow); 

    if (chartInstance) {
        updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow);
    } else {
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
function updateChart(timestamps, waterLevels, flowValues, filter) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    let unit = 'hour';
    if (filter === 'week') {
        unit = 'day';
    } else if (filter === 'month') {
        unit = 'day';
    } else if (filter === 'year') {
        unit = 'month';
    }
    
    chartInstance.options.scales.x.time.unit = unit;
    
    // Tar bort referensen till det gamla pluginet som inte används längre
    delete chartInstance.options.plugins.customLabels;
    
    chartInstance.update();
}


// Funktion för att skapa diagrammet med dubbla Y-axlar
function createChart(timestamps, waterLevels, flowValues, initialFilter) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    let initialUnit = 'hour';
    if (initialFilter === 'week' || initialFilter === 'month') {
        initialUnit = 'day';
    } else if (initialFilter === 'year') {
        initialUnit = 'month';
    }

    // FIX: Tar bort det gamla pluginet
    // const latestValueLabelPlugin = { id: 'customLabels', ... }

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
                backgroundColor: 'rgba(0, 180, 216, 0.05)', // Mindre fyllning
                fill: 'origin', 
                // FIX: Reducerad punktstorlek
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : 2, 
                pointBackgroundColor: primaryColor,
                pointHoverRadius: 7,
                borderWidth: 1.5, // FIX: Reducerad linjebredd
                yAxisID: 'water-level',
                tension: 0.4
            },
            {
                label: 'Flöde (m³/s)', 
                data: flowValues,
                borderColor: secondaryColor, 
                backgroundColor: 'rgba(255, 127, 80, 0.05)',
                fill: false, 
                // FIX: Reducerad punktstorlek
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : 2, 
                pointBackgroundColor: secondaryColor,
                pointHoverRadius: 7,
                borderWidth: 1.5, // FIX: Reducerad linjebredd
                yAxisID: 'flow-rate',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                // FIX: Tar bort referensen till det borttagna pluginet
                // customLabels: latestValueLabelPlugin, 
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
        }
    });
}

// Starta hämtning av data
fetchData();