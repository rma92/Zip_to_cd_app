const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite database
const db = new sqlite3.Database('zip_data.db');

// Define routes
app.get('/zip/:zipcode', (req, res) => {
  const { zipcode } = req.params;
  // Implement your logic to handle the zip code here
  // Example: Query the database for data related to the given zip code
  res.send(`Zip code ${zipcode} is not yet implemented`);
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// 404 Error handler
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 500 Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

