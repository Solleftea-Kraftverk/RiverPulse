// Async function to fetch data from backend
async function fetchData() {
    const response = await fetch('http://127.0.0.1:5000/data');
    const data = await response.json();

    // 🌟 Filtreringssteg: Behåll endast data från år 2025 och framåt
    const filteredData = data.filter(item => {
        const timestamp = item[0];
        const date = new Date(timestamp);
        return date.getFullYear() >= 2025;
    });

    // Förbered data för diagrammet - använd den filtrerade datan
    const timestamps = filteredData.map(item => item[0]);
    const waterLevels = filteredData.map(item => item[1]);
    const flowValues = filteredData.map(item => item[2]);

    // Skapa diagrammet
    createChart(timestamps, waterLevels, flowValues);
}

// Function to create the chart
function createChart(timestamps, waterLevels, flowValues) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',  // Line chart
        data: {
            labels: timestamps,  // x-axis: timestamps
            datasets: [{
                label: 'Water Level (m)',  // y-axis: Water level
                data: waterLevels,
                borderColor: 'blue',
                fill: false
            },
            {
                label: 'Flow (m³/s)',  // y-axis: Flow
                data: flowValues,
                borderColor: 'green',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'category',  // x-axis: categorical (timestamps)
                    title: {
                        display: true,
                        text: 'Timestamp'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });
}

// Call the fetchData function to get data and render the chart
fetchData();