const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('./models/Category');

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found in env');
    }
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('Connected to DB');
    const categories = await Category.find().lean();
    console.log('Categories count:', categories.length);
    console.log(JSON.stringify(categories, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
