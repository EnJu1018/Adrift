import mongoose from 'mongoose';

const diarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    mood: {
      type: {
        type: String,
        required: true,
        trim: true,
        enum: ['calm', 'joy', 'sad', 'wonder', 'anxious', 'nostalgic', 'other']
      },
      intensity: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      }
    },
    imageUrl: {
      type: String,
      default: ''
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return value.length === 2 && value.every((number) => Number.isFinite(number));
          },
          message: 'Location coordinates must be [lng, lat]'
        }
      }
    },
    locationAccuracy: {
      type: Number,
      min: 0
    },
    visibility: {
      type: String,
      required: true,
      enum: ['private', 'friends', 'public'],
      default: 'private',
      index: true
    }
  },
  { timestamps: true }
);

diarySchema.index({ location: '2dsphere' });

export default mongoose.model('Diary', diarySchema);
