// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;
// Definierar den tidigaste tillåtna datan: 2025-11-08 i millisekunder
const MIN_TIMESTAMP = Date.parse('2025-11-08T00:00:00'); 

// Utility-funktion för att hämta CSS-variabler
function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// FIX: Förbättrat plugin för att visa de senaste värdena utan att överlappa.
const latestValueLabelPlugin = {
    id: 'customLabels',
    latestWaterLevel: null,
    latestFlow: null,

    afterDraw: (chart) => {
        // chartArea.right är den inre högra kanten av ritytan.
        // scales['flow-rate'].right är den yttre kanten av den högra Y-axeln.
        const { ctx, chartArea: { right }, scales: { 'water-level': y1, 'flow-rate': y2 } } = chart;
        ctx.save();
        
        const primaryColor = getCssVariable('--primary-color');
        const secondaryColor = getCssVariable('--secondary-color');
        
        // Hoppa över om ingen data finns
        if (latestValueLabelPlugin.latestWaterLevel === null) {
             ctx.restore();
             return;
        }

        // xPos sätts till den yttre högra kanten av Y-axelns labels.
        // Vi lägger till ytterligare 5px padding för att separera texten.
        const xPos = y2.right + 5; 

        ctx.font = '700 13px var(--font-stack)';
        ctx.textAlign = 'left'; // Vänsterjustera texten från xPos
        ctx.textBaseline = 'middle'; // Centrera texten vertikalt

        // Ritar ut Nivå-värdet (Cyan)
        if (latestValueLabelPlugin.latestWaterLevel !== null && y1.ticks.length > 0) {
            const latestY = y1.getPixelForValue(latestValueLabelPlugin.latestWaterLevel);
            
            ctx.fillStyle = primaryColor;
            
            // Texten placeras direkt vid den yttre axelkanten (xPos).
            ctx.fillText(
                latestValueLabelPlugin.latestWaterLevel.toFixed(2) + ' m', 
                xPos, 
                latestY - 5 // Lite ovanför linjens höjd
            );
        }

        // Ritar ut Flöde-värdet (Orange)
        if (latestValueLabelPlugin.latestFlow !== null && y2.ticks.length > 0) {
            const latestY = y2.getPixelForValue(latestValueLabelPlugin.latestFlow);
            
            ctx.fillStyle = secondaryColor;
            
            // Texten placeras direkt vid den yttre axelkanten (xPos).
            ctx.fillText(
                latestValueLabelPlugin.latestFlow.toFixed(2) + ' m³/s', 
                xPos, 
                latestY + 15 // Lite under Nivå-värdet för att separera dem tydligt
            );
        }

        ctx.restore();
    }
};


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

    // FIX: Bestäm pointRadius och tension baserat på filtret
    let pointRadius = 2; // Synliga punkter för 24 timmar
    let tension = 0.4;   // Låg utjämning för 24 timmar

    if (filter === 'week' || filter === 'month' || filter === 'year') {
        pointRadius = 0; // FIX: Ta bort datapunkterna i de längre vyerna
        tension = 0.8;   // FIX: Mycket hög utjämning (nära 1.0) för att jämna av topparna
    }

    if (chartInstance) {
        updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow, pointRadius, tension);
    } else {
        chartInstance = createChart(timestamps, waterLevels, flowValues, filter, pointRadius, tension);
    }
}

// Funktion för att uppdatera diagrammets data och axelkonfiguration
function updateChart(timestamps, waterLevels, flowValues, filter, latestWaterLevel, latestFlow, pointRadius, tension) {
    chartInstance.data.labels = timestamps;
    chartInstance.data.datasets[0].data = waterLevels;
    chartInstance.data.datasets[1].data = flowValues;

    // Uppdaterar dynamiska värden, spänning och punktstorlek
    latestValueLabelPlugin.latestWaterLevel = latestWaterLevel;
    latestValueLabelPlugin.latestFlow = latestFlow;
    
    // Sista punkten är alltid synlig (radius 5), annars pointRadius (0 eller 2)
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
                borderWidth: 1.5, // Tunn linjebredd för renare utseende
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
                borderWidth: 1.5, // Tunn linjebredd
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
        plugins: [latestValueLabelPlugin]
    });
}

// Starta hämtning av data
fetchData();