// models/Appointment.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AppointmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userEmail: String,
  psychiatristId: { type: Schema.Types.ObjectId, ref: 'User' }, // or staff
  start: Date,
  end: Date,
  status: { type: String, enum: ['pending','confirmed','cancelled','done'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Appointment', AppointmentSchema);
