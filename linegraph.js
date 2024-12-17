// Async function to fetch data from backend
async function fetchData() {
    const response = await fetch('http://127.0.0.1:5000/data');
    const data = await response.json();

    // Prepare data for the chart
    const timestamps = data.map(item => item[0]);  // Extract timestamps
    const waterLevels = data.map(item => item[1]); // Extract water levels
    const flowValues = data.map(item => item[2]);  // Extract flow values

    // Create the chart
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