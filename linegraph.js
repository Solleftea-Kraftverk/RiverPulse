// Async function to fetch data from backend
async function fetchData() {
    const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
    const data = await response.json();

    // Filter data: keep only items where latest_update year is 2025 or later
    const filteredData = data.filter(item => {
        // Remove prefix, then parse date part of latest_update
        const dateStr = item.latest_update.replace(/^Senast uppdaterat\s*/, '');
        const year = new Date(dateStr).getFullYear();
        return year >= 2025;
    });

    // Extract timestamps from filtered data
    const timestamps = filteredData.map(item => {
        // Remove "Senast uppdaterat " prefix
        return item.latest_update.replace(/^Senast uppdaterat\s*/, '');
    });

    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);

    // Skapa diagrammet
    createChart(timestamps, waterLevels, flowValues);
}

// Function to create the chart med dubbla Y-axlar
function createChart(timestamps, waterLevels, flowValues) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',  // Line chart
        data: {
            labels: timestamps,  // x-axis: timestamps
            datasets: [{
                // Dataset 1: Vattennivå (Använder 'water-level' axeln)
                label: 'Water Level (m)',
                data: waterLevels,
                borderColor: 'blue',
                fill: false,
                pointRadius: 3,
                pointHoverRadius: 5,
                yAxisID: 'water-level' // <-- Länkar till vänster axel
            },
            {
                // Dataset 2: Flöde (Använder 'flow-rate' axeln)
                label: 'Flow (m³/s)',
                data: flowValues,
                borderColor: 'green',
                fill: false,
                pointRadius: 3,
                pointHoverRadius: 5,
                yAxisID: 'flow-rate' // <-- Länkar till höger axel
            }]
        },
        options: {
            responsive: true,
            // DEFINIERAR ALLA AXLAR
            scales: {
                // X-AXEL
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Tidpunkt'
                    },
                    ticks: {
                        maxRotation: 45,    // Tilt the labels slightly for readability
                        minRotation: 45,
                        autoSkip: true,     // Don’t show every single label if there are many
                        maxTicksLimit: 10   // Show at most ~10 labels
                    }
                },
                // Y-AXEL 1 (Vattennivå)
                'water-level': { 
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Water Level (m)',
                        color: 'blue'
                    },
                    ticks: {
                        color: 'blue'
                    }
                },
                
                // Y-AXEL 2 (Flöde)
                'flow-rate': { 
                    type: 'linear',
                    position: 'right', // Placera till höger
                    title: {
                        display: true,
                        text: 'Flow (m³/s)',
                        color: 'green'
                    },
                    ticks: {
                        color: 'green'
                    },
                    // Bra att stänga av rutnätet för den högra axeln
                    // för att undvika visuellt brus
                    grid: { 
                        drawOnChartArea: false 
                    } 
                }
            }
        }
    });
}

// Call the fetchData function to get data and render the chart
fetchData();