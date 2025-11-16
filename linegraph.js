// Global variabel för att lagra all hämtad data
let riverData = [];
// Global variabel för att hålla diagraminstansen
let chartInstance = null;
// Definierar den tidigaste tillåtna datan: 2025-11-08 i millisekunder
const MIN_TIMESTAMP = Date.parse('2025-11-08T00:00:00'); 

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
            // 1. Filtrera bort ogiltiga datum OCH 2. Data FÖRE 2025-11-08
            .filter(item => !isNaN(item.timestamp) && item.timestamp >= MIN_TIMESTAMP);

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
    if (riverData.length === 0) {
        console.warn("Ingen data tillgänglig efter filtrering.");
        if (chartInstance) {
             // Töm diagrammet om det inte finns data
            chartInstance.data.labels = [];
            chartInstance.data.datasets[0].data = [];
            chartInstance.data.datasets[1].data = [];
            chartInstance.update();
        }
        return;
    }

    let startTime = 0;
    const now = Date.now();
    
    // Beräkna starttiden baserat på valt filter
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
    
    // Säkerställ att starttiden inte är före MIN_TIMESTAMP
    const finalStartTime = Math.max(startTime, MIN_TIMESTAMP);

    const filteredData = riverData.filter(item => item.timestamp >= finalStartTime);

    const timestamps = filteredData.map(item => item.timestamp);
    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);
    
    const latestWaterLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
    const latestFlow = flowValues.length > 0 ? flowValues[flowValues.length - 1] : null;

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
            const { ctx, chartArea: { right, left }, scales: { 'water-level': y1, 'flow-rate': y2 }, width } = chart;
            ctx.save();
            // Använd CSS-variabler för färg från DOM
            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
            const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim();
            
            // Hitta indexet för den senaste datapunkten
            const lastIndex = chart.data.labels.length - 1;
            if (lastIndex < 0) return;

            // Ritar ut Nivå-värdet (vänster axel)
            if (latestWaterLevel !== null && y1.ticks.length > 0) {
                const xPos = chart.getDatasetMeta(0).data[lastIndex].x;
                const latestY = y1.getPixelForValue(latestWaterLevel);
                
                // Text utritning
                ctx.font = '700 12px var(--font-stack)';
                ctx.textAlign = 'left';
                ctx.fillStyle = primaryColor;
                
                // Flytta texten utanför diagramområdet, vid höger kant av diagrammet
                ctx.fillText(
                    latestWaterLevel.toFixed(2), 
                    xPos + 10, 
                    latestY - 5
                );
            }

            // Ritar ut Flöde-värdet (höger axel)
            if (latestFlow !== null && y2.ticks.length > 0) {
                const xPos = chart.getDatasetMeta(1).data[lastIndex].x;
                const latestY = y2.getPixelForValue(latestFlow);
                
                // Text utritning
                ctx.font = '700 12px var(--font-stack)';
                ctx.textAlign = 'left';
                ctx.fillStyle = secondaryColor;
                
                // Flytta texten utanför diagramområdet
                ctx.fillText(
                    latestFlow.toFixed(2), 
                    xPos + 10, 
                    latestY + 15
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
                label: 'Nivå (m)', // Svensk titel
                data: waterLevels,
                borderColor: 'var(--primary-color)',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : 2, // Större punkt på sista värdet
                pointBackgroundColor: (context) => context.dataIndex === context.dataset.data.length - 1 ? 'var(--primary-color)' : 'transparent',
                pointHoverRadius: 7,
                borderWidth: 2,
                yAxisID: 'water-level' 
            },
            {
                label: 'Flöde (m³/s)', // Svensk titel
                data: flowValues,
                borderColor: 'var(--secondary-color)',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 5 : 2, // Större punkt på sista värdet
                pointBackgroundColor: (context) => context.dataIndex === context.dataset.data.length - 1 ? 'var(--secondary-color)' : 'transparent',
                pointHoverRadius: 7,
                borderWidth: 2,
                yAxisID: 'flow-rate' 
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
                    backgroundColor: 'var(--card-bg)',
                    titleColor: 'var(--text-color-light)',
                    bodyColor: 'var(--text-color-light)',
                    borderColor: 'var(--primary-color)',
                    borderWidth: 1
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: 'var(--text-color-light)',
                        usePointStyle: true
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
                        color: 'var(--text-color-light)'
                    },
                    ticks: {
                        color: 'var(--text-color-dark)',
                        maxRotation: 45, 
                        minRotation: 0,
                    },
                    grid: {
                         color: 'rgba(255, 255, 255, 0.1)', 
                         drawBorder: false
                    }
                },
                // Y-AXEL 1 (Nivå)
                'water-level': { 
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Nivå (m)', // Svensk titel
                        color: 'var(--primary-color)'
                    },
                    ticks: {
                        color: 'var(--primary-color)'
                    },
                    grid: {
                         color: 'rgba(255, 255, 255, 0.1)', 
                         drawBorder: false
                    }
                },
                
                // Y-AXEL 2 (Flöde)
                'flow-rate': { 
                    type: 'linear',
                    position: 'right', 
                    title: {
                        display: true,
                        text: 'Flöde (m³/s)', // Svensk titel
                        color: 'var(--secondary-color)'
                    },
                    ticks: {
                        color: 'var(--secondary-color)'
                    },
                    grid: { 
                        drawOnChartArea: false, // Inget rutnät i diagrammet för denna axel
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