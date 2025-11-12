// Async function to fetch data from backend
async function fetchData() {
    const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
    const data = await response.json();

    // Filtreringssteg: Behåll endast data från år 2025 och framåt
    const filteredData = data.filter(item => {
        const date = new Date(item.timestamp);
        return date.getFullYear() >= 2025;
    });

    // Förbered data för diagrammet - använd den filtrerade datan
    const timestamps = filteredData.map(item => item.timestamp);
    const waterLevels = filteredData.map(item => item.water_level);
    const flowValues = filteredData.map(item => item.flow);

    // Debug utskrifter för att verifiera datan
    console.log('Timestamps:', timestamps);
    console.log('Water Levels:', waterLevels);
    console.log('Flow Values:', flowValues);

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
                yAxisID: 'water-level' // <-- Länkar till vänster axel
            },
            {
                // Dataset 2: Flöde (Använder 'flow-rate' axeln)
                label: 'Flow (m³/s)',
                data: flowValues,
                borderColor: 'green',
                fill: false,
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
                        text: 'Timestamp'
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