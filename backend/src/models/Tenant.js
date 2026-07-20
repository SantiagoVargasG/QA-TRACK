const { Schema, model } = require('mongoose');

const tenantSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = model('Tenant', tenantSchema);
