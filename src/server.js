require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const authRoutes = require('./routes/auth');
const resourcesRoutes = require('./routes/resources');
const worksRoutes = require('./routes/works');
const projectsRoutes = require('./routes/projects');

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/works', worksRoutes);
app.use('/api/projects', projectsRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
