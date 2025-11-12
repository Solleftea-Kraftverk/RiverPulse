// Define an async function to fetch and display data
async function fetchData() {
    try {
      const response = await fetch('https://river-pulse-data-fetcher.philip-strassenbergen.workers.dev/data');
      const data = await response.json();
  
      // Log the data to console (for debugging)
      console.log(data);
  
      // Get reference to table body
      const tableBody = document.querySelector("#data-table tbody");
  
      // Clear existing table data (if any)
      tableBody.innerHTML = '';
  
      // Loop through the data and add rows to the table
      for (let index = data.length -1; index >= 0; index--) {
        item = data[index]
        const row = document.createElement("tr");
  
        // Create cells for each data item
        const timestampCell = document.createElement("td");
        timestampCell.textContent = item[0];
        row.appendChild(timestampCell);
  
        const waterLevelCell = document.createElement("td");
        waterLevelCell.textContent = item[1];
        row.appendChild(waterLevelCell);
  
        const flowCell = document.createElement("td");
        flowCell.textContent = item[2];
        row.appendChild(flowCell);
  
        const latestUpdateCell = document.createElement("td");
        latestUpdateCell.textContent = item[3];
        row.appendChild(latestUpdateCell);
  
        // Append the row to the table body
        tableBody.appendChild(row);
      };
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  
  // Call the fetchData function when the page loads
  fetchData();
  