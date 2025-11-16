// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null; 

// Konstanter
const MIN_DATE_STRING = '2025-11-08'; 
const MIN_TIMESTAMP = Date.parse(`${MIN_DATE_STRING}T00:00:00`); 
const CSS_FALLBACKS = {
    '--primary-color': '#00b4d8', 
    '--secondary-color': '#ff7f50', 
    '--text-color-light': '#f0f0f0', 
    '--text-color-dark': '#a9a9b3', 
    '--font-stack': 'Roboto Mono, monospace',
    '--card-bg': '#1f2038'
};

// Utility-funktion för att hämta CSS-variabler
function getCssVariable(name) {
    const style = getComputedStyle(document.documentElement);
    // Returnerar CSS-variabeln eller en fallback
    return style.getPropertyValue(name).trim() || CSS_FALLBACKS[name] || ''; 
}

// FIX: Plugin för att visa de senaste värdena. 
const latestValueLabelPlugin = {
    id: 'customLabels',
    latestWaterLevel: null,
    latestFlow: null,

    afterDraw: (chart) => {
        const { ctx, scales: { 'water-level': y1, 'flow-rate': y2 } } = chart;
        ctx.save();
        
        const primaryColor = getCssVariable('--primary-color');
        const secondaryColor = getCssVariable('--secondary-color');
        
        if (latestValueLabelPlugin.latestWaterLevel === null) {
             ctx.restore();
             return;
        }

        const xPos = chart.width - 10; 

        ctx.font = '700 13px var(--font-stack)';
        ctx.textAlign = 'right'; 
        ctx.textBaseline = 'middle'; 

        if (latestValueLabelPlugin.latestWaterLevel !== null && y1.ticks.length > 0) {
            const latestY = y1.getPixelForValue(latestValueLabelPlugin.latestWaterLevel);
            
            ctx.fillStyle = primaryColor;
            
            ctx.fillText(
                latestValueLabelPlugin.latestWaterLevel.toFixed(2) + ' m', 
                xPos, 
                latestY - 5 
            );
        }

        if (latestValueLabelPlugin.latestFlow !== null && y2.ticks.length > 0) {
            const latestY = y2.getPixelForValue(latestValueLabelPlugin.latestFlow);
            
            ctx.fillStyle = secondaryColor;
            
            ctx.fillText(
                latestValueLabelPlugin.latestFlow.toFixed(2) + ' m³/s', 
                xPos, 
                latestY + 15 
            );
        }

        ctx.restore();
    }
};


// Async function to fetch data from backend (utan retry-logik)
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
                item.water_level = parseFloat(item.water_level);
                item.flow = parseFloat(item.flow);
                return item;
            })
            .filter(item => 
                !isNaN(item.timestamp) && 
                item.timestamp >= MIN_TIMESTAMP &&
                !isNaN(item.water_level) &&
                !isNaN(item.flow)
            );

        riverData.sort((a, b) => a.timestamp - b.timestamp);

        applyFilter(getActiveFilter()); 
        setupFilterListeners(); // Sätt upp lyssnare ENBART efter att datan är hämtad

    } catch (error) {
        console.error("Fel vid datahämtning eller bearbetning:", error.message);
        // Återställd alert, den triggas bara en gång initialt nu.
        alert("Kunde inte ladda data. Kontrollera konsolen för mer information.");
    }
}

// Funktion för att hitta det aktiva radio-valet
function getActiveFilter() {
    const active = document.querySelector('input[name="time-filter"]:checked');
    return active ? active.value : 'day'; 
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
    
    const latestWaterLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
    const latestFlow = flowValues.length > 0 ? flowValues[flowValues.length - 1] : null;

    let pointRadius = 2; 
    let tension = 0.4;   

    if (filter === 'week' || filter === 'month' || filter === 'year') {
        pointRadius = 0; 
        tension = 0.8;   
    }

    if (chartInstance) {
        updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow, pointRadius, tension);
    } else {
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter || 'day', pointRadius, tension);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
function updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow, pointRadius, tension) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    latestValueLabelPlugin.latestWaterLevel = latestWaterLevel;
    latestValueLabelPlugin.latestFlow = latestFlow;
    
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
    
    // Använd resize-funktionen för att tvinga Chart.js att rita om (detta är säkrare än update())
    chartInstance.resize();
}


// Funktion för att skapa diagrammet med dubbla Y-axlar
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
                customLabels: latestValueLabelPlugin, 
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
        plugins: [latestValueLabelPlugin]
    });
}

// Starta initial laddning
fetchData();