// verifyDb.js
// Utility to verify database connection (local/Atlas) and seed an initial admin user.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Story = require('./models/Story');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ProjectUplift';

async function run() {
  console.log('Connecting to MongoDB...');
  console.log('URI:', MONGO_URI.replace(/:([^@]+)@/, ':****@')); // mask password if present

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully!');

    // Check users
    const userCount = await User.countDocuments();
    console.log(`Current users in database: ${userCount}`);

    // Check admin
    let admin = await User.findOne({ role: 'admin' });
    if (admin) {
      console.log(`✅ Existing admin found: "${admin.username}"`);
    } else {
      console.log('No admin user found. Seeding an admin user...');
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword123'; 
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPassword, salt);

      admin = await User.create({
        username: adminUsername,
        passwordHash: hash,
        avatar: 'avatar2.jpg',
        role: 'admin',
        email: 'admin@uplift-platform.org'
      });

      console.log('----------------------------------------------------');
      console.log('✅ Admin user created successfully!');
      console.log(`Decoy Username: ${adminUsername}`);
      console.log(`Decoy Password: ${adminPassword}`);
      console.log('Email: admin@uplift-platform.org');
    }

    // Seed default success stories if none exist
    const successCount = await Story.countDocuments({ type: 'success' });
    console.log(`Current success stories in database: ${successCount}`);
    if (successCount === 0) {
      console.log('No success stories found. Seeding default success stories...');
      await Story.create([
        {
          username: 'hopeful_soul',
          title: 'Overcoming Anxiety Through Mindfulness',
          content: 'I used to struggle with severe anxiety and panic attacks, especially in social situations. Through daily mindfulness practices, breathing exercises, and meditation, I slowly learned to ground myself. It has been a year now, and I feel more present and peaceful than ever before.',
          tags: ['anxiety', 'mindfulness', 'meditation', 'mentalhealth'],
          type: 'success'
        },
        {
          username: 'bright_day',
          title: 'Finding Hope After Deep Depression',
          content: 'My journey out of depression was not linear. Therapy, support from loved ones, and picking up running changed my life. Setting small, daily goals helped me rebuild my confidence. If you are going through a dark time, remember that healing is possible and you are not alone.',
          tags: ['depression', 'hope', 'therapy', 'exercise'],
          type: 'success'
        },
        {
          username: 'calm_mind',
          title: 'How Meditation Restored My Sleep and Peace',
          content: 'Stress at work led to severe insomnia and constant exhaustion. I started joining weekend wellness workshops and practicing guided sleep meditation. Over a few weeks, my sleep patterns stabilized and I recovered my focus. Meditation and work-life balance are key.',
          tags: ['insomnia', 'stress', 'meditation', 'workshops'],
          type: 'success'
        }
      ]);
      console.log('✅ Default success stories seeded successfully!');
    }

    console.log('Database verification complete.');
  } catch (err) {
    console.error('❌ Connection or verification failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
